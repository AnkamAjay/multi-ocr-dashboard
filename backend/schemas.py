from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

class AnnotationBase(BaseModel):
    edited_text: str

class AnnotationCreate(AnnotationBase):
    pass

class AnnotationResponse(AnnotationBase):
    id: int
    ocr_result_id: int
    timestamp: datetime

    class Config:
        from_attributes = True

class OCRResultBase(BaseModel):
    model_name: str
    extracted_text: str
    corrected_text: Optional[str] = None
    error_count: int = 0
    raw_json: Optional[Any] = None

class OCRResultResponse(OCRResultBase):
    id: int
    document_id: int
    created_at: datetime
    annotations: List[AnnotationResponse] = []

    class Config:
        from_attributes = True

class DocumentBase(BaseModel):
    file_path: str

class DocumentResponse(DocumentBase):
    id: int
    uploaded_at: datetime
    # Gold Standard correction fields
    file_hash: Optional[str] = None
    corrected_json: Optional[Any] = None
    is_corrected: bool = False
    ocr_results: List[OCRResultResponse] = []

    class Config:
        from_attributes = True

class BatchUploadResponse(BaseModel):
    """Returned by the /upload endpoint for both single files and ZIP batches."""
    document_ids: List[int]
    file_paths: List[str]
    filenames: List[str]
    is_batch: bool = False
    # Cache-hit fields — populated when the same file has been corrected before
    is_cached: bool = False
    cached_corrected_json: Optional[Any] = None
    source_file_type: Optional[str] = "IMAGE"
    total_pages: Optional[int] = 1

class SaveCorrectionsRequest(BaseModel):
    """Payload for POST /save-corrections — stores the Gold Standard bbox+text list."""
    corrected_json: List[Any]      # List of BBox dicts: {id, x, y, w, h, text, status}
    corrected_text: str            # Full concatenated text (for search/display convenience)

class AnnotationLogBase(BaseModel):
    action_type: str
    previous_value: Optional[str] = None
    updated_value: Optional[str] = None
    timestamp: datetime

class AnnotationLogCreate(BaseModel):
    action_type: str
    previous_value: Optional[str] = None
    updated_value: Optional[str] = None
    timestamp: Optional[datetime] = None

class AnnotationLogResponse(AnnotationLogBase):
    log_id: int
    document_id: int

    class Config:
        from_attributes = True

class PageCorrectionBase(BaseModel):
    page_number: int
    bbox_deleted: int
    bbox_created: int
    bbox_edited: int
    text_edited: int
    total_corrections: int
    time_spent: float
    source_file_type: Optional[str] = "IMAGE"
    total_pages: Optional[int] = 1

class PageCorrectionCreate(PageCorrectionBase):
    pass

class PageCorrectionResponse(PageCorrectionBase):
    id: int
    document_id: int

    class Config:
        from_attributes = True

class AnnotationSummaryBase(BaseModel):
    total_pages_corrected: int
    bbox_deleted: int
    bbox_created: int
    bbox_edited: int
    text_edited: int
    total_corrections: int
    total_time_spent: float
    source_file_type: Optional[str] = "IMAGE"
    total_pages: Optional[int] = 1

class AnnotationSummaryResponse(AnnotationSummaryBase):
    id: int
    document_id: int

    class Config:
        from_attributes = True

class StatisticsUpdateRequest(BaseModel):
    document_id: int
    page_number: int
    bbox_deleted: int
    bbox_created: int
    bbox_edited: int
    text_edited: int
    time_spent: float
    logs: List[AnnotationLogCreate]
    source_file_type: Optional[str] = "IMAGE"
    total_pages: Optional[int] = 1

class FusionGenerateResponse(BaseModel):
    fused_text: str
    confidence: float
    source_models: List[str]

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
