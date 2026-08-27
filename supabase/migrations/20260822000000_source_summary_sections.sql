-- Structured 4-part summary (TL;DR bullets, key concepts, examples, interview
-- points) alongside the existing prose summary_text. summary_text stays as a
-- flattened rendering so chat grounding keeps working unchanged.

ALTER TABLE public.sources
  ADD COLUMN summary_sections JSONB;
