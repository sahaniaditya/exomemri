-- Remove the daily review queue. The product no longer surfaces review items
-- or a "due for review" session; coverage/study-plan gaps remain.

DROP TABLE IF EXISTS public.review_items;

ALTER TABLE public.sources
  DROP COLUMN IF EXISTS review_items_extracted_at;
