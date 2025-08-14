import { apiClient } from './apiClient';

export interface ExportOptions {
  analysisId: string;
  format: 'excel' | 'csv' | 'pdf' | 'json' | 'html';
  filename?: string;
}

export interface ExportJob {
  id: string;
  analysisId: string;
  format: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  filename?: string;
  error?: string;
  fileSize?: number;
}

export interface BatchExportOptions {
  analysisIds: string[];
  format: 'excel' | 'csv' | 'pdf' | 'json' | 'html';
}

/**
 * Download a file directly from the export API
 */
export async function downloadExport(options: ExportOptions): Promise<void> {
  const { analysisId, format, filename } = options;
  
  try {
    const response = await apiClient.get(
      `/api/export/outlier/${analysisId}/${format}`,
      { responseType: 'blob' }
    );
    
    const mimeTypes = {
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      pdf: 'application/pdf',
      json: 'application/json',
      html: 'text/html'
    };
    
    const fileExtensions = {
      excel: 'xlsx',
      csv: 'csv',
      pdf: 'pdf',
      json: 'json',
      html: 'html'
    };
    
    const blob = new Blob([response.data], { type: mimeTypes[format] });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = filename || `analysis_${analysisId}_${new Date().toISOString().slice(0, 10)}.${fileExtensions[format]}`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    window.URL.revokeObjectURL(url);
    
  } catch (error: any) {
    console.error('Export download failed:', error);
    throw new Error(error.response?.data?.error || 'Export download failed');
  }
}

/**
 * Create a batch export job
 */
export async function createBatchExport(options: BatchExportOptions): Promise<string[]> {
  try {
    const response = await apiClient.post('/api/export/batch', options);
    
    if (response.data.success) {
      return response.data.jobIds;
    } else {
      throw new Error(response.data.error || 'Failed to create batch export');
    }
  } catch (error: any) {
    console.error('Batch export creation failed:', error);
    throw new Error(error.response?.data?.error || 'Batch export creation failed');
  }
}

/**
 * Get the status of an export job
 */
export async function getExportJobStatus(jobId: string): Promise<ExportJob> {
  try {
    const response = await apiClient.get(`/api/export/job/${jobId}/status`);
    
    if (response.data.success) {
      return response.data.job;
    } else {
      throw new Error(response.data.error || 'Failed to get job status');
    }
  } catch (error: any) {
    console.error('Failed to get export job status:', error);
    throw new Error(error.response?.data?.error || 'Failed to get job status');
  }
}

/**
 * Download a completed export job
 */
export async function downloadExportJob(jobId: string, filename?: string): Promise<void> {
  try {
    const response = await apiClient.get(
      `/api/export/job/${jobId}/download`,
      { responseType: 'blob' }
    );
    
    // Get filename from response headers if available
    const contentDisposition = response.headers['content-disposition'];
    let downloadFilename = filename;
    
    if (!downloadFilename && contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        downloadFilename = filenameMatch[1];
      }
    }
    
    if (!downloadFilename) {
      downloadFilename = `export_${jobId}.xlsx`;
    }
    
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = downloadFilename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    window.URL.revokeObjectURL(url);
    
  } catch (error: any) {
    console.error('Export job download failed:', error);
    throw new Error(error.response?.data?.error || 'Export job download failed');
  }
}

/**
 * Get supported export formats
 */
export async function getSupportedFormats(): Promise<any> {
  try {
    const response = await apiClient.get('/api/export/formats');
    return response.data;
  } catch (error: any) {
    console.error('Failed to get supported formats:', error);
    throw new Error('Failed to get supported formats');
  }
}

/**
 * Export user analytics
 */
export async function exportUserAnalytics(format: 'json' = 'json'): Promise<void> {
  try {
    const response = await apiClient.get(
      `/api/export/analytics/${format}`,
      { responseType: 'blob' }
    );
    
    const blob = new Blob([response.data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = `user_analytics_${new Date().toISOString().slice(0, 10)}.json`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    window.URL.revokeObjectURL(url);
    
  } catch (error: any) {
    console.error('Analytics export failed:', error);
    throw new Error(error.response?.data?.error || 'Analytics export failed');
  }
}

/**
 * Export analysis history
 */
export async function exportAnalysisHistory(format: 'json' = 'json'): Promise<void> {
  try {
    const response = await apiClient.get(
      `/api/export/history?format=${format}`,
      { responseType: 'blob' }
    );
    
    const blob = new Blob([response.data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = `analysis_history_${new Date().toISOString().slice(0, 10)}.json`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    window.URL.revokeObjectURL(url);
    
  } catch (error: any) {
    console.error('History export failed:', error);
    throw new Error(error.response?.data?.error || 'History export failed');
  }
}

/**
 * Utility to format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Utility to get export format display information
 */
export function getExportFormatInfo(format: string) {
  const formatInfo = {
    excel: {
      name: 'Excel (.xlsx)',
      description: 'Professional spreadsheet with multiple sheets and charts',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      recommended: true
    },
    csv: {
      name: 'CSV (.csv)',
      description: 'Simple comma-separated values for data analysis',
      mimeType: 'text/csv',
      extension: 'csv',
      recommended: false
    },
    pdf: {
      name: 'PDF (.pdf)',
      description: 'Formatted report for presentations and sharing',
      mimeType: 'application/pdf',
      extension: 'pdf',
      recommended: false
    },
    json: {
      name: 'JSON (.json)',
      description: 'Raw data format for developers and APIs',
      mimeType: 'application/json',
      extension: 'json',
      recommended: false
    },
    html: {
      name: 'HTML (.html)',
      description: 'Interactive web page with clickable links',
      mimeType: 'text/html',
      extension: 'html',
      recommended: false
    }
  };
  
  return formatInfo[format as keyof typeof formatInfo] || null;
}

/**
 * Check if export is available for an analysis
 */
export function canExportAnalysis(analysisStatus: string): boolean {
  return analysisStatus === 'completed';
}

/**
 * Get estimated export size based on result count
 */
export function getEstimatedExportSize(resultCount: number, format: string): string {
  // Rough estimates based on typical data sizes
  const estimatesPerResult = {
    excel: 2048, // 2KB per result (with formatting and charts)
    csv: 512,    // 512 bytes per result
    pdf: 1024,   // 1KB per result
    json: 1024,  // 1KB per result
    html: 768    // 768 bytes per result
  };
  
  const bytesPerResult = estimatesPerResult[format as keyof typeof estimatesPerResult] || 1024;
  const estimatedBytes = resultCount * bytesPerResult;
  
  return formatFileSize(estimatedBytes);
}
