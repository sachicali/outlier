from sqlalchemy.orm import Session
from .models.analysis import Analysis

def create_analysis(db: Session, analysis_data: dict):
    analysis = Analysis(**analysis_data)
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis

def get_analysis(db: Session, analysis_id: str):
    return db.query(Analysis).filter(Analysis.id == analysis_id).first()
