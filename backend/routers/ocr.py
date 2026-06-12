from fastapi import APIRouter, Depends, HTTPException # type: ignore
from sqlalchemy.orm import Session # type: ignore
from typing import List
import httpx # type: ignore
import asyncio
import time
import uuid

import models, schemas # type: ignore
from database import get_db # type: ignore
from services import fusion_service

router = APIRouter()


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
                except Exception:
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
                
                print(f"[{cfg_name}] Sending OCR request for {filename}...")
                start_time = time.time()
                response = await client.post(url, data=data, files=files, timeout=60.0)
                duration = time.time() - start_time
                print(f"[{cfg_name}] Request completed in {duration:.2f}s with status {response.status_code}")
                
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
                    return f"API Error HTTP {response.status_code}: {response.text}", None
    except Exception as e:
        print(f"[{cfg_name}] Page OCR API failed: {repr(e)}")
        err_msg = str(e) if str(e) else repr(e)
        return f"Failed to connect to Page_OCR API. Error: {err_msg}", None


@router.post("/process", response_model=List[schemas.OCRResultResponse])
async def process_document(document_id: int, language: str = "english", modality: str = "printed", db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

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

    # Run OCR models sequentially to reduce API overload
    results = []
    for cfg in configs:
        res = await run_page_ocr(doc.file_path, language.lower(), cfg["version"], modality.lower(), cfg["layout"], cfg["name"])
        results.append(res)

    ocr_results = []
    for idx, cfg in enumerate(configs):
        extracted_text, raw_json = results[idx]
        
        # Create OCRResult record
        # model_name now stores both the Configuration name and the specific version for easy UI tracking
        ocr_res = models.OCRResult(
            document_id=doc.id,
            model_name=f"{cfg['name']} ({cfg['version']})",
            extracted_text=extracted_text,
            error_count=0,
            raw_json=raw_json
        )
        db.add(ocr_res)
        ocr_results.append(ocr_res)

    db.commit()

    # --- Run Fusion Algorithm ---
    # Only fuse successful models
    successful_results = [r for r in ocr_results if r.raw_json is not None]
    
    if successful_results:
        try:
            final_text, confidence, reconstructed_json = fusion_service.run_fusion(successful_results)
            
            # Save to fusion_results table
            fusion_record = models.FusionResult(
                document_id=doc.id,
                fused_text=final_text,
                confidence_score=float(confidence),
                model_count=len(successful_results)
            )
            db.add(fusion_record)
            
            # Save as an OCRResult for seamless UI integration
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
            
            # Insert Fused Result at the beginning of the list
            ocr_results.insert(0, fused_ocr_res)
        except Exception as e:
            import traceback
            print(f"Fusion failed: {e}")
            traceback.print_exc()

    for res in ocr_results:
        db.refresh(res)

    return ocr_results

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
    db: Session = Depends(get_db)
):
    """
    Save the Gold Standard bbox+text corrections for a document.
    This is the document-level truth — not tied to any specific OCR model.
    Called when the user clicks 'Save Corrections' after bbox CRUD editing.
    """
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

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
def get_best_model(document_id: int, db: Session = Depends(get_db)):
    results = db.query(models.OCRResult).filter(models.OCRResult.document_id == document_id).all()
    if not results:
        raise HTTPException(status_code=404, detail="No OCR results found for this document")

    # Simplistic heuristic: model with the lowest error_count after manual annotations
    best_model = min(results, key=lambda x: x.error_count)
    return {"best_model": best_model.model_name, "error_count": best_model.error_count}

@router.post("/fusion/generate", response_model=schemas.FusionGenerateResponse)
def generate_fusion(document_id: int, db: Session = Depends(get_db)):
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

