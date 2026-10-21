"""Server-verified administrator sessions for screenshot viewing."""
import hashlib
import hmac
import os
import secrets
import time

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/auth", tags=["Administrator session"])
COOKIE = "edmt_admin_session"
TTL = 3600


def signing_secret():
    secret = os.getenv("DASHBOARD_SESSION_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(503, "Administrator session secret is not configured")
    return secret.encode()


def signature(value):
    return hmac.new(signing_secret(), value.encode(), hashlib.sha256).hexdigest()


def require_admin(request: Request):
    token = request.cookies.get(COOKIE, "")
    try:
        expiry, nonce, supplied = token.split(".")
        valid = hmac.compare_digest(signature(f"{expiry}.{nonce}"), supplied)
        if not valid or int(expiry) <= int(time.time()):
            raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(401, "Please sign in again to view screenshots")


class Login(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=1024)


@router.post("/login")
def login(payload: Login, response: Response, request: Request):
    password = os.getenv("DASHBOARD_ADMIN_PASSWORD", "")
    if not password:
        raise HTTPException(503, "Administrator password is not configured")
    expected_user = os.getenv("DASHBOARD_ADMIN_USER", "administrator")
    if not (hmac.compare_digest(payload.username.strip().lower().encode(), expected_user.lower().encode())
            and hmac.compare_digest(payload.password.encode(), password.encode())):
        raise HTTPException(401, "Invalid administrator credentials")
    value = f"{int(time.time()) + TTL}.{secrets.token_hex(16)}"

    # Determine secure cookie flag:
    # If DASHBOARD_COOKIE_SECURE is explicitly set, honor it.
    # Otherwise auto-detect HTTPS request or X-Forwarded-Proto header (defaults to False on HTTP).
    cookie_secure_env = os.getenv("DASHBOARD_COOKIE_SECURE")
    if cookie_secure_env is not None:
        cookie_secure = cookie_secure_env.lower() in ("true", "1", "yes")
    else:
        is_https = (request.url.scheme == "https") or (request.headers.get("x-forwarded-proto", "").lower() == "https")
        cookie_secure = is_https

    response.set_cookie(COOKIE, f"{value}.{signature(value)}", max_age=TTL,
                        httponly=True, samesite="lax", path="/api/v1",
                        secure=cookie_secure)
    response.headers["Cache-Control"] = "no-store"
    return {"username": expected_user, "displayName": "Administrator", "role": "System Administrator"}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE, path="/api/v1")
    response.headers["Cache-Control"] = "no-store"
    return {"status": "signed_out"}
