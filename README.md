# CoursePilot — real Cornell data demo

Fall 2026 course planning with Cornell Class Roster v2.0. No dependencies or build step.

## Run

Serve `dist/` over HTTP (for example `python3 -m http.server 4173 --directory dist`). Run `node --test tests/planner.test.cjs` to check the planning engine.

## Demonstration

1. Start with CS 3110, CS 2800, MATH 2940, and ECON 3040: 16 credits.
2. Compare recommended/backup schedules and their preference misses. Required Friday meetings are honestly reported.
3. Expand course details to inspect academic requirements and Cornell source links.
4. Acknowledge review and approve a planning choice.
5. Close the selected CS 3110 discussion using the simulation control. Review a minimum-change proposal and approve it.
6. Close the CS 3110 lecture to demonstrate the no-alternative state. The old recorded plan remains visible and marked affected.
7. Reset to repeat. Refresh Cornell data when connected; the data timestamp identifies the loaded snapshot.

## Real versus simulated

Real: course titles, credit values from enrollment groups, required lecture/discussion components, every meeting pattern, prerequisite/corequisite text, and section `openStatus` from Cornell. Manual refresh makes three direct browser requests; Cornell supplies CORS access. Requests are sequential and at least 1.1 seconds apart within the page. This is a single-user demo, not a shared production request gateway.

Simulated: closure events are a local override. There is no polling, background monitoring, LLM, Student Center enrollment, account system, transcript verification, or degree audit. Approval is a current-page planning record, lost on reload. No user data is sent to Cornell; requests contain only term and subject.

Prerequisites and enrollment restrictions require manual review. The engine checks scheduling feasibility, not academic eligibility or permission to enroll. Status `O` is accepted as observed open; other/unknown statuses are excluded. Seats are never reserved. Fall 2026 does not return ECON 3140; the demo substitutes ECON 3040 explicitly.

## Correctness boundaries

One to four selected courses from six supported offerings. Preserve enrollment groups and choose exactly one section for every required component. Exclude groups with special `simpleCombinations`, variable credits, non-Ithaca sections, and unknown meeting times/dates rather than guessing. Check internal and cross-course time/date conflicts. Credits count once per course. Independent validation checks every final proposal against the loaded source bundles. Rank replacements by changed section count, then preference misses; retain up to 20 candidates and display three. The search has a 150,000-state limit and reports truncation. Section labels and all course content are escaped before rendering.

`dist/data/cornell-fa26.json` is the timestamped fallback from real API responses. `scripts/refresh-snapshot.py` can regenerate it atomically, with throttling. Failed in-page refreshes retain the previous full snapshot, without partially applying new data. Editing controls makes the proposal dirty and disables approval until regeneration. Replacements do not overwrite the recorded plan before approval.

Next MVP: a 3-week path to an AI agent counselor—Week 1 academic foundation, Week 2 conversational agent, Week 3 counselor wired to the existing planner. See `dist/roadmap.md`.
