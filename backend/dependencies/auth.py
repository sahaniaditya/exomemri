from fastapi import Header, HTTPException, status
from core.database import get_auth_client   
from pydantic import BaseModel

class CurrentUser(BaseModel):
    id: str
    email: str

async def get_current_user(authorization: str = Header(None)) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header. Expected 'Bearer <JWT>'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ")[1]

    try:
        auth_client = get_auth_client()          
        user_response = auth_client.auth.get_user(token)   
        user = user_response.user

        return CurrentUser(id=user.id, email=user.email)

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )