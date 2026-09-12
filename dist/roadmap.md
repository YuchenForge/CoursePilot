# CoursePilot — 3-week AI counselor roadmap

## Product vision

Help students understand their academic options, make informed decisions, and adapt their plans over time. Counseling is the primary experience; course search, academic-rule checks, and schedule generation are tools the agent uses.

**Final product (end of week 3):** a bounded tool-calling AI agent counselor for Cornell Engineering Computer Science—one program, one semester—that can explain standing, recommend next courses with sources, and hand off to a validated, approvable schedule.

## Current foundation (today)

The existing demo uses real Fall 2026 Cornell offerings, a dated fallback snapshot, manual API refresh, complete supported section bundles, time/credit/observed-availability checks, backup comparison, session-only approval, and simulated closure-triggered replanning. It does not yet include an LLM, academic-rule engine, degree audit, durable student records, or enrollment integration.

## Week 1 — Know the student and the rules

Build the academic ground truth the agent will trust. Model a narrow, sourced slice of Cornell Engineering CS requirements and connect it to a simple student profile.

- Catalog-year-aware student profile (completed courses, goals, interests)
- Verified prerequisite and degree-rule snippets with official sources
- Explicit missing-data and uncertainty handling
- Deterministic “Where do I stand?” progress view

**End of week:** Explain completed vs. remaining requirements for one program, with sources and unresolved questions.

## Week 2 — Ship the conversational counselor

Give advice with reasons. Build a tool-calling agent that clarifies goals, consults Week 1 tools and roster data, and compares options before recommending.

- Clarify → consult → compare → explain conversation loop
- Follow-up questions that resolve missing context
- Source-backed, personalized next-course recommendations
- Bounded tool calls and transparent action summaries

**End of week:** A working counselor chat that answers “What should I take next semester, and why?” with a supported recommendation for a demo student profile.

## Week 3 — Counselor meets the planner (final product)

Turn a counseling decision into an approvable semester. Wire the existing schedule engine as an agent tool so advice becomes a reviewable calendar, alternatives, and student approval.

- Conversation → validated section combinations → calendar handoff
- Workload preferences and requirement coverage in generated plans
- Reuse backup comparison and closure replanning as counselor tools
- Evaluation suite, uncertainty surfacing, and advisor-escalation stubs

**Final product milestone:** End-to-end AI agent counselor—chat, recommend, schedule, and approve—for one program and one semester.

## What the week-3 counselor answers

1. **Where do I stand?** Summarize completed courses and remaining requirements.
2. **What should I take next?** Recommend courses based on requirements, interests, and prerequisites.
3. **Why this option?** Explain benefits, tradeoffs, and supporting sources.
4. **What happens if something changes?** Reassess the plan and propose alternatives.

Success means a student can open a conversation, get a sourced recommendation, generate a conflict-free schedule, and approve a plan—without claiming graduation certification or enrollment authority.

## Agent workflow

Understand the student → clarify missing information → consult official sources and tools → compare options → validate the plan → explain recommendations → request approval → remember the decision.

Use tools for course search, student profile retrieval, requirement progress, prerequisite checks, schedule generation, and validation. The LLM chooses appropriate actions and explains results. Tool outputs establish factual and scheduling constraints. Bound run duration and tool usage, retain source provenance, and surface uncertainty.

## Intended experience

Center the interface on a conversation alongside an academic profile and recommendation panel. Open the calendar when planning a semester. Show the reasons, sources, assumptions, and tradeoffs behind advice. Retain approved decisions separately from new proposals.

## Architecture direction

- Frontend: conversation, profile, recommendations, and the existing calendar/planning surface.
- Backend: typed academic and planning tools with authenticated, per-student access (minimal auth acceptable for the week-3 demo).
- Storage: student profiles, consented counseling context, source snapshots; durable accounts can follow after week 3.
- Academic knowledge: official Cornell sources and reviewed rules linked to the student's program and catalog year.
- Agent: native tool calling with bounded execution and source-backed explanations.
- Replanning: availability or goal-change events, deterministic validation, and explicit approval before applying replacements.

## Evaluation and boundaries

- Check factual recommendations against official sources; report unsupported or missing information explicitly.
- Independently validate every proposed schedule and every modeled requirement result.
- Distinguish future offering assumptions from confirmed course availability.
- Preserve approved plans until the student accepts a replacement; reject stale proposals after goal changes.
- Send exceptions, transfer-credit decisions, and unclear policies to a human advisor with a concise source-linked summary.
- Do not claim the AI can certify graduation eligibility or grant enrollment permission.
- Limit stored student information to what is needed, provide privacy/deletion controls, and avoid sensitive records in logs.
- Evaluate with representative student scenarios, including infeasible schedules, incomplete profiles, conflicting sources, unavailable courses, and advisor escalation.

## After week 3 (not required to ship)

- Persistent accounts, versioned goals, and proactive availability monitoring
- Multi-semester path comparison and graduation-timeline exploration
- Broader student pilot and richer advisor handoff packets

“Counselor” means academic guidance in this project. Career exploration may be added later. Comprehensive multi-major coverage, enrollment automation, and official academic determinations remain outside the first ship.
