from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
<<<<<<< HEAD
from .routes import telemetry, audit, presigned, endpoints
=======
from .routes import telemetry, audit, presigned
>>>>>>> 04a5980c279b2fcaf64da1b4312dd34f2ce4d4cb

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
<<<<<<< HEAD
app.include_router(endpoints.router)
=======
>>>>>>> 04a5980c279b2fcaf64da1b4312dd34f2ce4d4cb

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "telemetry-backend"}