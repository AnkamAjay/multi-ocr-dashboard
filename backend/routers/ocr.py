import logging
from fastapi import APIRouter, Depends, HTTPException # type: ignore
from sqlalchemy.orm import Session # type: ignore
from typing import List
import httpx # type: ignore
import asyncio
import time
import uuid

import models, schemas # type: ignore
from database import get_db, SessionLocal # type: ignore
from services import fusion_service
from services.stream_manager import stream_manager
from fastapi import BackgroundTasks
from auth_utils import get_current_user

router = APIRouter()

# Semaphore to limit concurrent requests to the external OCR API.
# Prevents overloading the server when multiple pages/models run in parallel.
OCR_API_SEMAPHORE = asyncio.Semaphore(6)

logger = logging.getLogger("ocr_service")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(ch)

async def run_page_ocr(file_path: str, language: str, version: str, modality: str, layout_model: str, cfg_name: str = "OCR"):
    url = "https://ilocr.iiit.ac.in/pageocr/api"
    try:
        import os
        import fitz  # type: ignore
        
        # Append a UUID to avoid filename collisions on the server side
        original_filename = os.path.basename(file_path)
        filename = f"{uuid.uuid4().hex[:8]}_{original_filename}"
        upload_path = file_path
        content_type = "image/jpeg"
        
        # Convert PDF to Image (first page) if it's a PDF
        if filename.lower().endswith(".pdf"):
            image_path = file_path + ".jpg"
            if not os.path.exists(image_path):
                try:
                    doc = fitz.open(file_path)
                    page = doc.load_page(0)
                    pix = page.get_pixmap()
                    pix.save(image_path)
                    doc.close()
                except Exception as e:
                    logger.error(f"[{cfg_name}] Failed to extract image from PDF {file_path}: {e}")
                    pass
            
            upload_path = image_path
            filename = filename + ".jpg"
        
        async with httpx.AsyncClient() as client:
            with open(upload_path, "rb") as f:
                files = {"image": (filename, f, content_type)}
                data = {
                    "language": language,
                    "version": version,
                    "modality": modality,
                    "layout_model": layout_model,
                    "padding": 0,
                    "postprocess": "false",
                    "binarize": "false"
                }
                
                logger.info(f"[{cfg_name}] Calling OCR API for {filename} (Lang: {language}, Modality: {modality})")
                start_time = time.time()
                try:
                    response = await client.post(url, data=data, files=files, timeout=60.0)
                    duration = time.time() - start_time
                    logger.info(f"[{cfg_name}] Request completed in {duration:.2f}s with status {response.status_code}")
                    
                    if response.status_code == 200:
                        resp_json = response.json()
                        
                        import re
                        text = resp_json.get("text", "")
                        
                        # The API often returns one word per line (single newlines).
                        # We replace single newlines with spaces to form paragraphs,
                        # but preserve multiple newlines if they exist.
                        formatted_text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
                        
                        if formatted_text.strip():
                            return formatted_text, resp_json
                        return text, resp_json
                    else:
                        logger.error(f"[{cfg_name}] HTTP {response.status_code} Error: {response.text}")
                        return f"API Error HTTP {response.status_code}: {response.text}", None
                except httpx.TimeoutException as e:
                    duration = time.time() - start_time
                    logger.error(f"[{cfg_name}] Timeout occurred after {duration:.2f}s: {e}")
                    return f"OCR API Timeout Error: {str(e)}", None
                except httpx.RequestError as e:
                    logger.error(f"[{cfg_name}] Connection refused / Request Error: {e}")
                    return f"OCR API Connection Error: {str(e)}", None
    except Exception as e:
        logger.error(f"[{cfg_name}] Page OCR API failed unexpectedly: {repr(e)}")
        err_msg = str(e) if str(e) else repr(e)
        return f"Failed to connect to Page_OCR API. Error: {err_msg}", None

async def run_ocr_pipeline(document_id: int, language: str, modality: str, configs: list):
    """Background task to run OCR, write to DB, and emit SSE events."""
    db = SessionLocal()
    try:
        doc = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not doc:
            return
            
        doc.status = "PROCESSING"
        db.commit()

        async def run_with_semaphore(cfg):
            async with OCR_API_SEMAPHORE:
                extracted_text, raw_json = await run_page_ocr(doc.file_path, language.lower(), cfg["version"], modality.lower(), cfg["layout"], cfg["name"])
                
                # Save immediately
                ocr_res = models.OCRResult(
                    document_id=doc.id,
                    model_name=f"{cfg['name']} ({cfg['version']})",
                    extracted_text=extracted_text,
                    error_count=0,
                    raw_json=raw_json
                )
                db.add(ocr_res)
                db.commit()
                db.refresh(ocr_res)
                
                # Emit SSE event
                # We need to construct a dict matching schemas.OCRResultResponse
                res_dict = {
                    "id": ocr_res.id,
                    "document_id": ocr_res.document_id,
                    "model_name": ocr_res.model_name,
                    "extracted_text": ocr_res.extracted_text,
                    "corrected_text": ocr_res.corrected_text,
                    "error_count": ocr_res.error_count,
                    "raw_json": ocr_res.raw_json
                }
                asyncio.create_task(stream_manager.broadcast(document_id, "MODEL_COMPLETED", res_dict))
                return ocr_res

        logger.info(f"[TIMING] Starting parallel OCR models for document_id={document_id}...")
        ocr_start = time.time()
        tasks = [run_with_semaphore(cfg) for cfg in configs]
        ocr_results = await asyncio.gather(*tasks)
        logger.info(f"[TIMING] Parallel OCR completed for document_id={document_id} in {time.time() - ocr_start:.4f}s")

        # --- Run Fusion Algorithm ---
        successful_results = [r for r in ocr_results if r.raw_json is not None]
        
        if successful_results:
            fusion_start = time.time()
            try:
                final_text, confidence, reconstructed_json = fusion_service.run_fusion(successful_results)
                
                fusion_record = models.FusionResult(
                    document_id=doc.id,
                    fused_text=final_text,
                    confidence_score=float(confidence),
                    model_count=len(successful_results)
                )
                db.add(fusion_record)
                
                fused_ocr_res = models.OCRResult(
                    document_id=doc.id,
                    model_name=f"⭐ Fused Result (Recommended) | Confidence: {int(confidence)}%",
                    extracted_text=final_text,
                    error_count=0,
                    raw_json=reconstructed_json
                )
                db.add(fused_ocr_res)
                db.commit()
                db.refresh(fused_ocr_res)
                logger.info(f"[TIMING] Fusion completed and saved in {time.time() - fusion_start:.4f}s")
                
                # Emit SSE event for fusion
                res_dict = {
                    "id": fused_ocr_res.id,
                    "document_id": fused_ocr_res.document_id,
                    "model_name": fused_ocr_res.model_name,
                    "extracted_text": fused_ocr_res.extracted_text,
                    "corrected_text": fused_ocr_res.corrected_text,
                    "error_count": fused_ocr_res.error_count,
                    "raw_json": fused_ocr_res.raw_json
                }
                asyncio.create_task(stream_manager.broadcast(document_id, "FUSION_COMPLETED", res_dict))
                
            except Exception as e:
                import traceback
                print(f"Fusion failed: {e}")
                traceback.print_exc()

        doc.status = "COMPLETED"
        db.commit()
        
        # Emit page complete event
        asyncio.create_task(stream_manager.broadcast(document_id, "PAGE_COMPLETED", {"document_id": document_id}))

    except Exception as e:
        logger.error(f"Pipeline error for document_id={document_id}: {e}")
        doc = db.query(models.Document).filter(models.Document.id == document_id).first()
        if doc:
            doc.status = "FAILED"
            db.commit()
    finally:
        db.close()

@router.post("/process")
async def process_document(document_id: int, background_tasks: BackgroundTasks, language: str = "english", modality: str = "printed", db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    doc = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized")


    # Define modality configurations
    configs = []
    if modality.lower() == "printed":
        configs = [
            {"name": "Printed_V1", "version": "V-01.10.01.02", "layout": "v2_doctr"},
            {"name": "Printed_V2", "version": "V-01.10.01.03", "layout": "v2_doctr"},
            {"name": "Printed_V3", "version": "V-01.10.01.04", "layout": "v2_doctr"},
        ]
    elif modality.lower() == "scenetext":
        configs = [
            {"name": "SceneText_V1", "version": "V-02.01.00.01", "layout": "textbpnpp"},
            {"name": "SceneText_V2", "version": "V-04.00.00.02", "layout": "textbpnpp"},
            {"name": "SceneText_V3", "version": "V-01.04.00.21", "layout": "textbpnpp"},
        ]
    elif modality.lower() == "handwritten":
        configs = [
            {"name": "Handwritten_V1", "version": "V-01.09.00.06", "layout": "yolo_ro"},
            {"name": "Handwritten_V2", "version": "V-01.09.00.03", "layout": "yolo_ro"},
            {"name": "Handwritten_V3", "version": "V-01.09.00.04", "layout": "yolo_ro"},
        ]
    else:
        raise HTTPException(status_code=400, detail="Invalid modality provided")

    # If already processing or completed, just return status
    if doc.status in ["PROCESSING", "COMPLETED"]:
        return {"status": doc.status, "document_id": document_id}
        
    doc.status = "PENDING"
    db.commit()

    background_tasks.add_task(run_ocr_pipeline, document_id, language, modality, configs)
    
    return {"status": "processing", "document_id": document_id}

@router.post("/save", response_model=schemas.AnnotationResponse)
def save_annotation(ocr_result_id: int, annotation: schemas.AnnotationCreate, db: Session = Depends(get_db)):
    ocr_res = db.query(models.OCRResult).filter(models.OCRResult.id == ocr_result_id).first()
    if not ocr_res:
        raise HTTPException(status_code=404, detail="OCR Result not found")
    
    # Update corrected text if needed or just save annotation
    ocr_res.corrected_text = annotation.edited_text
    
    # Very basic error approximation based on word length diff
    orig_words = set(ocr_res.extracted_text.split())
    new_words = set(annotation.edited_text.split())
    ocr_res.error_count = len(orig_words.symmetric_difference(new_words))

    new_ann = models.Annotation(ocr_result_id=ocr_result_id, edited_text=annotation.edited_text)
    db.add(new_ann)
    db.commit()
    db.refresh(new_ann)

    return new_ann


@router.post("/save-corrections")
def save_bbox_corrections(
    document_id: int,
    corrections: schemas.SaveCorrectionsRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Save the Gold Standard bbox+text corrections for a document.
    This is the document-level truth — not tied to any specific OCR model.
    Called when the user clicks 'Save Corrections' after bbox CRUD editing.
    """
    doc = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized")

    doc.corrected_json = corrections.corrected_json
    doc.is_corrected = True
    db.commit()

    return {
        "status": "saved",
        "document_id": document_id,
        "bbox_count": len(corrections.corrected_json),
        "corrected_text_length": len(corrections.corrected_text),
    }


@router.get("/best-model/{document_id}")
def get_best_model(document_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    doc = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized")
        
    results = db.query(models.OCRResult).filter(models.OCRResult.document_id == document_id).all()
    if not results:
        raise HTTPException(status_code=404, detail="No OCR results found for this document")

    # Simplistic heuristic: model with the lowest error_count after manual annotations
    best_model = min(results, key=lambda x: x.error_count)
    return {"best_model": best_model.model_name, "error_count": best_model.error_count}

@router.post("/fusion/generate", response_model=schemas.FusionGenerateResponse)
def generate_fusion(document_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    doc = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized")
        
    results = db.query(models.OCRResult).filter(
        models.OCRResult.document_id == document_id,
        ~models.OCRResult.model_name.contains("Fused Result")
    ).all()
    
    if not results:
        raise HTTPException(status_code=404, detail="No OCR results found for this document")

    final_text, confidence, reconstructed_json = fusion_service.run_fusion(results)
    
    fusion_record = models.FusionResult(
        document_id=document_id,
        fused_text=final_text,
        confidence_score=float(confidence),
        model_count=len(results)
    )
    db.add(fusion_record)
    db.commit()
    
    return {
        "fused_text": final_text,
        "confidence": confidence,
        "source_models": [r.model_name for r in results]
    }

