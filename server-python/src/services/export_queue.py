import os
import json
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from queue import Queue, Empty
from utils.logger import logger
from db import redis_client
from .export_service import ExportService

class ExportQueueManager:
    """Manager for handling export job queues"""
    
    def __init__(self, max_workers: int = 3):
        self.max_workers = max_workers
        self.export_service = ExportService()
        self.job_queue = Queue()
        self.workers = []
        self.running = False
        
        # Start worker threads
        self.start_workers()
    
    def start_workers(self):
        """Start background worker threads"""
        self.running = True
        
        for i in range(self.max_workers):
            worker = threading.Thread(
                target=self._worker_loop,
                name=f'ExportWorker-{i+1}',
                daemon=True
            )
            worker.start()
            self.workers.append(worker)
            
        logger.info(f"Started {self.max_workers} export workers")
    
    def stop_workers(self):
        """Stop all worker threads"""
        self.running = False
        
        # Add poison pills to stop workers
        for _ in range(self.max_workers):
            self.job_queue.put(None)
        
        # Wait for workers to finish
        for worker in self.workers:
            worker.join(timeout=5)
        
        self.workers.clear()
        logger.info("Stopped all export workers")
    
    def _worker_loop(self):
        """Main worker loop for processing export jobs"""
        worker_name = threading.current_thread().name
        logger.info(f"{worker_name} started")
        
        while self.running:
            try:
                # Get job from queue with timeout
                job_data = self.job_queue.get(timeout=1)
                
                # Check for poison pill (shutdown signal)
                if job_data is None:
                    break
                
                self._process_export_job(job_data, worker_name)
                
            except Empty:
                # Timeout occurred, continue loop
                continue
            except Exception as e:
                logger.error(f"{worker_name} error: {e}")
        
        logger.info(f"{worker_name} stopped")
    
    def _process_export_job(self, job_data: Dict[str, Any], worker_name: str):
        """Process a single export job"""
        job_id = job_data['id']
        analysis_id = job_data['analysis_id']
        format_type = job_data['format']
        user_id = job_data.get('user_id')
        
        logger.info(f"{worker_name} processing export job {job_id} for analysis {analysis_id}")
        
        try:
            # Update job status to processing
            job_data['status'] = 'processing'
            job_data['progress'] = 10
            job_data['started_at'] = datetime.utcnow().isoformat()
            redis_client.setex(f'export_job:{job_id}', 3600, json.dumps(job_data))
            
            # Generate export based on format
            job_data['progress'] = 30
            redis_client.setex(f'export_job:{job_id}', 3600, json.dumps(job_data))
            
            if format_type == 'excel':
                result = self.export_service.export_to_excel(analysis_id, user_id)
                file_extension = 'xlsx'
            elif format_type == 'csv':
                result = self.export_service.export_to_csv(analysis_id, user_id)
                file_extension = 'csv'
            elif format_type == 'pdf':
                result = self.export_service.export_to_pdf(analysis_id, user_id)
                file_extension = 'pdf'
            elif format_type == 'json':
                result = self.export_service.export_to_json(analysis_id, user_id)
                file_extension = 'json'
            elif format_type == 'html':
                result = self.export_service.export_to_html(analysis_id, user_id)
                file_extension = 'html'
            else:
                raise ValueError(f"Unsupported format: {format_type}")
            
            # Update progress
            job_data['progress'] = 70
            redis_client.setex(f'export_job:{job_id}', 3600, json.dumps(job_data))
            
            # Save to temporary file
            filename = f"analysis_{analysis_id}_{job_id}.{file_extension}"
            filepath = os.path.join(self.export_service.temp_dir, filename)
            
            if hasattr(result, 'getvalue'):  # BytesIO or StringIO
                mode = 'wb' if hasattr(result, 'read') and hasattr(result, 'mode') else 'w'
                if format_type in ['excel', 'pdf']:
                    mode = 'wb'
                elif format_type == 'csv':
                    mode = 'w'
                else:
                    mode = 'w'
                
                with open(filepath, mode, encoding='utf-8' if mode == 'w' else None) as f:
                    f.write(result.getvalue())
            else:  # String content
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(result)
            
            # Calculate file size
            file_size = os.path.getsize(filepath)
            
            # Update job to completed
            job_data['status'] = 'completed'
            job_data['progress'] = 100
            job_data['completed_at'] = datetime.utcnow().isoformat()
            job_data['file_path'] = filepath
            job_data['filename'] = filename
            job_data['file_size'] = file_size
            
            # Store with longer TTL for completed jobs
            redis_client.setex(f'export_job:{job_id}', 86400, json.dumps(job_data))
            
            logger.info(f"{worker_name} completed export job {job_id}, file size: {file_size} bytes")
            
        except Exception as e:
            logger.error(f"{worker_name} failed to process export job {job_id}: {e}")
            
            # Update job to failed
            job_data['status'] = 'failed'
            job_data['progress'] = 100
            job_data['error'] = str(e)
            job_data['failed_at'] = datetime.utcnow().isoformat()
            
            redis_client.setex(f'export_job:{job_id}', 3600, json.dumps(job_data))
    
    def queue_export_job(self, job_data: Dict[str, Any]) -> bool:
        """Add export job to queue"""
        try:
            self.job_queue.put(job_data, timeout=1)
            logger.info(f"Queued export job {job_data['id']}")
            return True
        except Exception as e:
            logger.error(f"Failed to queue export job {job_data['id']}: {e}")
            return False
    
    def get_queue_size(self) -> int:
        """Get current queue size"""
        return self.job_queue.qsize()
    
    def get_worker_status(self) -> Dict[str, Any]:
        """Get worker status information"""
        return {
            'running': self.running,
            'max_workers': self.max_workers,
            'active_workers': len([w for w in self.workers if w.is_alive()]),
            'queue_size': self.get_queue_size()
        }
    
    def cleanup_old_jobs(self, max_age_hours: int = 24):
        """Clean up old export jobs from Redis"""
        try:
            # Get all export job keys
            job_keys = redis_client.keys('export_job:*')
            cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
            
            cleaned_count = 0
            for key in job_keys:
                try:
                    job_data = redis_client.get(key)
                    if job_data:
                        job = json.loads(job_data)
                        created_at = datetime.fromisoformat(job.get('created_at', '2000-01-01T00:00:00'))
                        
                        if created_at < cutoff_time:
                            # Clean up file if exists
                            file_path = job.get('file_path')
                            if file_path and os.path.exists(file_path):
                                try:
                                    os.remove(file_path)
                                except Exception as e:
                                    logger.warning(f"Could not delete file {file_path}: {e}")
                            
                            # Remove job from Redis
                            redis_client.delete(key)
                            cleaned_count += 1
                            
                except Exception as e:
                    logger.warning(f"Error cleaning up job {key}: {e}")
            
            logger.info(f"Cleaned up {cleaned_count} old export jobs")
            return cleaned_count
            
        except Exception as e:
            logger.error(f"Error during export job cleanup: {e}")
            return 0
    
    def get_job_statistics(self) -> Dict[str, Any]:
        """Get export job statistics"""
        try:
            job_keys = redis_client.keys('export_job:*')
            
            stats = {
                'total_jobs': len(job_keys),
                'pending': 0,
                'processing': 0,
                'completed': 0,
                'failed': 0,
                'formats': {},
                'avg_processing_time': 0
            }
            
            processing_times = []
            
            for key in job_keys:
                try:
                    job_data = redis_client.get(key)
                    if job_data:
                        job = json.loads(job_data)
                        status = job.get('status', 'unknown')
                        format_type = job.get('format', 'unknown')
                        
                        # Count by status
                        if status in stats:
                            stats[status] += 1
                        
                        # Count by format
                        if format_type in stats['formats']:
                            stats['formats'][format_type] += 1
                        else:
                            stats['formats'][format_type] = 1
                        
                        # Calculate processing time for completed jobs
                        if status == 'completed':
                            started_at = job.get('started_at')
                            completed_at = job.get('completed_at')
                            if started_at and completed_at:
                                start_time = datetime.fromisoformat(started_at)
                                end_time = datetime.fromisoformat(completed_at)
                                processing_time = (end_time - start_time).total_seconds()
                                processing_times.append(processing_time)
                                
                except Exception as e:
                    logger.warning(f"Error processing job stats for {key}: {e}")
            
            # Calculate average processing time
            if processing_times:
                stats['avg_processing_time'] = sum(processing_times) / len(processing_times)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting job statistics: {e}")
            return {'error': str(e)}

# Global export queue manager instance
export_queue_manager = None

def get_export_queue_manager() -> ExportQueueManager:
    """Get or create the global export queue manager"""
    global export_queue_manager
    
    if export_queue_manager is None:
        export_queue_manager = ExportQueueManager()
    
    return export_queue_manager

def shutdown_export_queue_manager():
    """Shutdown the global export queue manager"""
    global export_queue_manager
    
    if export_queue_manager is not None:
        export_queue_manager.stop_workers()
        export_queue_manager = None
