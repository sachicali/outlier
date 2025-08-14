import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, File, Globe, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useError } from '../contexts/ErrorContext';

interface ExportManagerProps {
  analysisId: string;
  resultCount: number;
  onExportStart?: () => void;
  onExportComplete?: (format: string) => void;
}

interface ExportJob {
  id: string;
  analysisId: string;
  format: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  filename?: string;
  error?: string;
}

interface ExportFormat {
  key: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  mimeType: string;
  recommended?: boolean;
}

const EXPORT_FORMATS: ExportFormat[] = [
  {
    key: 'excel',
    name: 'Excel (.xlsx)',
    description: 'Professional spreadsheet with multiple sheets, charts, and formatting',
    icon: FileSpreadsheet,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    recommended: true
  },
  {
    key: 'csv',
    name: 'CSV (.csv)',
    description: 'Simple comma-separated values for data analysis',
    icon: FileText,
    mimeType: 'text/csv'
  },
  {
    key: 'pdf',
    name: 'PDF (.pdf)',
    description: 'Formatted report for presentations and sharing',
    icon: File,
    mimeType: 'application/pdf'
  },
  {
    key: 'json',
    name: 'JSON (.json)',
    description: 'Raw data format for developers and APIs',
    icon: File,
    mimeType: 'application/json'
  },
  {
    key: 'html',
    name: 'HTML (.html)',
    description: 'Interactive web page with clickable links',
    icon: Globe,
    mimeType: 'text/html'
  }
];

const ExportManager: React.FC<ExportManagerProps> = ({
  analysisId,
  resultCount,
  onExportStart,
  onExportComplete
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string>('excel');
  const [isExporting, setIsExporting] = useState(false);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [useBackgroundJob, setUseBackgroundJob] = useState(false);
  const { showError, showSuccess } = useError();

  // Auto-enable background jobs for large result sets
  useEffect(() => {
    setUseBackgroundJob(resultCount > 100);
  }, [resultCount]);

  // Poll for export job status
  useEffect(() => {
    if (exportJobs.some(job => ['pending', 'processing'].includes(job.status))) {
      const interval = setInterval(checkJobStatuses, 2000);
      return () => clearInterval(interval);
    }
  }, [exportJobs]);

  const checkJobStatuses = async () => {
    const pendingJobs = exportJobs.filter(job => ['pending', 'processing'].includes(job.status));
    
    for (const job of pendingJobs) {
      try {
        const response = await apiClient.get(`/api/export/job/${job.id}/status`);
        if (response.data.success) {
          const updatedJob = response.data.job;
          setExportJobs(prev => 
            prev.map(j => j.id === job.id ? { ...j, ...updatedJob } : j)
          );
          
          if (updatedJob.status === 'completed') {
            showSuccess(`Export completed: ${updatedJob.filename}`);
            onExportComplete?.(job.format);
          } else if (updatedJob.status === 'failed') {
            showError(`Export failed: ${updatedJob.error || 'Unknown error'}`);
          }
        }
      } catch (error) {
        console.error(`Error checking job ${job.id}:`, error);
      }
    }
  };

  const handleDirectExport = async (format: string) => {
    setIsExporting(true);
    onExportStart?.();
    
    try {
      const response = await apiClient.get(
        `/api/export/outlier/${analysisId}/${format}`,
        { responseType: 'blob' }
      );
      
      // Create download link
      const formatConfig = EXPORT_FORMATS.find(f => f.key === format);
      const blob = new Blob([response.data], { type: formatConfig?.mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.href = url;
      link.download = `analysis_${analysisId}_${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showSuccess(`${formatConfig?.name} export completed!`);
      onExportComplete?.(format);
      setIsOpen(false);
      
    } catch (error) {
      console.error('Export error:', error);
      showError('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleBackgroundExport = async (format: string) => {
    setIsExporting(true);
    onExportStart?.();
    
    try {
      const response = await apiClient.post('/api/export/batch', {
        analysisIds: [analysisId],
        format: format
      });
      
      if (response.data.success && response.data.jobIds.length > 0) {
        const jobId = response.data.jobIds[0];
        
        // Add job to tracking list
        const newJob: ExportJob = {
          id: jobId,
          analysisId,
          format,
          status: 'pending',
          progress: 0,
          createdAt: new Date().toISOString()
        };
        
        setExportJobs(prev => [newJob, ...prev]);
        showSuccess('Export job started. You will be notified when complete.');
        setIsOpen(false);
      } else {
        throw new Error('Failed to create export job');
      }
    } catch (error) {
      console.error('Background export error:', error);
      showError('Failed to start export job. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = (format: string) => {
    if (useBackgroundJob) {
      handleBackgroundExport(format);
    } else {
      handleDirectExport(format);
    }
  };

  const downloadCompletedExport = async (job: ExportJob) => {
    try {
      const response = await apiClient.get(
        `/api/export/job/${job.id}/download`,
        { responseType: 'blob' }
      );
      
      const formatConfig = EXPORT_FORMATS.find(f => f.key === job.format);
      const blob = new Blob([response.data], { type: formatConfig?.mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.href = url;
      link.download = job.filename || `export_${job.id}.${job.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showSuccess('Download started!');
    } catch (error) {
      console.error('Download error:', error);
      showError('Download failed. The file may have expired.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'processing':
        return 'bg-blue-500';
      default:
        return 'bg-yellow-500';
    }
  };

  return (
    <div className="relative">
      {/* Export Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        disabled={isExporting}
      >
        <Download className="w-4 h-4 mr-2" />
        {isExporting ? 'Exporting...' : 'Export Results'}
      </button>

      {/* Export Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Export Analysis Results
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Export Options */}
              <div className="space-y-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>{resultCount}</strong> results found. 
                    {useBackgroundJob && (
                      <span className="block mt-1">
                        Large result sets will be processed in the background.
                      </span>
                    )}
                  </p>
                </div>

                <div className="grid gap-3">
                  {EXPORT_FORMATS.map((format) => {
                    const IconComponent = format.icon;
                    return (
                      <div
                        key={format.key}
                        className={`relative border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedFormat === format.key
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedFormat(format.key)}
                      >
                        <div className="flex items-start space-x-3">
                          <input
                            type="radio"
                            name="exportFormat"
                            value={format.key}
                            checked={selectedFormat === format.key}
                            onChange={() => setSelectedFormat(format.key)}
                            className="mt-1"
                          />
                          <IconComponent className="w-5 h-5 text-gray-600 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium text-gray-900">{format.name}</h4>
                              {format.recommended && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Recommended
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{format.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleExport(selectedFormat)}
                  disabled={isExporting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? 'Starting Export...' : `Export as ${EXPORT_FORMATS.find(f => f.key === selectedFormat)?.name}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Jobs Status */}
      {exportJobs.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm w-full z-40">
          <h4 className="font-medium text-gray-900 mb-3">Export Jobs</h4>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {exportJobs.map((job) => {
              const formatConfig = EXPORT_FORMATS.find(f => f.key === job.format);
              return (
                <div key={job.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(job.status)}
                      <span className="text-sm font-medium text-gray-900">
                        {formatConfig?.name}
                      </span>
                    </div>
                    {job.status === 'completed' && (
                      <button
                        onClick={() => downloadCompletedExport(job)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Download
                      </button>
                    )}
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(job.status)}`}
                      style={{ width: `${job.progress}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span className="capitalize">{job.status}</span>
                    <span>{job.progress}%</span>
                  </div>
                  
                  {job.error && (
                    <p className="text-xs text-red-600 mt-1">{job.error}</p>
                  )}
                </div>
              );
            })}
          </div>
          
          {exportJobs.length > 3 && (
            <button
              onClick={() => setExportJobs(prev => prev.slice(0, 3))}
              className="text-xs text-gray-500 hover:text-gray-700 mt-2 w-full text-center"
            >
              Clear old jobs
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ExportManager;
