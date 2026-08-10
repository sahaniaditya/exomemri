---
description: Write tests for the current changes (or a given feature/PR/branch), then independently verify those tests are trustworthy.
argument-hint: "[optional: PR number, branch, path, or feature description — defaults to current diff]"
---

Run the two-stage test pipeline for the change described below (or the current git diff /
staged changes if nothing is specified):

**Target:** $ARGUMENTS

## Stage 1 — write tests

Dispatch the `test-writer` subagent with the target above. Give it enough context to be
self-contained: what changed, where (paths if known), and whether this is a new feature, a
refactor, or a bug fix. Wait for it to finish before moving to stage 2 — stage 2 needs its
actual output, not a guess.

## Stage 2 — verify the tests

Dispatch the `test-verifier` subagent, pointed at the same target and at the specific test
file(s) the `test-writer` subagent reported creating or modifying. It must independently run
those tests and judge whether they're real coverage, not rubber-stamp them.

## Stage 3 — clean up

Once (and only once) the verifier's verdict is trustworthy, delete the test file(s) that
`test-writer` created or modified for this run, along with any test-only scaffolding it added
solely to support them (e.g. a new test config file, a new setup file) — but leave alone
anything that predates this run or that other existing tests still depend on. If the verifier's
verdict is not trustworthy, do not delete anything yet — leave the files in place until fixed.

## Report back

After all stages complete, give the user a short combined summary:
- What changed and which test file(s) covered it (now deleted per stage 3, or still present if
  the verdict wasn't trustworthy).
- The verifier's verdict (trustworthy / partially trustworthy / not trustworthy) and any
  findings it raised, with file:line.
- Any coverage gaps either agent flagged.
- If the verifier found real problems, say so plainly and ask whether to send it back to
  `test-writer` for a fix — don't silently loop, and don't declare success over an untrustworthy
  verdict, and don't run stage 3 in that case.

Do not write or edit any test or production code yourself in this command — all test writing
goes through `test-writer`, all judgment of test quality goes through `test-verifier`. Your job
here is only to orchestrate, clean up per stage 3, and summarize.
