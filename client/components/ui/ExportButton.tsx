import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, File, Globe, ChevronDown } from 'lucide-react';
import { apiClient } from '../../utils/apiClient';
import { useError } from '../../contexts/ErrorContext';

interface ExportButtonProps {
  analysisId: string;
  resultCount?: number;
  className?: string;
  variant?: 'button' | 'dropdown';
  size?: 'sm' | 'md' | 'lg';
}

interface ExportFormat {
  key: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const EXPORT_FORMATS: ExportFormat[] = [
  {
    key: 'excel',
    name: 'Excel',
    icon: FileSpreadsheet,
    description: 'Professional spreadsheet with charts'
  },
  {
    key: 'csv',
    name: 'CSV',
    icon: FileText,
    description: 'Simple data format'
  },
  {
    key: 'pdf',
    name: 'PDF',
    icon: File,
    description: 'Formatted report'
  },
  {
    key: 'json',
    name: 'JSON',
    icon: File,
    description: 'Raw data'
  },
  {
    key: 'html',
    name: 'HTML',
    icon: Globe,
    description: 'Interactive web page'
  }
];

const ExportButton: React.FC<ExportButtonProps> = ({
  analysisId,
  resultCount = 0,
  className = '',
  variant = 'dropdown',
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { showError, showSuccess } = useError();

  const handleExport = async (format: string) => {
    setIsExporting(true);
    setIsOpen(false);
    
    try {
      const response = await apiClient.get(
        `/api/export/outlier/${analysisId}/${format}`,
        { responseType: 'blob' }
      );
      
      // Create download link
      const formatConfig = EXPORT_FORMATS.find(f => f.key === format);
      const mimeTypes = {
        excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv: 'text/csv',
        pdf: 'application/pdf',
        json: 'application/json',
        html: 'text/html'
      };
      
      const blob = new Blob([response.data], { type: mimeTypes[format as keyof typeof mimeTypes] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const fileExtensions = {
        excel: 'xlsx',
        csv: 'csv',
        pdf: 'pdf',
        json: 'json',
        html: 'html'
      };
      
      link.href = url;
      link.download = `analysis_${analysisId}_${new Date().toISOString().slice(0, 10)}.${fileExtensions[format as keyof typeof fileExtensions]}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showSuccess(`${formatConfig?.name} export completed!`);
      
    } catch (error: any) {
      console.error('Export error:', error);
      const errorMessage = error.response?.data?.error || 'Export failed. Please try again.';
      showError(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  if (variant === 'button') {
    return (
      <button
        onClick={() => handleExport('excel')}
        disabled={isExporting}
        className={`inline-flex items-center ${sizeClasses[size]} bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      >
        <Download className={`${iconSizes[size]} mr-2`} />
        {isExporting ? 'Exporting...' : 'Export'}
      </button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className={`inline-flex items-center ${sizeClasses[size]} bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
      >
        <Download className={`${iconSizes[size]} mr-2`} />
        {isExporting ? 'Exporting...' : 'Export'}
        <ChevronDown className={`${iconSizes[size]} ml-2`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
            <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
              Export Formats
            </div>
            
            {EXPORT_FORMATS.map((format) => {
              const IconComponent = format.icon;
              return (
                <button
                  key={format.key}
                  onClick={() => handleExport(format.key)}
                  disabled={isExporting}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <IconComponent className="w-4 h-4 mr-3 text-gray-400" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{format.name}</div>
                    <div className="text-xs text-gray-500">{format.description}</div>
                  </div>
                </button>
              );
            })}
            
            {resultCount > 0 && (
              <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-100 mt-2">
                {resultCount} results to export
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ExportButton;
