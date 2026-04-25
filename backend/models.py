from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
import datetime
from database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, index=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

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
