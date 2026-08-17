---
description: Write missing backend test coverage for changed files, run the backend test suite, and report a pass/fail result.
argument-hint: [optional git ref to diff against, defaults to working tree changes]
---

Test the backend against current changes and report the result.

1. Determine the changed backend files:
   ```bash
   git status --porcelain -- backend/app
   git diff --name-only ${ARGUMENTS:-HEAD} -- backend/app
   ```
   Combine both (uncommitted + committed-since-ref) into one list of changed
   paths under `backend/app`. If nothing changed under `backend/app`, say so
   and stop — don't run the suite for no reason.

2. Launch the `backend-test-writer` agent (fresh agent, not a fork) with the
   changed file list and, if useful, the actual diff (`git diff ${ARGUMENTS:-HEAD} -- backend/app`).
   Tell it explicitly which files changed and ask it to add/update pytest
   coverage in `backend/app/tests/` for the behavior those changes introduce,
   per its own instructions. Wait for it to finish before proceeding — the
   runner needs whatever new tests it writes.

3. Launch the `backend-test-runner` agent with the same changed file list
   (plus any test files the writer agent touched) and ask it to run the
   targeted tests, then the full suite, then ruff, and report a verdict.

4. Relay the runner agent's verdict to the user as the final answer:
   - What changed (file list, one line).
   - What test coverage was added/updated (from the writer agent's report).
   - Pass/fail result, counts, and ruff status (from the runner agent's
     report).
   - If anything failed, the concrete root causes it identified — don't just
     say "some tests failed."

If the writer agent reports it couldn't reasonably test something, include
that as a caveat rather than silently dropping it.
