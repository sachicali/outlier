from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, asc
from datetime import datetime, timedelta
from models.export_job import ExportJob, ExportStatus, ExportFormat
from utils.logger import logger

class ExportRepository:
    """Repository for managing export jobs"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create_export_job(
        self, 
        job_id: str,
        user_id: int,
        analysis_id: str,
        format_type: str,
        export_config: Optional[Dict[str, Any]] = None
    ) -> ExportJob:
        """Create a new export job"""
        job = ExportJob(
            id=job_id,
            user_id=user_id,
            analysis_id=analysis_id,
            format=format_type,
            export_config=export_config or {}
        )
        
        self.session.add(job)
        self.session.commit()
        self.session.refresh(job)
        
        logger.info(f"Created export job {job_id} for user {user_id}, analysis {analysis_id}")
        return job
    
    def get_job_by_id(self, job_id: str) -> Optional[ExportJob]:
        """Get export job by ID"""
        return self.session.query(ExportJob).filter(ExportJob.id == job_id).first()
    
    def get_user_jobs(
        self, 
        user_id: int, 
        limit: int = 50, 
        status: Optional[str] = None,
        format_type: Optional[str] = None
    ) -> List[ExportJob]:
        """Get export jobs for a specific user"""
        query = self.session.query(ExportJob).filter(ExportJob.user_id == user_id)
        
        if status:
            query = query.filter(ExportJob.status == status)
        
        if format_type:
            query = query.filter(ExportJob.format == format_type)
        
        return query.order_by(desc(ExportJob.created_at)).limit(limit).all()
    
    def get_analysis_jobs(self, analysis_id: str, user_id: Optional[int] = None) -> List[ExportJob]:
        """Get all export jobs for a specific analysis"""
        query = self.session.query(ExportJob).filter(ExportJob.analysis_id == analysis_id)
        
        if user_id:
            query = query.filter(ExportJob.user_id == user_id)
        
        return query.order_by(desc(ExportJob.created_at)).all()
    
    def get_pending_jobs(self, limit: int = 100) -> List[ExportJob]:
        """Get pending jobs for processing"""
        return self.session.query(ExportJob).filter(
            ExportJob.status == ExportStatus.PENDING
        ).order_by(asc(ExportJob.created_at)).limit(limit).all()
    
    def get_processing_jobs(self) -> List[ExportJob]:
        """Get currently processing jobs"""
        return self.session.query(ExportJob).filter(
            ExportJob.status == ExportStatus.PROCESSING
        ).order_by(asc(ExportJob.started_at)).all()
    
    def get_jobs_by_status(self, status: str, limit: int = 100) -> List[ExportJob]:
        """Get jobs by status"""
        return self.session.query(ExportJob).filter(
            ExportJob.status == status
        ).order_by(desc(ExportJob.created_at)).limit(limit).all()
    
    def get_expired_jobs(self) -> List[ExportJob]:
        """Get expired jobs for cleanup"""
        return self.session.query(ExportJob).filter(
            ExportJob.expires_at < datetime.utcnow()
        ).all()
    
    def get_old_jobs(self, days_old: int = 7) -> List[ExportJob]:
        """Get jobs older than specified days"""
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        return self.session.query(ExportJob).filter(
            ExportJob.created_at < cutoff_date
        ).all()
    
    def update_job_status(
        self, 
        job_id: str, 
        status: str, 
        progress: Optional[int] = None,
        error_message: Optional[str] = None
    ) -> Optional[ExportJob]:
        """Update job status"""
        job = self.get_job_by_id(job_id)
        if not job:
            return None
        
        job.status = status
        
        if progress is not None:
            job.progress = progress
        
        if error_message:
            job.error_message = error_message
        
        # Set timestamps based on status
        if status == ExportStatus.PROCESSING and not job.started_at:
            job.started_at = datetime.utcnow()
        elif status in [ExportStatus.COMPLETED, ExportStatus.FAILED] and not job.completed_at:
            job.completed_at = datetime.utcnow()
        
        self.session.commit()
        self.session.refresh(job)
        
        return job
    
    def mark_job_started(self, job_id: str) -> Optional[ExportJob]:
        """Mark job as started"""
        job = self.get_job_by_id(job_id)
        if job:
            job.mark_started()
            self.session.commit()
            self.session.refresh(job)
        return job
    
    def mark_job_completed(
        self, 
        job_id: str, 
        file_path: str, 
        file_size: Optional[int] = None,
        filename: Optional[str] = None,
        mime_type: Optional[str] = None
    ) -> Optional[ExportJob]:
        """Mark job as completed"""
        job = self.get_job_by_id(job_id)
        if job:
            job.mark_completed(file_path, file_size, filename)
            if mime_type:
                job.mime_type = mime_type
            self.session.commit()
            self.session.refresh(job)
        return job
    
    def mark_job_failed(
        self, 
        job_id: str, 
        error_message: str, 
        can_retry: bool = True
    ) -> Optional[ExportJob]:
        """Mark job as failed"""
        job = self.get_job_by_id(job_id)
        if job:
            job.mark_failed(error_message, can_retry)
            self.session.commit()
            self.session.refresh(job)
        return job
    
    def update_job_progress(
        self, 
        job_id: str, 
        progress: int, 
        message: Optional[str] = None
    ) -> Optional[ExportJob]:
        """Update job progress"""
        job = self.get_job_by_id(job_id)
        if job:
            job.update_progress(progress, message)
            self.session.commit()
            self.session.refresh(job)
        return job
    
    def retry_job(self, job_id: str) -> Optional[ExportJob]:
        """Retry a failed job"""
        job = self.get_job_by_id(job_id)
        if job and job.can_retry():
            job.status = ExportStatus.PENDING
            job.error_message = None
            job.progress = 0
            job.started_at = None
            job.completed_at = None
            
            # Extend expiration
            job.expires_at = datetime.utcnow() + timedelta(hours=24)
            
            self.session.commit()
            self.session.refresh(job)
            
            logger.info(f"Retrying export job {job_id} (attempt {job.retry_count + 1})")
        
        return job
    
    def cancel_job(self, job_id: str, user_id: Optional[int] = None) -> Optional[ExportJob]:
        """Cancel a pending or processing job"""
        job = self.get_job_by_id(job_id)
        
        if not job:
            return None
        
        # Check ownership if user_id provided
        if user_id and job.user_id != user_id:
            return None
        
        # Only allow cancellation of pending or processing jobs
        if job.status in [ExportStatus.PENDING, ExportStatus.PROCESSING]:
            job.status = ExportStatus.CANCELLED
            job.completed_at = datetime.utcnow()
            job.progress = 100
            
            self.session.commit()
            self.session.refresh(job)
            
            logger.info(f"Cancelled export job {job_id}")
        
        return job
    
    def delete_job(self, job_id: str, delete_file: bool = True) -> bool:
        """Delete an export job and optionally its file"""
        job = self.get_job_by_id(job_id)
        if not job:
            return False
        
        # Delete file if requested and exists
        if delete_file and job.file_path:
            try:
                import os
                if os.path.exists(job.file_path):
                    os.remove(job.file_path)
                    logger.info(f"Deleted export file: {job.file_path}")
            except Exception as e:
                logger.warning(f"Could not delete file {job.file_path}: {e}")
        
        # Delete job record
        self.session.delete(job)
        self.session.commit()
        
        logger.info(f"Deleted export job {job_id}")
        return True
    
    def cleanup_expired_jobs(self, delete_files: bool = True) -> int:
        """Clean up expired export jobs"""
        return ExportJob.cleanup_expired_jobs(self.session, delete_files)
    
    def get_job_statistics(self, user_id: Optional[int] = None, days: int = 30) -> Dict[str, Any]:
        """Get export job statistics"""
        from sqlalchemy import func, case
        
        # Base query
        query = self.session.query(ExportJob)
        
        if user_id:
            query = query.filter(ExportJob.user_id == user_id)
        
        # Filter by date range
        since_date = datetime.utcnow() - timedelta(days=days)
        query = query.filter(ExportJob.created_at >= since_date)
        
        # Get status counts
        status_counts = self.session.query(
            ExportJob.status,
            func.count(ExportJob.id)
        ).filter(
            ExportJob.created_at >= since_date
        )
        
        if user_id:
            status_counts = status_counts.filter(ExportJob.user_id == user_id)
        
        status_counts = status_counts.group_by(ExportJob.status).all()
        
        # Get format counts
        format_counts = self.session.query(
            ExportJob.format,
            func.count(ExportJob.id)
        ).filter(
            ExportJob.created_at >= since_date
        )
        
        if user_id:
            format_counts = format_counts.filter(ExportJob.user_id == user_id)
        
        format_counts = format_counts.group_by(ExportJob.format).all()
        
        # Get average processing time for completed jobs
        completed_jobs = query.filter(
            ExportJob.status == ExportStatus.COMPLETED,
            ExportJob.started_at.isnot(None),
            ExportJob.completed_at.isnot(None)
        ).all()
        
        processing_times = []
        total_file_size = 0
        
        for job in completed_jobs:
            if job.started_at and job.completed_at:
                processing_time = (job.completed_at - job.started_at).total_seconds()
                processing_times.append(processing_time)
            
            if job.file_size:
                total_file_size += job.file_size
        
        avg_processing_time = sum(processing_times) / len(processing_times) if processing_times else 0
        
        return {
            'total_jobs': query.count(),
            'status_counts': dict(status_counts),
            'format_counts': dict(format_counts),
            'avg_processing_time_seconds': avg_processing_time,
            'total_file_size_bytes': total_file_size,
            'success_rate': (
                len([s for s, c in status_counts if s == ExportStatus.COMPLETED]) / 
                max(1, sum(c for s, c in status_counts))
            ) * 100 if status_counts else 0,
            'period_days': days
        }
    
    def get_user_export_quota(self, user_id: int, period_hours: int = 24) -> Dict[str, Any]:
        """Get user's export quota usage"""
        since_date = datetime.utcnow() - timedelta(hours=period_hours)
        
        jobs_in_period = self.session.query(ExportJob).filter(
            ExportJob.user_id == user_id,
            ExportJob.created_at >= since_date
        ).all()
        
        total_jobs = len(jobs_in_period)
        total_file_size = sum(job.file_size or 0 for job in jobs_in_period)
        
        # Count by format
        format_counts = {}
        for job in jobs_in_period:
            format_counts[job.format] = format_counts.get(job.format, 0) + 1
        
        return {
            'user_id': user_id,
            'period_hours': period_hours,
            'total_jobs': total_jobs,
            'total_file_size_bytes': total_file_size,
            'format_counts': format_counts,
            'oldest_job': min(job.created_at for job in jobs_in_period) if jobs_in_period else None,
            'newest_job': max(job.created_at for job in jobs_in_period) if jobs_in_period else None
        }
