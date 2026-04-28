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

app = FastAPI(title="Multi-OCR Comparison API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files as static assets so frontend can load images via URL
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

from routers import documents, ocr

app.include_router(documents.router, prefix="/api", tags=["Documents"])
app.include_router(ocr.router, prefix="/api", tags=["OCR"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Multi-OCR Comparison and Annotation System"}
