import os
import uuid
import shutil
import zipfile
import hashlib
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException # type: ignore
from sqlalchemy.orm import Session # type: ignore
from typing import List
import re
import urllib.parse

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

    # ── CASE 1: Single image upload ───────────────────────────────────────────
    if ext in {".jpg", ".jpeg", ".png"}:
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
            existing_rel_path = existing_doc.file_path.replace("\\", "/").replace("uploads/", "")
            safe_rel_path = urllib.parse.quote(existing_rel_path)
            return schemas.BatchUploadResponse(
                document_ids=[existing_doc.id],
                file_paths=[f"http://127.0.0.1:8000/uploads/{safe_rel_path}"],
                filenames=[existing_filename],
                is_batch=False,
                is_cached=True,
                cached_corrected_json=existing_doc.corrected_json,
                source_file_type="IMAGE",
                total_pages=1,
            )

        # New file — save to disk and create Document
        unique_filename = f"{uuid.uuid4().hex[:8]}_{filename}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        db_doc = save_single_file(file_path, content, db, file_hash)
        safe_rel_path = urllib.parse.quote(unique_filename)
        return schemas.BatchUploadResponse(
            document_ids=[db_doc.id],
            file_paths=[f"http://127.0.0.1:8000/uploads/{safe_rel_path}"],
            filenames=[filename],
            is_batch=False,
            is_cached=False,
            source_file_type="IMAGE",
            total_pages=1,
        )

    # ── CASE 2: PDF upload ────────────────────────────────────────────────────
    elif ext == ".pdf":
        # Save pdf to a unique folder under uploads to avoid name collisions
        pdf_folder = os.path.join(UPLOAD_DIR, f"pdf_{uuid.uuid4().hex[:8]}")
        os.makedirs(pdf_folder, exist_ok=True)
        pdf_path = os.path.join(pdf_folder, filename)

        with open(pdf_path, "wb") as f:
            f.write(content)

        import fitz  # PyMuPDF
        try:
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to open PDF file: {str(e)}",
            )

        if total_pages == 0:
            doc.close()
            raise HTTPException(
                status_code=400,
                detail="Uploaded PDF file has 0 pages.",
            )

        document_ids: List[int] = []
        file_paths: List[str] = []
        filenames: List[str] = []

        for page_num in range(total_pages):
            try:
                page = doc.load_page(page_num)
                pix = page.get_pixmap(dpi=150)
                page_img_name = f"page_{page_num + 1}.png"
                page_img_path = os.path.join(pdf_folder, page_img_name)
                pix.save(page_img_path)
            except Exception as e:
                doc.close()
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to convert PDF page {page_num + 1} to image: {str(e)}"
                )

            with open(page_img_path, "rb") as f:
                page_bytes = f.read()
            page_hash = hash_bytes(page_bytes)

            # Check for cache hit on this specific page
            existing = (
                db.query(models.Document)
                .filter(
                    models.Document.file_hash == page_hash,
                    models.Document.is_corrected == True,
                )
                .first()
            )

            if existing:
                rel_path = existing.file_path.replace("\\", "/").replace("uploads/", "")
                safe_rel_path = urllib.parse.quote(rel_path)
                document_ids.append(existing.id)
                file_paths.append(f"http://127.0.0.1:8000/uploads/{safe_rel_path}")
                filenames.append(f"{filename} (Page {page_num + 1})")
                continue

            # Save new Document record for the page
            db_doc = models.Document(file_path=page_img_path, file_hash=page_hash)
            db.add(db_doc)
            db.commit()
            db.refresh(db_doc)

            rel_path = page_img_path.replace("\\", "/").replace("uploads/", "")
            safe_rel_path = urllib.parse.quote(rel_path)
            document_ids.append(db_doc.id)
            file_paths.append(f"http://127.0.0.1:8000/uploads/{safe_rel_path}")
            filenames.append(f"{filename} (Page {page_num + 1})")

        doc.close()

        return schemas.BatchUploadResponse(
            document_ids=document_ids,
            file_paths=file_paths,
            filenames=filenames,
            is_batch=True,
            is_cached=False,
            source_file_type="PDF",
            total_pages=total_pages,
        )

    # ── CASE 3: ZIP upload ────────────────────────────────────────────────────
    elif ext == ".zip":
        # Save zip to a unique temp folder to avoid name collisions
        batch_folder = os.path.join(UPLOAD_DIR, f"batch_{uuid.uuid4().hex[:8]}")
        os.makedirs(batch_folder, exist_ok=True)
        zip_path = os.path.join(batch_folder, filename)

        with open(zip_path, "wb") as f:
            f.write(content)

        # Extract and filter ONLY valid image files (JPG, JPEG, PNG)
        document_ids: List[int] = []
        file_paths: List[str] = []
        filenames: List[str] = []

        def natural_sort_key(s):
            return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

        with zipfile.ZipFile(zip_path, "r") as zf:
            members = sorted(zf.infolist(), key=lambda m: natural_sort_key(m.filename))
            for member in members:
                # Skip folders and hidden/system files
                if member.is_dir():
                    continue
                # Use a unique name if there are duplicate basenames in different folders
                safe_name = member.filename.replace("/", "_").replace("\\", "_")
                member_name = os.path.basename(safe_name)
                if not member_name or member_name.startswith(".") or member_name.startswith("__"):
                    continue
                member_ext = os.path.splitext(member_name)[1].lower()
                # ONLY JPG, JPEG, PNG images accepted inside ZIP
                if member_ext not in {".jpg", ".jpeg", ".png"}:
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
                    rel_path = existing.file_path.replace("\\", "/").replace("uploads/", "")
                    safe_rel_path = urllib.parse.quote(rel_path)
                    document_ids.append(existing.id)
                    file_paths.append(f"http://127.0.0.1:8000/uploads/{safe_rel_path}")
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
                safe_rel_path = urllib.parse.quote(rel_path)
                document_ids.append(db_doc.id)
                file_paths.append(f"http://127.0.0.1:8000/uploads/{safe_rel_path}")
                filenames.append(member_name)

        if not document_ids:
            raise HTTPException(
                status_code=400,
                detail="ZIP file contains no supported image files (.jpg, .jpeg, .png).",
            )

        return schemas.BatchUploadResponse(
            document_ids=document_ids,
            file_paths=file_paths,
            filenames=filenames,
            is_batch=True,
            is_cached=False,
            source_file_type="ZIP",
            total_pages=len(document_ids),
        )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Please upload a JPG, JPEG, PNG, PDF, or ZIP file.",
        )


@router.get("/results/{document_id}", response_model=schemas.DocumentResponse)
def get_results(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc
