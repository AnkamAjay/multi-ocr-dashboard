import os
import uuid
import shutil
import zipfile
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models, schemas

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# File types we accept inside a ZIP or as direct uploads
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}


def save_single_file(file_path: str, file_obj, db: Session) -> models.Document:
    """Helper: saves a file to disk and creates a Document record in the DB."""
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file_obj, buffer)
    db_doc = models.Document(file_path=file_path)
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    return db_doc


@router.post("/upload", response_model=schemas.BatchUploadResponse)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    # ── CASE 1: Normal single image / PDF upload ──────────────────────────────
    if ext in ALLOWED_EXTENSIONS:
        file_path = os.path.join(UPLOAD_DIR, filename)
        db_doc = save_single_file(file_path, file.file, db)
        return schemas.BatchUploadResponse(
            document_ids=[db_doc.id],
            file_paths=[f"http://127.0.0.1:8000/uploads/{filename}"],
            filenames=[filename],
            is_batch=False,
        )

    # ── CASE 2: ZIP upload ────────────────────────────────────────────────────
    elif ext == ".zip":
        # Save zip to a unique temp folder to avoid name collisions
        batch_folder = os.path.join(UPLOAD_DIR, f"batch_{uuid.uuid4().hex[:8]}")
        os.makedirs(batch_folder, exist_ok=True)
        zip_path = os.path.join(batch_folder, filename)

        with open(zip_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Extract and filter only valid image/pdf files
        document_ids: List[int] = []
        file_paths: List[str] = []
        filenames: List[str] = []

        with zipfile.ZipFile(zip_path, "r") as zf:
            for member in zf.infolist():
                # Skip folders and hidden/system files
                if member.is_dir():
                    continue
                member_name = os.path.basename(member.filename)
                if not member_name or member_name.startswith(".") or member_name.startswith("__"):
                    continue
                member_ext = os.path.splitext(member_name)[1].lower()
                if member_ext not in ALLOWED_EXTENSIONS:
                    continue

                # Extract file and save to the batch folder
                extracted_path = os.path.join(batch_folder, member_name)
                with zf.open(member) as source, open(extracted_path, "wb") as target:
                    shutil.copyfileobj(source, target)

                # Save each extracted file as a Document in the DB
                db_doc = models.Document(file_path=extracted_path)
                db.add(db_doc)
                db.commit()
                db.refresh(db_doc)

                rel_path = extracted_path.replace("\\", "/").replace("uploads/", "")
                document_ids.append(db_doc.id)
                file_paths.append(f"http://127.0.0.1:8000/uploads/{rel_path}")
                filenames.append(member_name)

        if not document_ids:
            raise HTTPException(
                status_code=400,
                detail="ZIP file contains no supported image or PDF files (.jpg, .png, .pdf)."
            )

        return schemas.BatchUploadResponse(
            document_ids=document_ids,
            file_paths=file_paths,
            filenames=filenames,
            is_batch=True,
        )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Please upload a JPG, PNG, PDF, or ZIP file."
        )


@router.get("/results/{document_id}", response_model=schemas.DocumentResponse)
def get_results(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc
