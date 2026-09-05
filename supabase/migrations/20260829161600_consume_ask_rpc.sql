-- Atomic ask metering (3 questions = 1 credit). The Python path used to
-- ensure + read ask_units + consume/set_ask_units across separate RPCs, so
-- concurrent chat requests could under-charge. Lock the row via
-- ensure_user_credits, then increment or debit in one UPDATE.
-- ask_units >= 2 matches ASKS_PER_CREDIT - 1 and CHECK (ask_units <= 2).

CREATE OR REPLACE FUNCTION public.consume_ask(p_user UUID)
RETURNS TABLE (
  ok                 BOOLEAN,
  consumed_credit    BOOLEAN,
  previous_ask_units INTEGER,
  user_id            UUID,
  balance            INTEGER,
  monthly_allowance  INTEGER,
  period_start       TIMESTAMP WITH TIME ZONE,
  ask_units          INTEGER,
  updated_at         TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  rec RECORD;
  prev_units INTEGER;
BEGIN
    SELECT * INTO rec FROM public.ensure_user_credits(p_user);
    prev_units := rec.ask_units;

    IF rec.balance < 1 THEN
        RETURN QUERY SELECT
          false,
          false,
          prev_units,
          rec.user_id,
          rec.balance,
          rec.monthly_allowance,
          rec.period_start,
          rec.ask_units,
          rec.updated_at;
        RETURN;
    END IF;

    IF rec.ask_units >= 2 THEN
        UPDATE public.user_credits AS uc
        SET
          balance = uc.balance - 1,
          ask_units = 0,
          updated_at = TIMEZONE('utc'::text, NOW())
        WHERE uc.user_id = p_user
        RETURNING * INTO rec;

        RETURN QUERY SELECT
          true,
          true,
          prev_units,
          rec.user_id,
          rec.balance,
          rec.monthly_allowance,
          rec.period_start,
          rec.ask_units,
          rec.updated_at;
        RETURN;
    END IF;

    UPDATE public.user_credits AS uc
    SET
      ask_units = uc.ask_units + 1,
      updated_at = TIMEZONE('utc'::text, NOW())
    WHERE uc.user_id = p_user
    RETURNING * INTO rec;

    RETURN QUERY SELECT
      true,
      false,
      prev_units,
      rec.user_id,
      rec.balance,
      rec.monthly_allowance,
      rec.period_start,
      rec.ask_units,
      rec.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ask(UUID) TO authenticated;
