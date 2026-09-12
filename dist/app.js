"use strict";
const P = CoursePlanner,
  $ = (id) => document.getElementById(id);
const colors = ["green", "blue", "orange", "purple"];
let snapshot = null,
  catalog = [],
  plans = [],
  selected = 0,
  approved = null,
  approvedGoals = null,
  approvedSnapshot = null,
  closed = new Set(),
  events = [],
  busy = false,
  dirty = false,
  plannedGoals = null,
  lastResult = null;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const labelTime = (m) =>
  `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, "0")}${m >= 720 ? "pm" : "am"}`;
const sectionText = (p) =>
  p
    .map((c) => `${c.id}: ${c.bundle.sections.map((s) => s.label).join(" + ")}`)
    .join("; ");
function log(title, detail) {
  events.unshift({ title, detail });
  events = events.slice(0, 7);
  $("feed").innerHTML = events
    .map(
      (e) =>
        `<div class="feed-item"><b>${esc(e.title)}</b><small>${esc(e.detail)}</small></div>`,
    )
    .join("");
}
function goals() {
  return {
    courses: [...document.querySelectorAll("[name=course]:checked")].map(
      (n) => n.value,
    ),
    min: Number($("min").value),
    max: Number($("max").value),
    early: $("early").checked,
    friday: $("friday").checked,
  };
}
function setBusy(value) {
  busy = value;
  for (const e of document.querySelectorAll(
    "#planner input,#planner textarea,#planner button,#planner select",
  ))
    e.disabled = value;
  if (!value) render();
}
function markDirty() {
  dirty = true;
  $("review").checked = false;
  $("result").textContent =
    "Goals changed. Generate schedules to apply your changes.";
  render();
}
function renderPicker() {
  const selectedIds = new Set(goals().courses);
  $("course-picker").innerHTML = P.SUPPORTED.map((id) => {
    const c = catalog.find((c) => c.id === id);
    return `<label class="course-choice"><input type="checkbox" name="course" value="${id}" ${selectedIds.has(id) ? "checked" : ""}><span><b>${id}</b><small>${esc(c?.title || "Not returned in this roster")}</small></span></label>`;
  }).join("");
  for (const c of document.querySelectorAll("[name=course]"))
    c.onchange = markDirty;
}
function generate() {
  if (busy || !snapshot) return;
  try {
    const g = goals();
    const r = P.generate(catalog, g, closed, approved);
    plannedGoals = structuredClone(g);
    lastResult = r;
    plans = r.plans;
    selected = 0;
    dirty = false;
    $("review").checked = false;
    log(
      "Schedule search completed",
      `${r.visited} search states · ${r.feasible} feasible schedules${r.truncated ? " · search limit reached" : ""}`,
    );
    $("result").textContent = plans.length
      ? `${r.feasible} feasible schedules found. Showing the best ${Math.min(3, plans.length)}. Academic prerequisites and enrollment restrictions still need your review.`
      : "No feasible schedule for these courses, credit bounds, and open sections. Change the course selection or credit range, or reset simulated closures. Preferences are soft and do not cause this failure.";
    render();
  } catch (e) {
    plans = [];
    plannedGoals = null;
    dirty = true;
    $("result").textContent = e.message;
    render();
  }
}
function applyText() {
  if (busy) return;
  const text = $("goal").value;
  const codes = [
    ...new Set(
      [...text.matchAll(/\b([A-Z]{2,5})\s*(\d{4})\b/gi)].map(
        (m) => m[1].toUpperCase() + " " + m[2],
      ),
    ),
  ];
  const unsupported = codes.filter((id) => !P.SUPPORTED.includes(id));
  if (unsupported.length) {
    $("result").textContent =
      `${unsupported.join(", ")} is outside this Fall 2026 demo catalog. ECON 3140 was not returned by Cornell for this term. Choose from the six listed offerings.`;
    return;
  }
  if (!codes.length) {
    $("result").textContent =
      "Include course codes such as CS 3110. This is a limited text parser, not an AI chat.";
    return;
  }
  if (codes.length > 4) {
    $("result").textContent = "Choose at most four courses for this demo.";
    return;
  }
  const range = text.match(/\b(\d+)\s*[-–]\s*(\d+)\s*credits?/i),
    exact = text.match(/\b(\d+)[ -]credits?/i);
  for (const c of document.querySelectorAll("[name=course]"))
    c.checked = codes.includes(c.value);
  if (range) {
    $("min").value = range[1];
    $("max").value = range[2];
  } else if (exact) {
    $("min").value = $("max").value = exact[1];
  }
  $("early").checked = /before 10|after 10|avoid early/i.test(text);
  $("friday").checked = /friday.*free|free.*friday/i.test(text);
  markDirty();
  $("result").textContent =
    "Applied the listed course codes, credit bounds, and recognized preferences. Review the controls, then generate schedules.";
}
function render() {
  const p = plans[selected],
    same =
      p &&
      approved &&
      P.signature(p) === P.signature(approved) &&
      JSON.stringify(plannedGoals) === JSON.stringify(approvedGoals) &&
      approvedSnapshot === snapshot?.retrievedAt,
    approvedCheck =
      approved && P.validate(approved, approvedGoals, catalog, closed);
  $("tabs").innerHTML = plans
    .slice(0, 3)
    .map(
      (_, i) =>
        `<button class="${i === selected ? "selected" : ""}" data-plan="${i}" ${busy ? "disabled" : ""}>${i === 0 ? "Recommended" : "Backup " + i}</button>`,
    )
    .join("");
  document.querySelectorAll("[data-plan]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = +b.dataset.plan;
        $("review").checked = false;
        render();
      }),
  );
  $("credits").textContent = p
    ? p.reduce((n, c) => n + c.bundle.credits, 0)
    : "—";
  $("course-count").textContent = p ? p.length : "—";
  $("conflicts").textContent = p ? "0" : "—";
  const pref = p ? P.preferences(p, plannedGoals) : null;
  $("score").textContent = p ? pref.penalty : "—";
  $("status").textContent = busy
    ? "Working…"
    : dirty
      ? "Goals changed"
      : !p
        ? "No feasible plan"
        : same
          ? approvedCheck.ok
            ? "Approved for planning"
            : "Approved plan affected"
          : "Review proposal";
  $("approve").disabled = busy || dirty || !p || same || !$("review").checked;
  $("approve").textContent = same
    ? "Plan approved"
    : approved
      ? "Approve replacement"
      : "Approve plan";
  $("generate").disabled = busy || !snapshot;
  $("simulate").disabled =
    busy || dirty || !approved || !same || !approvedCheck?.ok;
  $("refresh").disabled = busy;
  $("validation").textContent = p
    ? "Times, credits, section bundles & observed status checked."
    : "No feasible proposal to approve.";
  $("tradeoffs").textContent = p
    ? [
        plannedGoals.early ? `${pref.early} meeting(s) before 10am` : null,
        plannedGoals.friday
          ? `${pref.friday} Friday afternoon meeting(s)`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") + " — preferences are optimized, not guaranteed."
    : "";
  renderCalendar(p);
  $("courses").innerHTML = p
    ? p
        .map((item, i) => {
          const c = catalog.find((c) => c.id === item.id);
          return `<details class="course-detail"><summary><span class="dot ${colors[i]}"></span><b>${esc(item.id)}</b> · ${item.bundle.credits} credits <span>${esc(item.bundle.sections.map((s) => s.label).join(" + "))}</span></summary><h3>${esc(c.title)}</h3><p><b>Prerequisites:</b> ${esc(c.prereq || "Not specified in the response; verify in Cornell’s roster.")}</p><p><b>Corequisites:</b> ${esc(c.coreq || "Not specified in the response.")}</p><p><b>Enrollment priority:</b> ${esc(c.priority || "Review section restrictions in the roster.")}</p>${item.bundle.sections.map((s) => `<p>${esc(s.label)} · Class ${s.id} · observed status O (open)<br>${s.meetings.map((m) => `${m.pattern} ${labelTime(m.start)}–${labelTime(m.end)} · ${new Date(m.from).toLocaleDateString("en-US", { timeZone: "UTC" })}–${new Date(m.to).toLocaleDateString("en-US", { timeZone: "UTC" })}`).join("<br>")}<br>${esc(s.consent || "")}</p>`).join("")}<a target="_blank" rel="noopener" href="https://classes.cornell.edu/browse/roster/FA26/class/${encodeURIComponent(item.id.split(" ")[0])}/${item.id.split(" ")[1]}">Check Cornell roster ↗</a></details>`;
        })
        .join("")
    : "";
  $("approved-record").hidden = !approved;
  if (approved) {
    $("approved-state").textContent = approvedCheck.ok
      ? "Recorded plan — still feasible against loaded data"
      : "Recorded plan — needs replanning";
    $("approved-list").textContent = sectionText(approved);
    const options = approved.flatMap((c) =>
      c.bundle.sections.map((s) => ({ c, s })),
    );
    const old = $("closure-section").value;
    $("closure-section").innerHTML = options
      .map(
        ({ c, s }) =>
          `<option value="${s.id}">${esc(c.id + " " + s.label)}</option>`,
      )
      .join("");
    const pick =
      options.find((x) => x.s.id === old) ||
      options.find((x) => x.c.id === "CS 3110" && x.s.component === "DIS") ||
      options[0];
    $("closure-section").value = pick.s.id;
  }
  $("diff").innerHTML = "";
  if (p && approved && !same) {
    const diff = p
      .map((c) => {
        const old = approved.find((o) => o.id === c.id);
        return !old || old.bundle.key !== c.bundle.key
          ? `<li><b>${esc(c.id)}</b>: ${esc(old?.bundle.sections.map((s) => s.label).join(" + ") || "not in previous plan")} → ${esc(c.bundle.sections.map((s) => s.label).join(" + "))}</li>`
          : "";
      })
      .join("");
    $("diff").innerHTML =
      `<b>Changes from your recorded plan</b><ul>${diff || "<li>Section choices unchanged; goals or data updated.</li>"}</ul><p>${P.changes(p, approved)} changed section(s). Your recorded plan is retained until approval.</p>`;
  }
}
function renderCalendar(plan) {
  const all = (plan || []).flatMap((c, i) =>
    c.bundle.sections.flatMap((s) =>
      s.meetings.map((m) => ({
        ...m,
        id: c.id,
        label: s.label,
        color: colors[i],
      })),
    ),
  );
  const start = Math.min(480, ...all.map((m) => Math.floor(m.start / 60) * 60)),
    end = Math.max(1080, ...all.map((m) => Math.ceil(m.end / 60) * 60));
  const px = 0.9;
  const days = all.some((m) => m.days.some((d) => d > 4)) ? 7 : 5;
  $("calendar").style.gridTemplateColumns =
    `52px repeat(${days},minmax(74px,1fr))`;
  $("calendar").style.height = (end - start) * px + 30 + "px";
  $("calendar").innerHTML =
    `<div class="times">${Array.from({ length: (end - start) / 60 }, (_, i) => `<div style="height:${60 * px}px">${labelTime(start + i * 60)}</div>`).join("")}</div>` +
    ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
      .slice(0, days)
      .map(
        (day, d) =>
          `<div class="day" style="background-size:100% ${60 * px}px"><div class="day-head">${day}</div>${all
            .filter((m) => m.days.includes(d))
            .map(
              (m) =>
                `<div class="event ${m.color}" style="top:${(m.start - start) * px}px;height:${(m.end - m.start) * px}px" title="${esc(m.id + " " + m.label + " " + labelTime(m.start) + "–" + labelTime(m.end))}"><b>${esc(m.id)}</b><small>${esc(m.label)}<br>${labelTime(m.start)}–${labelTime(m.end)}</small></div>`,
            )
            .join("")}</div>`,
      )
      .join("");
}
function approve() {
  if (busy || dirty || !$("review").checked || !plans[selected]) return;
  const p = plans[selected],
    v = P.validate(p, plannedGoals, catalog, closed);
  if (!v.ok) {
    $("result").textContent = v.errors.join(". ");
    return;
  }
  approved = structuredClone(p);
  approvedGoals = structuredClone(plannedGoals);
  approvedSnapshot = snapshot.retrievedAt;
  log(
    "Plan approved for this session",
    `${v.credits} credits · ${p.length} courses. No enrollment was performed.`,
  );
  $("result").textContent =
    "Plan recorded for this browser session. Select a section below to simulate its closure.";
  render();
}
const availability = new EventTarget();
availability.addEventListener("section-closed", (event) => {
  closed.add(event.detail.id);
  log(
    "Simulated availability event",
    event.detail.label +
      " is now treated as closed. Cornell’s data is unchanged.",
  );
  log(
    "Searching replacement bundles",
    "Keeping the approved goals; ranking by section changes, then preference violations.",
  );
  generate();
  if (plans.length)
    log(
      "Replacement ready",
      `${P.changes(plans[0], approved)} changed section(s). Awaiting your review.`,
    );
  else
    log(
      "No replacement found",
      "The recorded plan remains visible; no invalid proposal will be approved.",
    );
  render();
});
function simulate() {
  if ($("simulate").disabled) return;
  const id = $("closure-section").value;
  const c = approved.find((c) => c.bundle.sections.some((s) => s.id === id));
  availability.dispatchEvent(
    new CustomEvent("section-closed", {
      detail: {
        id,
        label: c.id + " " + c.bundle.sections.find((s) => s.id === id).label,
      },
    }),
  );
}
function sourceLabel(mode) {
  $("data-source").textContent =
    `${mode} · Fall 2026 · retrieved ${new Date(snapshot.retrievedAt).toLocaleString()} · all times Eastern`;

}
async function loadSnapshot() {
  try {
    const r = await fetch("data/cornell-fa26.json");
    if (!r.ok) throw Error("Snapshot unavailable");
    snapshot = await r.json();
    catalog = P.normalize(snapshot.courses);
    renderPicker();
    for (const c of document.querySelectorAll("[name=course]"))
      c.checked = ["CS 3110", "CS 2800", "MATH 2940", "ECON 3040"].includes(
        c.value,
      );
    sourceLabel("Bundled Cornell API snapshot");
    log(
      "Cornell snapshot loaded",
      "Real offerings, section meetings, credits, and observed availability.",
    );
    generate();
  } catch (e) {
    $("result").textContent =
      "Could not load the bundled Cornell snapshot. Select Refresh Cornell data to try the live API.";
    log("Data unavailable", e.message);
    render();
  }
}
let nextRequest = 0;
async function refresh() {
  if (busy) return;
  setBusy(true);
  log(
    "Refreshing Cornell data",
    "Loading CS, ECON and MATH sequentially, at most one request per second.",
  );
  const loaded = [];
  try {
    for (const subject of ["CS", "ECON", "MATH"]) {
      await new Promise((r) =>
        setTimeout(r, Math.max(0, nextRequest - Date.now())),
      );
      nextRequest = Date.now() + 1100;
      const r = await fetch(
        `https://classes.cornell.edu/api/2.0/search/classes.json?roster=FA26&subject=${subject}`,
        { signal: AbortSignal.timeout(15000) },
      );
      if (!r.ok) throw Error(`Cornell returned HTTP ${r.status}`);
      const payload = await r.json();
      if (payload.status !== "success" || !Array.isArray(payload.data?.classes))
        throw Error("Cornell returned an unexpected response");
      loaded.push(
        ...payload.data.classes.filter((c) =>
          P.SUPPORTED.includes(c.subject + " " + c.catalogNbr),
        ),
      );
      log(
        subject + " loaded",
        `${payload.data.classes.length} offerings inspected.`,
      );
    }
    if (!loaded.length) throw Error("No supported offerings were returned");
    snapshot = {
      roster: "FA26",
      retrievedAt: new Date().toISOString(),
      courses: loaded,
    };
    catalog = P.normalize(loaded);
    renderPicker();
    sourceLabel("Refreshed directly from Cornell");
    dirty = true;
    setBusy(false);
    generate();
    log(
      "Refresh complete",
      "Proposals revalidated. Simulated closures remain active until reset.",
    );
  } catch (e) {
    log("Refresh could not finish", e.message);
    setBusy(false);
    $("result").textContent =
      `Refresh failed: ${e.message}. ${snapshot ? "The previous timestamped snapshot is retained; no partial update was applied." : "No course data is available yet."}`;
  }
}
function reset() {
  if (busy) return;
  closed.clear();
  approved = null;
  approvedGoals = null;
  approvedSnapshot = null;
  $("review").checked = false;
  for (const c of document.querySelectorAll("[name=course]"))
    c.checked = ["CS 3110", "CS 2800", "MATH 2940", "ECON 3040"].includes(
      c.value,
    );
  $("min").value = $("max").value = 16;
  $("early").checked = $("friday").checked = true;
  log(
    "Demo reset",
    "Cleared approvals and simulated closures; retained the loaded Cornell snapshot.",
  );
  generate();
}
$("generate").onclick = generate;
$("apply-text").onclick = applyText;
$("approve").onclick = approve;
$("simulate").onclick = simulate;
$("reset").onclick = reset;
$("refresh").onclick = refresh;
$("review").onchange = render;
for (const id of ["min", "max", "early", "friday"]) $(id).onchange = markDirty;
document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      const v = b.dataset.view;
      $("planner").hidden = v !== "planner";
      $("roadmap").hidden = v !== "roadmap";
      $("crumb").textContent =
        v === "planner" ? "SEMESTER PLANNER" : "PROJECT ROADMAP";
      document
        .querySelectorAll("[data-view]")
        .forEach((n) => n.classList.toggle("active", n === b));
    }),
);
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: "get_schedule_state",
        description:
          "Read the current CoursePilot proposal, recorded plan, data timestamp, and simulated closures.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: (input) => {
          if (input && Object.keys(input).length)
            throw Error("No arguments accepted");
          return {
            roster: "FA26",
            retrievedAt: snapshot?.retrievedAt,
            proposal: plans[selected] ? sectionText(plans[selected]) : null,
            approved: approved ? sectionText(approved) : null,
            dirty,
            simulatedClosedSections: [...closed],
            academicEligibility: "requires human review",
          };
        },
      }),
    ).catch(() => {});
  } catch {}
}
loadSnapshot();
