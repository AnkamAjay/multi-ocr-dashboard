from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

import models, schemas
from database import get_db
from auth_utils import get_current_user

router = APIRouter()

@router.post("/statistics/update")
def update_statistics(stats_request: schemas.StatisticsUpdateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    doc_id = stats_request.document_id
    user_id = current_user.id
    
    # 1. Update or Create AnnotationSummary
    summary = db.query(models.AnnotationSummary).filter(
        models.AnnotationSummary.document_id == doc_id,
        models.AnnotationSummary.user_id == user_id
    ).first()
    
    if not summary:
        summary = models.AnnotationSummary(
            document_id=doc_id,
            user_id=user_id,
            total_pages_corrected=0,
            bbox_deleted=0,
            bbox_created=0,
            bbox_edited=0,
            text_edited=0,
            total_corrections=0,
            total_time_spent=0.0
        )
        db.add(summary)
    
    # Increment summary stats
    summary.bbox_deleted += stats_request.bbox_deleted
    summary.bbox_created += stats_request.bbox_created
    summary.bbox_edited += stats_request.bbox_edited
    summary.text_edited += stats_request.text_edited
    
    current_corrections = (stats_request.bbox_deleted + 
                           stats_request.bbox_created + 
                           stats_request.bbox_edited + 
                           stats_request.text_edited)
    summary.total_corrections += current_corrections
    summary.total_time_spent += stats_request.time_spent
    
    # We count unique pages corrected
    existing_page = db.query(models.PageCorrection).filter(
        models.PageCorrection.document_id == doc_id,
        models.PageCorrection.page_number == stats_request.page_number,
        models.PageCorrection.user_id == user_id
    ).first()
    
    if not existing_page:
        summary.total_pages_corrected += 1
        
        # 2. Create PageCorrection
        page_corr = models.PageCorrection(
            document_id=doc_id,
            user_id=user_id,
            page_number=stats_request.page_number,
            bbox_deleted=stats_request.bbox_deleted,
            bbox_created=stats_request.bbox_created,
            bbox_edited=stats_request.bbox_edited,
            text_edited=stats_request.text_edited,
            total_corrections=current_corrections,
            time_spent=stats_request.time_spent
        )
        db.add(page_corr)
    else:
        # Update existing page correction stats
        existing_page.bbox_deleted += stats_request.bbox_deleted
        existing_page.bbox_created += stats_request.bbox_created
        existing_page.bbox_edited += stats_request.bbox_edited
        existing_page.text_edited += stats_request.text_edited
        existing_page.total_corrections += current_corrections
        existing_page.time_spent += stats_request.time_spent
        
    # 3. Add Annotation Logs
    for log in stats_request.logs:
        db_log = models.AnnotationLog(
            document_id=doc_id,
            user_id=user_id,
            action_type=log.action_type,
            previous_value=log.previous_value,
            updated_value=log.updated_value,
            timestamp=log.timestamp or datetime.utcnow()
        )
        db.add(db_log)
        
    db.commit()
    
    return {"status": "success"}

@router.get("/statistics/summary", response_model=schemas.AnnotationSummaryBase)
def get_global_summary(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Calculate global totals across all documents for this user
    summaries = db.query(models.AnnotationSummary).filter(models.AnnotationSummary.user_id == current_user.id).all()
    
    global_stats = schemas.AnnotationSummaryBase(
        total_pages_corrected=sum(s.total_pages_corrected for s in summaries),
        bbox_deleted=sum(s.bbox_deleted for s in summaries),
        bbox_created=sum(s.bbox_created for s in summaries),
        bbox_edited=sum(s.bbox_edited for s in summaries),
        text_edited=sum(s.text_edited for s in summaries),
        total_corrections=sum(s.total_corrections for s in summaries),
        total_time_spent=sum(s.total_time_spent for s in summaries)
    )
    return global_stats

@router.get("/statistics/pages", response_model=List[schemas.PageCorrectionResponse])
def get_page_corrections(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    pages = db.query(models.PageCorrection).filter(models.PageCorrection.user_id == current_user.id).order_by(models.PageCorrection.id.desc()).all()
    return pages

@router.get("/statistics/logs", response_model=List[schemas.AnnotationLogResponse])
def get_annotation_logs(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    logs = db.query(models.AnnotationLog).filter(models.AnnotationLog.user_id == current_user.id).order_by(models.AnnotationLog.log_id.desc()).limit(100).all()
    return logs
