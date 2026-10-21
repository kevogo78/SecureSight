import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import telemetry, audit, presigned, endpoints, auth, media, privacy

app = FastAPI(
    title="Privacy-Centric Monitoring API",
    version="1.0.0",
    docs_url="/docs"
)

# Parse explicit allowed origins if provided; support regex for flexible development/deployment
cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "")
if cors_origins_env:
    allowed_origins = [orig.strip() for orig in cors_origins_env.split(",") if orig.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost",
        "http://127.0.0.1",
    ]

# Use allow_origin_regex to dynamically match and echo the requesting origin,
# resolving W3C CORS violations where allow_origins=["*"] cannot be used with allow_credentials=True.
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX", r"https?://.*"),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(telemetry.router)
app.include_router(audit.router)
app.include_router(presigned.router)
app.include_router(endpoints.router)
app.include_router(auth.router)
app.include_router(media.router)
app.include_router(privacy.router)

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "telemetry-backend"}
