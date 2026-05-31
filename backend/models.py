from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, JSON, Boolean
from sqlalchemy.orm import relationship
import datetime
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, index=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Gold Standard correction columns
    file_hash = Column(String, nullable=True, index=True)       # SHA-256 of file bytes — enables re-upload detection
    corrected_json = Column(JSON, nullable=True)                # Final bbox+text list (the human-verified Gold Standard)
    is_corrected = Column(Boolean, default=False)               # True after the first "Save Corrections"

    ocr_results = relationship("OCRResult", back_populates="document")

class OCRResult(Base):
    __tablename__ = "ocr_results"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    model_name = Column(String, index=True)
    extracted_text = Column(Text)
    corrected_text = Column(Text, nullable=True)
    error_count = Column(Integer, default=0)
    raw_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    document = relationship("Document", back_populates="ocr_results")
    annotations = relationship("Annotation", back_populates="ocr_result")

class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    ocr_result_id = Column(Integer, ForeignKey("ocr_results.id"))
    edited_text = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    ocr_result = relationship("OCRResult", back_populates="annotations")

class AnnotationSummary(Base):
    __tablename__ = "annotation_summary"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, index=True)
    total_pages_corrected = Column(Integer, default=0)
    bbox_deleted = Column(Integer, default=0)
    bbox_created = Column(Integer, default=0)
    bbox_edited = Column(Integer, default=0)
    text_edited = Column(Integer, default=0)
    total_corrections = Column(Integer, default=0)
    total_time_spent = Column(Float, default=0.0)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

class PageCorrection(Base):
    __tablename__ = "page_corrections"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, index=True)
    page_number = Column(Integer, default=1)
    bbox_deleted = Column(Integer, default=0)
    bbox_created = Column(Integer, default=0)
    bbox_edited = Column(Integer, default=0)
    text_edited = Column(Integer, default=0)
    total_corrections = Column(Integer, default=0)
    time_spent = Column(Float, default=0.0)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

class AnnotationLog(Base):
    __tablename__ = "annotation_logs"

    log_id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, index=True)
    action_type = Column(String)
    previous_value = Column(String, nullable=True)
    updated_value = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

class FusionResult(Base):
    __tablename__ = "fusion_results"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, index=True)
    fused_text = Column(Text)
    confidence_score = Column(Float, default=0.0)
    model_count = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
