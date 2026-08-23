-- Daily study streaks: a lean, denormalized counter on `profiles` rather than
-- a computed-on-read aggregate. Unlike review/coverage/plan (space-scoped),
-- a streak is scoped to the user across every space, so it's cheap to update
-- incrementally on the two actions that already carry a user-scoped
-- timestamp (a capture, a review mark) rather than scanning multiple tables
-- across all of a user's spaces on every read.
--
-- last_active_date is nullable — NULL means "never active," distinct from a
-- 0-day streak. Three tightly-coupled fields kept together on `profiles`
-- rather than split into their own table for a Later-priority feature; note
-- for future reviewers that this brings `profiles` to 11 columns.

ALTER TABLE public.profiles
  ADD COLUMN current_streak   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN longest_streak   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_active_date DATE;
