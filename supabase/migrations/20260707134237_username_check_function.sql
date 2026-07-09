--  Create the secure RPC function
CREATE OR REPLACE FUNCTION public.check_username_exists(target_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER --  Runs with system bypass privileges, allowing it to check across all rows safely
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE lower(username) = lower(trim(target_username))
    );
END;
$$;

-- Grant execution permissions explicitly to authenticated app users
GRANT EXECUTE ON FUNCTION public.check_username_exists(TEXT) TO authenticated;