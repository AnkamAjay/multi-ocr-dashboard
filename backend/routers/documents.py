import os
import uuid
import shutil
import zipfile
import hashlib
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException # type: ignore
from sqlalchemy.orm import Session # type: ignore
from typing import List

from database import get_db # type: ignore
import models, schemas # type: ignore

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# File types we accept inside a ZIP or as direct uploads
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}


def hash_bytes(content: bytes) -> str:
    """Return the SHA-256 hex digest of file bytes."""
    return hashlib.sha256(content).hexdigest()


def save_single_file(file_path: str, content: bytes, db: Session, file_hash: str) -> models.Document:
    """Helper: saves pre-read file bytes to disk and creates a Document record in the DB."""
    with open(file_path, "wb") as buffer:
        buffer.write(content)
    db_doc = models.Document(file_path=file_path, file_hash=file_hash)
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    return db_doc


@router.post("/upload", response_model=schemas.BatchUploadResponse)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Read ALL bytes up front so we can hash and also save without re-reading
    content = await file.read()
    file_hash = hash_bytes(content)

    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    # ── CASE 1: Normal single image / PDF upload ──────────────────────────────
    if ext in ALLOWED_EXTENSIONS:

        # Check if we already have a corrected version of this exact file
        existing_doc = (
            db.query(models.Document)
            .filter(
                models.Document.file_hash == file_hash,
                models.Document.is_corrected == True,
            )
            .first()
        )

        if existing_doc:
            # Cache hit — return corrected Gold Standard immediately, skip OCR
            existing_filename = os.path.basename(existing_doc.file_path)
            return schemas.BatchUploadResponse(
                document_ids=[existing_doc.id],
                file_paths=[f"http://127.0.0.1:8000/uploads/{existing_filename}"],
                filenames=[existing_filename],
                is_batch=False,
                is_cached=True,
                cached_corrected_json=existing_doc.corrected_json,
            )

        # New file — save to disk and create Document
        file_path = os.path.join(UPLOAD_DIR, filename)
        db_doc = save_single_file(file_path, content, db, file_hash)
        return schemas.BatchUploadResponse(
            document_ids=[db_doc.id],
            file_paths=[f"http://127.0.0.1:8000/uploads/{filename}"],
            filenames=[filename],
            is_batch=False,
            is_cached=False,
        )

    # ── CASE 2: ZIP upload ────────────────────────────────────────────────────
    elif ext == ".zip":
        # Save zip to a unique temp folder to avoid name collisions
        batch_folder = os.path.join(UPLOAD_DIR, f"batch_{uuid.uuid4().hex[:8]}")
        os.makedirs(batch_folder, exist_ok=True)
        zip_path = os.path.join(batch_folder, filename)

        with open(zip_path, "wb") as f:
            f.write(content)

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

                # Extract file bytes and compute per-file hash
                with zf.open(member) as source:
                    member_bytes = source.read()
                member_hash = hash_bytes(member_bytes)

                # Check for existing corrected version of this file
                existing = (
                    db.query(models.Document)
                    .filter(
                        models.Document.file_hash == member_hash,
                        models.Document.is_corrected == True,
                    )
                    .first()
                )

                if existing:
                    # Use cached document — don't re-save to disk
                    rel_path = os.path.basename(existing.file_path)
                    document_ids.append(existing.id)
                    file_paths.append(f"http://127.0.0.1:8000/uploads/{rel_path}")
                    filenames.append(member_name)
                    continue

                # New file — save to batch folder
                extracted_path = os.path.join(batch_folder, member_name)
                with open(extracted_path, "wb") as target:
                    target.write(member_bytes)

                db_doc = models.Document(file_path=extracted_path, file_hash=member_hash)
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
                detail="ZIP file contains no supported image or PDF files (.jpg, .png, .pdf).",
            )

        return schemas.BatchUploadResponse(
            document_ids=document_ids,
            file_paths=file_paths,
            filenames=filenames,
            is_batch=True,
            is_cached=False,
        )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Please upload a JPG, PNG, PDF, or ZIP file.",
        )


@router.get("/results/{document_id}", response_model=schemas.DocumentResponse)
def get_results(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc
