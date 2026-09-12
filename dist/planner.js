/* Pure planning engine. Academic eligibility is deliberately outside this validator. */
(function (root) {
  "use strict";
  const SUPPORTED = [
    "CS 3110",
    "CS 2800",
    "ECON 3030",
    "ECON 3040",
    "MATH 2940",
    "MATH 2930",
  ];
  function minutes(s) {
    const m = /^(\d{1,2}):(\d{2})(AM|PM)$/.exec(s || "");
    if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] > 59) return null;
    return ((+m[1] % 12) + (m[3] === "PM" ? 12 : 0)) * 60 + +m[2];
  }
  function date(s) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || "");
    return m ? Date.UTC(+m[3], +m[1] - 1, +m[2]) : null;
  }
  function overlap(a, b) {
    return (
      a.days.some((d) => b.days.includes(d)) &&
      a.start < b.end &&
      b.start < a.end &&
      a.from <= b.to &&
      b.from <= a.to
    );
  }
  function meetings(section) {
    if (!section.meetings?.length) return null;
    const result = [];
    for (const m of section.meetings) {
      const start = minutes(m.timeStart),
        end = minutes(m.timeEnd),
        from = date(m.startDt),
        to = date(m.endDt);
      if (
        start === null ||
        end === null ||
        start >= end ||
        from === null ||
        to === null ||
        from > to ||
        !m.pattern ||
        /[^MTWRFSU]/.test(m.pattern)
      )
        return null;
      result.push({
        start,
        end,
        from,
        to,
        days: [...m.pattern].map((d) => "MTWRFSU".indexOf(d)),
        pattern: m.pattern,
      });
    }
    return result;
  }
  function normalize(raw) {
    const out = [];
    for (const c of raw) {
      const id = c.subject + " " + c.catalogNbr;
      if (!SUPPORTED.includes(id)) continue;
      const bundles = [],
        exclusions = [];
      for (const [gi, g] of (c.enrollGroups || []).entries()) {
        // Do not guess additional section-linkage semantics or variable-credit choices.
        if (g.simpleCombinations?.length) {
          exclusions.push("Special section linkage requires manual review");
          continue;
        }
        if (
          !Array.isArray(g.componentsRequired) ||
          !g.componentsRequired.length ||
          !Number.isFinite(g.unitsMinimum) ||
          g.unitsMinimum !== g.unitsMaximum
        ) {
          exclusions.push(
            "Unsupported component or variable-credit configuration",
          );
          continue;
        }
        const choices = g.componentsRequired.map((type) =>
          (g.classSections || [])
            .filter((s) => s.ssrComponent === type)
            .map((s) => ({ ...s, parsedMeetings: meetings(s) }))
            .filter((s) => s.parsedMeetings && s.campus === "MAIN"),
        );
        function walk(i, sections) {
          if (i === choices.length) {
            const all = sections.flatMap((s) => s.parsedMeetings);
            if (all.some((a, j) => all.slice(j + 1).some((b) => overlap(a, b))))
              return;
            bundles.push({
              key:
                gi +
                ":" +
                sections
                  .map((s) => s.classNbr)
                  .sort()
                  .join("-"),
              group: gi,
              credits: g.unitsMinimum,
              sections: sections.map((s) => ({
                id: String(s.classNbr),
                component: s.ssrComponent,
                label: s.ssrComponent + " " + s.section,
                status: s.openStatus,
                consent: s.addConsentDescr,
                meetings: s.parsedMeetings,
              })),
              meetings: all,
            });
            return;
          }
          for (const s of choices[i]) walk(i + 1, [...sections, s]);
        }
        walk(0, []);
      }
      out.push({
        id,
        title: c.titleLong,
        prereq: c.catalogPrereq || c.catalogPrereqCoreq || "",
        coreq: c.catalogCoreq || "",
        priority: c.catalogEnrollmentPriority || c.catalogPermission || "",
        bundles,
        exclusions,
      });
    }
    return out;
  }
  function isOpen(bundle, closed) {
    return bundle.sections.every((s) => s.status === "O" && !closed.has(s.id));
  }
  function signature(plan) {
    return plan
      .map((x) => x.id + ":" + x.bundle.key)
      .sort()
      .join("|");
  }
  function changes(plan, baseline) {
    if (!baseline) return 0;
    return (
      plan.reduce((n, c) => {
        const old = baseline.find((x) => x.id === c.id);
        return (
          n +
          c.bundle.sections.filter(
            (s) => !old?.bundle.sections.some((o) => o.id === s.id),
          ).length
        );
      }, 0) + baseline.filter((c) => !plan.some((p) => p.id === c.id)).length
    );
  }
  function preferences(plan, goals) {
    const ms = plan.flatMap((c) => c.bundle.meetings);
    const early = ms
      .filter((m) => m.start < 600)
      .reduce((n, m) => n + m.days.length, 0);
    const friday = ms.filter((m) => m.days.includes(4) && m.end > 720).length;
    return {
      early,
      friday,
      penalty: (goals.early ? early : 0) + (goals.friday ? friday : 0),
    };
  }
  function validate(plan, goals, catalog, closed = new Set()) {
    const errors = [];
    if (
      plan.length !== goals.courses.length ||
      new Set(plan.map((c) => c.id)).size !== plan.length ||
      !goals.courses.every((id) => plan.some((c) => c.id === id))
    )
      errors.push("Required course selection mismatch");
    for (const c of plan) {
      const source = catalog
        .find((x) => x.id === c.id)
        ?.bundles.find((b) => b.key === c.bundle.key);
      if (!source || JSON.stringify(source) !== JSON.stringify(c.bundle))
        errors.push("Section bundle no longer matches the roster");
      if (!isOpen(c.bundle, closed))
        errors.push(
          c.id + " has a closed, waitlisted, or unknown-status section",
        );
    }
    const credits = plan.reduce((n, c) => n + c.bundle.credits, 0);
    if (credits < goals.min || credits > goals.max)
      errors.push("Credit range not satisfied");
    const all = plan.flatMap((c) => c.bundle.meetings);
    if (all.some((a, i) => all.slice(i + 1).some((b) => overlap(a, b))))
      errors.push("Meeting time conflict");
    return { ok: !errors.length, errors, credits };
  }
  function generate(catalog, goals, closed = new Set(), baseline = null) {
    if (
      !Number.isInteger(goals.min) ||
      !Number.isInteger(goals.max) ||
      goals.min < 1 ||
      goals.max > 24 ||
      goals.min > goals.max
    )
      throw Error(
        "Enter a credit range from 1 to 24 with minimum no greater than maximum.",
      );
    if (!goals.courses.length || goals.courses.length > 4)
      throw Error("Choose between one and four courses.");
    const selected = goals.courses.map((id) => {
      const c = catalog.find((c) => c.id === id);
      if (!c) throw Error(id + " is not in this Fall 2026 demo catalog.");
      return c;
    });
    let visited = 0,
      truncated = false,
      feasible = 0;
    const plans = [];
    function rank(a, b) {
      return (
        changes(a, baseline) - changes(b, baseline) ||
        preferences(a, goals).penalty - preferences(b, goals).penalty ||
        signature(a).localeCompare(signature(b))
      );
    }
    function walk(i, plan) {
      if (++visited > 150000) {
        truncated = true;
        return;
      }
      if (i === selected.length) {
        if (validate(plan, goals, catalog, closed).ok) {
          feasible++;
          plans.push(plan);
          plans.sort(rank);
          if (plans.length > 20) plans.pop();
        }
        return;
      }
      const c = selected[i];
      for (const bundle of c.bundles) {
        if (truncated) return;
        if (
          !isOpen(bundle, closed) ||
          bundle.meetings.some((a) =>
            plan.some((p) => p.bundle.meetings.some((b) => overlap(a, b))),
          )
        )
          continue;
        walk(i + 1, [...plan, { id: c.id, bundle }]);
      }
    }
    walk(0, []);
    return { plans, visited, feasible, truncated };
  }
  const api = {
    SUPPORTED,
    minutes,
    overlap,
    normalize,
    isOpen,
    signature,
    changes,
    preferences,
    validate,
    generate,
  };
  if (typeof module !== "undefined") module.exports = api;
  else root.CoursePlanner = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
