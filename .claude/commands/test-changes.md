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

## Report back

After both stages complete, give the user a short combined summary:
- What changed and which test file(s) now cover it.
- The verifier's verdict (trustworthy / partially trustworthy / not trustworthy) and any
  findings it raised, with file:line.
- Any coverage gaps either agent flagged.
- If the verifier found real problems, say so plainly and ask whether to send it back to
  `test-writer` for a fix — don't silently loop, and don't declare success over an untrustworthy
  verdict.

Do not write or edit any test or production code yourself in this command — all test writing
goes through `test-writer`, all judgment of test quality goes through `test-verifier`. Your job
here is only to orchestrate and summarize.
