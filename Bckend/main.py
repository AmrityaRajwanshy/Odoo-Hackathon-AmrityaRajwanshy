from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import auth, org, assets, allocations, bookings, maintenance, audits, reports, logs

app = FastAPI(
    title="Asset Management & Resource Booking System API",
    description="Backend API supporting authentication, departments, assets, allocations, bookings, maintenance, and audits.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
os.makedirs("uploads", exist_ok=True)
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# Register routers
app.include_router(auth.router)
app.include_router(org.router)
app.include_router(assets.router)
app.include_router(allocations.router)
app.include_router(bookings.router)
app.include_router(maintenance.router)
app.include_router(audits.router)
app.include_router(reports.router)
app.include_router(logs.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Asset Management & Resource Booking System API",
        "documentation": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
