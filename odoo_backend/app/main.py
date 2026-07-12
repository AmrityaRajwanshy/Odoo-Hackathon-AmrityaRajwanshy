from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import assets

app = FastAPI(
    title="AssetFlow ERP Backend",
    description="Enterprise Asset & Resource Management System API",
    version="1.0.0"
)

# Crucial! Allows your friend's Next.js frontend to talk to your API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(assets.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to AssetFlow API engine!"}