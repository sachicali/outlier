from sqlalchemy import Column, String, Integer, JSON, DateTime
from sqlalchemy.sql import func
from db import Base

class Analysis(Base):
    __tablename__ = 'analyses'
    id = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    config = Column(JSON, nullable=False)
    status = Column(String, default='pending')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
