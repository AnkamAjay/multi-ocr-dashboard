import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

# We need the __init__.py files in subdirectories or we can just run everything together
import models
from database import engine

models.Base.metadata.create_all(bind=engine)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="Multi-OCR Comparison API",
    root_path="/ant/api"
)

# Configure CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files as static assets so frontend can load images via URL
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

from routers import documents, ocr, statistics, auth, stream

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(documents.router, tags=["Documents"])
app.include_router(ocr.router, tags=["OCR"])
app.include_router(statistics.router, tags=["Statistics"])
app.include_router(stream.router, tags=["Stream"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Multi-OCR Comparison and Annotation System"}
