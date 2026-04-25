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
    ocr_results: List[OCRResultResponse] = []

    class Config:
        from_attributes = True
