# app/api/v1/endpoints/auth.py
from fastapi import APIRouter, HTTPException, Depends, Header, status, Request, Query
from schemas.auth import UserSignup, UserLogin, ProfileUpsertSchema
from datetime import datetime
from core.database import supabase
from dependencies.auth import get_current_user, CurrentUser
from urllib.parse import urlparse
from core.database import get_auth_client

router = APIRouter()



@router.post("/login")
def login(user: UserLogin):
    try:
        auth_client = get_auth_client()
        res = auth_client.auth.sign_in_with_password({"email": user.email, "password": user.password})
        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "user": {"id": res.user.id, "email": res.user.email}
        }
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")



@router.get("/me")
def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    
):
    """
    Leverages the dependency shield. If the JWT is valid,
    it fetches all profile column metadata for the authenticated user.
    """
    try:
        # Query the profile table for the row matching the user's authenticated ID
        # "*" selects all columns dynamically
        profile_response = (
            supabase.table("profiles")
            .select("*")
            .eq("id", current_user.id)
            .single()
            .execute()
        )
        
        # If no profile row exists for this user ID, raise a clean 404
        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile data not found."
            )
            
        return profile_response.data

    except Exception as e:
        # Pass through explicit HTTP exceptions, catch database anomalies
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve profile: {str(e)}"
        )

@router.get("/profile-status")
def check_profile_status(current_user: CurrentUser = Depends(get_current_user)):
    """
    Checks your public schema 'profiles' table to see if the user 
    has a recorded profile matching their authenticated user ID.
    """
    try:
        # Query your separate custom profiles table
        profile_res = supabase.table("profiles") \
            .select("id") \
            .eq("id", current_user.id) \
            .maybe_single() \
            .execute()
            
        
        # If profile_res.data is None, or it's empty/falsy, onboarding is NOT complete.
        if not profile_res or profile_res.data is None:
            return {"has_completed_onboarding": False}
        
        # If we successfully retrieved data, onboarding is complete
        return {"has_completed_onboarding": True}
        
    except Exception as e:
      
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database profile verification failed: {str(e)}"
        )
    
@router.post("/logout")
def logout(
    current_user: CurrentUser = Depends(get_current_user),
    authorization: str = Header(...)
):
    try:
        token = authorization.split(" ")[1]
        # Admin-level sign out, revokes the session tied to this specific token
        supabase.auth.admin.sign_out(token, scope="global")
        return {"message": "Successfully logged out of backend session."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backend sign out routine failed: {str(e)}"
        )
    
@router.get("/check-username")
def check_username(
    username: str = Query(..., min_length=3, regex="^[a-z0-9_]+$"),
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Invokes the Supabase database RPC routine to check if a username 
    is already claimed by another account.
    """
    try:
        # Trigger your existing database RPC function exactly as before
        response = supabase.rpc(
            "check_username_exists", 
            {"target_username": username}
        ).execute()
        
        # Supabase RPC data contains the boolean returned from the function
        is_taken = response.data
        
        return {"is_taken": is_taken}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute database username validation: {str(e)}"
        )
    
@router.post("/profile")
def upsert_user_profile(
    payload: ProfileUpsertSchema,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Saves or overwrites a profile record inside the database 
    for the verified authenticated session owner.
    """
    try:
        # 2. Execute the upsert via the python engine client matrix
        response = supabase.table("profiles").upsert({
            "id": current_user.id,  # Hard-bound securely from token payload
            "full_name": payload.full_name.strip(),
            "username": payload.username.strip().lower(),
            "primary_role": payload.primary_role,
            "domain_of_focus": payload.domain_of_focus,
            "referral_source": payload.referral_source,
            "updated_at": datetime.utcnow().isoformat()
        }).execute()
        
        return {"status": "success", "message": "Profile configured successfully."}
        
    except Exception as e:
        error_msg = str(e)
        
        # Capture standard unique PostgreSQL violation constraint codes ('23505')
        if "23505" in error_msg or "violates unique constraint" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This username is already taken. Please choose another."
            )
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record profile entry: {error_msg}"
        )