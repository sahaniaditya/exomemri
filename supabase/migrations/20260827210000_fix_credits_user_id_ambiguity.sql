-- RETURNS TABLE column names become PL/pgSQL variables. Unqualified
-- user_id / balance in INSERT/UPDATE then raise 42702 ambiguous reference.
-- Prefer table columns so the RPC contract (same OUT names) stays unchanged.

CREATE OR REPLACE FUNCTION public.ensure_user_credits(p_user UUID)
RETURNS TABLE (
  user_id           UUID,
  balance           INTEGER,
  monthly_allowance INTEGER,
  period_start      TIMESTAMP WITH TIME ZONE,
  ask_units         INTEGER,
  updated_at        TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  rec public.user_credits%ROWTYPE;
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user THEN
        RAISE EXCEPTION 'not authorized to access credits for another user';
    END IF;

    INSERT INTO public.user_credits (user_id)
    VALUES (p_user)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO rec
    FROM public.user_credits
    WHERE public.user_credits.user_id = p_user
    FOR UPDATE;

    -- One refill even if several months elapsed — leftovers never stack.
    IF rec.period_start + INTERVAL '1 month' <= TIMEZONE('utc'::text, NOW()) THEN
        WHILE rec.period_start + INTERVAL '1 month' <= TIMEZONE('utc'::text, NOW()) LOOP
            rec.period_start := rec.period_start + INTERVAL '1 month';
        END LOOP;
        rec.balance := rec.monthly_allowance;
        rec.ask_units := 0;

        UPDATE public.user_credits
        SET
          balance = rec.balance,
          ask_units = rec.ask_units,
          period_start = rec.period_start,
          updated_at = TIMEZONE('utc'::text, NOW())
        WHERE public.user_credits.user_id = p_user
        RETURNING * INTO rec;
    END IF;

    RETURN QUERY SELECT
      rec.user_id,
      rec.balance,
      rec.monthly_allowance,
      rec.period_start,
      rec.ask_units,
      rec.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_credits(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.consume_credits(p_user UUID, p_amount INTEGER)
RETURNS TABLE (
  ok                BOOLEAN,
  user_id           UUID,
  balance           INTEGER,
  monthly_allowance INTEGER,
  period_start      TIMESTAMP WITH TIME ZONE,
  ask_units         INTEGER,
  updated_at        TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  rec RECORD;
BEGIN
    IF p_amount < 1 THEN
        RAISE EXCEPTION 'credit consume amount must be positive';
    END IF;

    SELECT * INTO rec FROM public.ensure_user_credits(p_user);

    IF rec.balance < p_amount THEN
        RETURN QUERY SELECT
          false,
          rec.user_id,
          rec.balance,
          rec.monthly_allowance,
          rec.period_start,
          rec.ask_units,
          rec.updated_at;
        RETURN;
    END IF;

    RETURN QUERY
    UPDATE public.user_credits AS uc
    SET
      balance = uc.balance - p_amount,
      updated_at = TIMEZONE('utc'::text, NOW())
    WHERE uc.user_id = p_user
    RETURNING
      true,
      uc.user_id,
      uc.balance,
      uc.monthly_allowance,
      uc.period_start,
      uc.ask_units,
      uc.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_credits(UUID, INTEGER) TO authenticated;


CREATE OR REPLACE FUNCTION public.grant_credits(p_user UUID, p_amount INTEGER)
RETURNS TABLE (
  user_id           UUID,
  balance           INTEGER,
  monthly_allowance INTEGER,
  period_start      TIMESTAMP WITH TIME ZONE,
  ask_units         INTEGER,
  updated_at        TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    IF p_amount < 1 THEN
        RAISE EXCEPTION 'credit grant amount must be positive';
    END IF;

    PERFORM public.ensure_user_credits(p_user);

    RETURN QUERY
    UPDATE public.user_credits AS uc
    SET
      balance = uc.balance + p_amount,
      updated_at = TIMEZONE('utc'::text, NOW())
    WHERE uc.user_id = p_user
    RETURNING
      uc.user_id,
      uc.balance,
      uc.monthly_allowance,
      uc.period_start,
      uc.ask_units,
      uc.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_credits(UUID, INTEGER) TO authenticated;
