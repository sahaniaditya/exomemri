# app/api/v1/api.py
from fastapi import APIRouter
from api.v1.endpoints import auth

api_router = APIRouter()


api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Future extensions will look exactly like this:
# api_router.include_router(scraper.router, prefix="/scraper", tags=["Scraping Tools"])
# api_router.include_router(ai.router, prefix="/ai", tags=["AI Engine"])