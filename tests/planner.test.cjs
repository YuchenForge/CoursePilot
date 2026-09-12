const { test } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../dist/planner.js");
const data = require("../dist/data/cornell-fa26.json");
const catalog = P.normalize(data.courses);
const goals = {
  courses: ["CS 3110", "CS 2800", "MATH 2940", "ECON 3040"],
  min: 16,
  max: 16,
  early: true,
  friday: true,
};
test("real Cornell snapshot produces independently valid complete enrollment bundles", () => {
  const r = P.generate(catalog, goals);
  assert(r.feasible > 0);
  assert(!r.truncated);
  for (const p of r.plans) {
    assert(P.validate(p, goals, catalog).ok);
    assert.equal(
      p.reduce((n, c) => n + c.bundle.credits, 0),
      16,
    );
    for (const c of p) {
      assert.deepEqual(c.bundle.sections.map((s) => s.component).sort(), [
        "DIS",
        "LEC",
      ]);
      assert(c.bundle.sections.every((s) => s.status === "O"));
    }
  }
  assert(
    P.preferences(r.plans[0], goals).friday > 0,
    "required CS 3110 lecture really meets Friday afternoon",
  );
});
test("closing one CS discussion preserves old approval and produces minimum section change", () => {
  const baseline = P.generate(catalog, goals).plans[0];
  const saved = JSON.stringify(baseline);
  const closedId = baseline
    .find((c) => c.id === "CS 3110")
    .bundle.sections.find((s) => s.component === "DIS").id;
  const closed = new Set([closedId]);
  const r = P.generate(catalog, goals, closed, baseline);
  assert(r.plans.length);
  assert.equal(P.changes(r.plans[0], baseline), 1);
  assert(!P.validate(baseline, goals, catalog, closed).ok);
  assert(P.validate(r.plans[0], goals, catalog, closed).ok);
  assert.equal(JSON.stringify(baseline), saved);
});
test("closing the only required CS lecture returns no proposal", () => {
  const baseline = P.generate(catalog, goals).plans[0];
  const id = baseline
    .find((c) => c.id === "CS 3110")
    .bundle.sections.find((s) => s.component === "LEC").id;
  assert.equal(
    P.generate(catalog, goals, new Set([id]), baseline).plans.length,
    0,
  );
});
test("impossible credit bounds, unsupported courses, and no selection are handled", () => {
  assert.equal(
    P.generate(catalog, { ...goals, min: 15, max: 15 }).plans.length,
    0,
  );
  assert.throws(
    () => P.generate(catalog, { ...goals, min: 20, max: 10 }),
    /credit range/,
  );
  assert.throws(
    () => P.generate(catalog, { ...goals, courses: ["ECON 3140"] }),
    /not in/,
  );
  assert.throws(
    () => P.generate(catalog, { ...goals, courses: [] }),
    /one and four/,
  );
});
test("course choices affect the result instead of retaining a fixed four-course plan", () => {
  const g = { ...goals, courses: ["CS 3110"], min: 4, max: 4 };
  const r = P.generate(catalog, g);
  assert(r.plans.length);
  assert.equal(r.plans[0].length, 1);
  assert(P.validate(r.plans[0], g, catalog).ok);
});
test("adjacent times and nonoverlapping date ranges do not conflict", () => {
  const a = { days: [0], start: 600, end: 660, from: 0, to: 10 };
  assert(!P.overlap(a, { ...a, start: 660, end: 700 }));
  assert(!P.overlap(a, { ...a, days: [1] }));
  assert(!P.overlap(a, { ...a, from: 11, to: 20 }));
  assert(P.overlap(a, { ...a, start: 659, end: 700 }));
  assert.equal(P.minutes("12:00AM"), 0);
  assert.equal(P.minutes("12:00PM"), 720);
  assert.equal(P.minutes("01:25PM"), 805);
  assert.equal(P.minutes("TBA"), null);
});
test("validator rejects a forged bundle, missing course, and stale roster status", () => {
  const p = P.generate(catalog, goals).plans[0];
  const forged = structuredClone(p);
  forged[0].bundle.credits = 5;
  assert(!P.validate(forged, goals, catalog).ok);
  assert(!P.validate(p.slice(1), goals, catalog).ok);
  const changed = structuredClone(catalog);
  const b = changed
    .find((c) => c.id === p[0].id)
    .bundles.find((b) => b.key === p[0].bundle.key);
  b.sections[0].status = "C";
  assert(!P.validate(p, goals, changed).ok);
});
test("unknown meetings and unsupported link rules cannot silently become valid bundles", () => {
  const c = structuredClone(
    data.courses.find((c) => c.subject === "CS" && c.catalogNbr === "3110"),
  );
  c.enrollGroups[0].classSections.find(
    (s) => s.ssrComponent === "LEC",
  ).meetings[0].timeStart = "";
  assert.equal(P.normalize([c])[0].bundles.length, 0);
  c.enrollGroups[0].simpleCombinations = [{ unknown: true }];
  assert.equal(P.normalize([c])[0].bundles.length, 0);
  assert(P.normalize([c])[0].exclusions.length);
});
test("same-group linkage is preserved for an offering with multiple enrollment groups", () => {
  const course = catalog.find((c) => c.id === "ECON 3030");
  const raw = data.courses.find(
    (c) => c.subject === "ECON" && c.catalogNbr === "3030",
  );
  assert(raw.enrollGroups.length > 1);
  for (const b of course.bundles)
    assert(
      b.sections.every((s) =>
        raw.enrollGroups[b.group].classSections.some(
          (raw) => String(raw.classNbr) === s.id,
        ),
      ),
    );
});
