# app/core/database.py
from supabase import create_client, Client, ClientOptions
from core.config import settings

# Initialize a globally accessible Supabase client instance
supabase: Client = create_client(
    supabase_url=settings.SUPABASE_URL,
    supabase_key=settings.SUPABASE_SERVICE_KEY,
    options=ClientOptions(flow_type="pkce"),
)

def get_auth_client() -> Client:
    """
    Creates a fresh, short-lived Supabase client scoped to a single request,
    used ONLY for verifying a user's JWT via auth.get_user().
    Never reused or shared — avoids mutating global client's session state.
    """
    return create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=settings.SUPABASE_SERVICE_KEY, 
        options=ClientOptions(flow_type="pkce"),
    )