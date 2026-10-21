from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import telemetry, audit, presigned, endpoints, auth, media, recordings

app = FastAPI(
    title="Privacy-Centric Monitoring API",
    version="1.0.0",
    docs_url="/docs"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
app.include_router(recordings.router)

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "telemetry-backend"}
