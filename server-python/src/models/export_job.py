from sqlalchemy import Column, String, Integer, DateTime, Text, JSON, ForeignKey, BigInteger
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from db import Base
from enum import Enum

class ExportStatus(str, Enum):
    PENDING = 'pending'
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'
    CANCELLED = 'cancelled'

class ExportFormat(str, Enum):
    EXCEL = 'excel'
    CSV = 'csv'
    PDF = 'pdf'
    JSON = 'json'
    HTML = 'html'

class ExportJob(Base):
    __tablename__ = 'export_jobs'
    
    id = Column(String(36), primary_key=True, index=True)  # UUID
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    analysis_id = Column(String(36), nullable=False, index=True)  # UUID of analysis
    
    # Export details
    format = Column(String(20), nullable=False)  # ExportFormat enum
    status = Column(String(20), default=ExportStatus.PENDING, nullable=False, index=True)  # ExportStatus enum
    progress = Column(Integer, default=0)  # 0-100 percentage
    
    # File details
    filename = Column(String(255), nullable=True)
    file_path = Column(String(500), nullable=True)  # Path to generated file
    file_size = Column(BigInteger, nullable=True)  # File size in bytes
    mime_type = Column(String(100), nullable=True)
    
    # Export configuration
    export_config = Column(JSON, nullable=True)  # Additional export settings
    
    # Error handling
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # When file expires
    
    # Relationships
    user = relationship('User', backref='export_jobs')
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Set default expiration (24 hours from creation)
        if not self.expires_at:
            from datetime import datetime, timedelta
            self.expires_at = datetime.utcnow() + timedelta(hours=24)
    
    def is_expired(self):
        """Check if export job has expired"""
        from datetime import datetime
        return self.expires_at and self.expires_at < datetime.utcnow()
    
    def can_retry(self):
        """Check if job can be retried"""
        return self.status == ExportStatus.FAILED and self.retry_count < self.max_retries
    
    def mark_started(self):
        """Mark job as started"""
        from datetime import datetime
        self.status = ExportStatus.PROCESSING
        self.started_at = datetime.utcnow()
        self.progress = 0
    
    def mark_completed(self, file_path, file_size=None, filename=None):
        """Mark job as completed"""
        from datetime import datetime
        self.status = ExportStatus.COMPLETED
        self.completed_at = datetime.utcnow()
        self.progress = 100
        self.file_path = file_path
        self.file_size = file_size
        if filename:
            self.filename = filename
    
    def mark_failed(self, error_message, can_retry=True):
        """Mark job as failed"""
        self.status = ExportStatus.FAILED
        self.error_message = error_message
        self.progress = 100  # Complete but failed
        
        if can_retry and self.can_retry():
            self.retry_count += 1
        else:
            # Mark as permanently failed
            from datetime import datetime
            self.completed_at = datetime.utcnow()
    
    def update_progress(self, progress, message=None):
        """Update job progress"""
        self.progress = min(100, max(0, progress))
        if message:
            # Store progress messages in export_config
            if not self.export_config:
                self.export_config = {}
            if 'progress_messages' not in self.export_config:
                self.export_config['progress_messages'] = []
            
            from datetime import datetime
            self.export_config['progress_messages'].append({
                'timestamp': datetime.utcnow().isoformat(),
                'progress': progress,
                'message': message
            })
    
    def get_download_url(self, base_url):
        """Get download URL for completed export"""
        if self.status == ExportStatus.COMPLETED and self.file_path:
            return f"{base_url}/api/export/job/{self.id}/download"
        return None
    
    def get_estimated_completion(self):
        """Get estimated completion time based on progress"""
        if self.status != ExportStatus.PROCESSING or not self.started_at or self.progress <= 0:
            return None
        
        from datetime import datetime, timedelta
        
        elapsed = datetime.utcnow() - self.started_at
        if self.progress > 0:
            total_estimated = elapsed * (100 / self.progress)
            remaining = total_estimated - elapsed
            return datetime.utcnow() + remaining
        
        return None
    
    def to_dict(self, include_sensitive=False, base_url=None):
        """Convert export job to dictionary"""
        data = {
            'id': self.id,
            'userId': self.user_id,
            'analysisId': self.analysis_id,
            'format': self.format,
            'status': self.status,
            'progress': self.progress,
            'filename': self.filename,
            'fileSize': self.file_size,
            'mimeType': self.mime_type,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'startedAt': self.started_at.isoformat() if self.started_at else None,
            'completedAt': self.completed_at.isoformat() if self.completed_at else None,
            'expiresAt': self.expires_at.isoformat() if self.expires_at else None,
            'isExpired': self.is_expired(),
            'canRetry': self.can_retry()
        }
        
        if self.status == ExportStatus.FAILED:
            data['error'] = self.error_message
        
        if self.status == ExportStatus.COMPLETED and base_url:
            data['downloadUrl'] = self.get_download_url(base_url)
        
        if self.status == ExportStatus.PROCESSING:
            estimated_completion = self.get_estimated_completion()
            if estimated_completion:
                data['estimatedCompletion'] = estimated_completion.isoformat()
        
        if include_sensitive:
            data.update({
                'filePath': self.file_path,
                'retryCount': self.retry_count,
                'maxRetries': self.max_retries,
                'exportConfig': self.export_config
            })
        
        return data
    
    @classmethod
    def get_user_jobs(cls, session, user_id, limit=50, status=None):
        """Get export jobs for a user"""
        query = session.query(cls).filter(cls.user_id == user_id)
        
        if status:
            query = query.filter(cls.status == status)
        
        return query.order_by(cls.created_at.desc()).limit(limit).all()
    
    @classmethod
    def get_pending_jobs(cls, session, limit=100):
        """Get pending jobs for processing"""
        return session.query(cls).filter(
            cls.status == ExportStatus.PENDING
        ).order_by(cls.created_at.asc()).limit(limit).all()
    
    @classmethod
    def get_expired_jobs(cls, session):
        """Get expired jobs for cleanup"""
        from datetime import datetime
        return session.query(cls).filter(
            cls.expires_at < datetime.utcnow()
        ).all()
    
    @classmethod
    def cleanup_expired_jobs(cls, session, delete_files=True):
        """Clean up expired export jobs"""
        import os
        from utils.logger import logger
        
        expired_jobs = cls.get_expired_jobs(session)
        cleaned_count = 0
        
        for job in expired_jobs:
            try:
                # Delete file if it exists
                if delete_files and job.file_path and os.path.exists(job.file_path):
                    try:
                        os.remove(job.file_path)
                        logger.info(f"Deleted expired export file: {job.file_path}")
                    except Exception as e:
                        logger.warning(f"Could not delete file {job.file_path}: {e}")
                
                # Delete job record
                session.delete(job)
                cleaned_count += 1
                
            except Exception as e:
                logger.error(f"Error cleaning up export job {job.id}: {e}")
        
        if cleaned_count > 0:
            session.commit()
            logger.info(f"Cleaned up {cleaned_count} expired export jobs")
        
        return cleaned_count
