import { useState, useCallback, useRef, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import {
  downloadExport,
  createBatchExport,
  getExportJobStatus,
  downloadExportJob,
  ExportOptions,
  ExportJob,
  BatchExportOptions
} from '../utils/exportUtils';

interface UseExportState {
  isExporting: boolean;
  exportJobs: ExportJob[];
  error: string | null;
}

interface UseExportActions {
  exportAnalysis: (options: ExportOptions) => Promise<void>;
  batchExport: (options: BatchExportOptions) => Promise<string[]>;
  downloadJob: (jobId: string, filename?: string) => Promise<void>;
  clearJobs: () => void;
  removeJob: (jobId: string) => void;
  refreshJobStatus: (jobId: string) => Promise<void>;
  getActiveJobs: () => ExportJob[];
  getCompletedJobs: () => ExportJob[];
  getFailedJobs: () => ExportJob[];
}

type UseExportReturn = UseExportState & UseExportActions;

/**
 * Custom hook for managing export operations
 */
export function useExport(): UseExportReturn {
  const [state, setState] = useState<UseExportState>({
    isExporting: false,
    exportJobs: [],
    error: null
  });
  
  const { showError, showSuccess } = useError();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Auto-poll active jobs
  useEffect(() => {
    const activeJobs = state.exportJobs.filter(job => 
      ['pending', 'processing'].includes(job.status)
    );
    
    if (activeJobs.length > 0) {
      pollIntervalRef.current = setInterval(() => {
        activeJobs.forEach(job => {
          refreshJobStatus(job.id).catch(console.error);
        });
      }, 3000); // Poll every 3 seconds
      
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [state.exportJobs]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);
  
  const updateState = useCallback((updates: Partial<UseExportState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);
  
  const addJob = useCallback((job: ExportJob) => {
    setState(prev => ({
      ...prev,
      exportJobs: [job, ...prev.exportJobs.slice(0, 9)] // Keep max 10 jobs
    }));
  }, []);
  
  const updateJob = useCallback((jobId: string, updates: Partial<ExportJob>) => {
    setState(prev => ({
      ...prev,
      exportJobs: prev.exportJobs.map(job => 
        job.id === jobId ? { ...job, ...updates } : job
      )
    }));
  }, []);
  
  const exportAnalysis = useCallback(async (options: ExportOptions) => {
    updateState({ isExporting: true, error: null });
    
    try {
      await downloadExport(options);
      showSuccess(`${options.format.toUpperCase()} export completed!`);
    } catch (error: any) {
      const errorMessage = error.message || 'Export failed';
      updateState({ error: errorMessage });
      showError(errorMessage);
      throw error;
    } finally {
      updateState({ isExporting: false });
    }
  }, [updateState, showError, showSuccess]);
  
  const batchExport = useCallback(async (options: BatchExportOptions): Promise<string[]> => {
    updateState({ isExporting: true, error: null });
    
    try {
      const jobIds = await createBatchExport(options);
      
      // Add jobs to tracking list
      jobIds.forEach(jobId => {
        const job: ExportJob = {
          id: jobId,
          analysisId: options.analysisIds[0], // For display purposes
          format: options.format,
          status: 'pending',
          progress: 0,
          createdAt: new Date().toISOString()
        };
        addJob(job);
      });
      
      showSuccess(`Created ${jobIds.length} export job(s)`);
      return jobIds;
      
    } catch (error: any) {
      const errorMessage = error.message || 'Batch export failed';
      updateState({ error: errorMessage });
      showError(errorMessage);
      throw error;
    } finally {
      updateState({ isExporting: false });
    }
  }, [updateState, showError, showSuccess, addJob]);
  
  const downloadJob = useCallback(async (jobId: string, filename?: string) => {
    try {
      await downloadExportJob(jobId, filename);
      showSuccess('Download started!');
    } catch (error: any) {
      const errorMessage = error.message || 'Download failed';
      showError(errorMessage);
      throw error;
    }
  }, [showError, showSuccess]);
  
  const refreshJobStatus = useCallback(async (jobId: string) => {
    try {
      const jobStatus = await getExportJobStatus(jobId);
      updateJob(jobId, jobStatus);
      
      // Show notification for status changes
      const currentJob = state.exportJobs.find(j => j.id === jobId);
      if (currentJob && currentJob.status !== jobStatus.status) {
        if (jobStatus.status === 'completed') {
          showSuccess(`Export completed: ${jobStatus.filename || 'File ready'}`);
        } else if (jobStatus.status === 'failed') {
          showError(`Export failed: ${jobStatus.error || 'Unknown error'}`);
        }
      }
      
    } catch (error: any) {
      console.error(`Failed to refresh job ${jobId}:`, error);
      // Don't show error to user for polling failures
    }
  }, [updateJob, showError, showSuccess, state.exportJobs]);
  
  const clearJobs = useCallback(() => {
    setState(prev => ({ ...prev, exportJobs: [] }));
  }, []);
  
  const removeJob = useCallback((jobId: string) => {
    setState(prev => ({
      ...prev,
      exportJobs: prev.exportJobs.filter(job => job.id !== jobId)
    }));
  }, []);
  
  const getActiveJobs = useCallback(() => {
    return state.exportJobs.filter(job => ['pending', 'processing'].includes(job.status));
  }, [state.exportJobs]);
  
  const getCompletedJobs = useCallback(() => {
    return state.exportJobs.filter(job => job.status === 'completed');
  }, [state.exportJobs]);
  
  const getFailedJobs = useCallback(() => {
    return state.exportJobs.filter(job => job.status === 'failed');
  }, [state.exportJobs]);
  
  return {
    ...state,
    exportAnalysis,
    batchExport,
    downloadJob,
    clearJobs,
    removeJob,
    refreshJobStatus,
    getActiveJobs,
    getCompletedJobs,
    getFailedJobs
  };
}

/**
 * Hook for simple export operations (no job tracking)
 */
export function useSimpleExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { showError, showSuccess } = useError();
  
  const exportAnalysis = useCallback(async (options: ExportOptions) => {
    setIsExporting(true);
    
    try {
      await downloadExport(options);
      showSuccess(`${options.format.toUpperCase()} export completed!`);
    } catch (error: any) {
      const errorMessage = error.message || 'Export failed';
      showError(errorMessage);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, [showError, showSuccess]);
  
  return {
    isExporting,
    exportAnalysis
  };
}

export default useExport;
