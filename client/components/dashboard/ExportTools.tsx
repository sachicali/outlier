import React, { useState } from 'react'
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Mail,
  Calendar,
  Settings,
  X
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface ExportToolsProps {
  onExport: (format: 'pdf' | 'excel') => Promise<void>
}

const ExportTools: React.FC<ExportToolsProps> = ({ onExport }) => {
  const [showModal, setShowModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportOptions, setExportOptions] = useState({
    format: 'excel' as 'pdf' | 'excel',
    includeCharts: true,
    includeRawData: true,
    dateRange: '30d',
    scheduledExport: false,
    emailReport: false,
    reportFrequency: 'weekly' as 'daily' | 'weekly' | 'monthly'
  })

  const handleExport = async () => {
    try {
      setExporting(true)
      await onExport(exportOptions.format)
      setShowModal(false)
      
      if (exportOptions.scheduledExport) {
        toast.success(`Scheduled ${exportOptions.reportFrequency} exports enabled`)
      }
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleScheduledExport = async () => {
    // In a real implementation, this would set up scheduled exports
    toast.success(`Scheduled ${exportOptions.reportFrequency} exports configured`)
    setShowModal(false)
  }

  return (
    <>
      {/* Export Button */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onExport('excel')}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          title="Quick export to Excel"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export
        </button>
        
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          title="Advanced export options"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Export Options Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Export Options
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setExportOptions(prev => ({ ...prev, format: 'excel' }))}
                    className={`p-3 border-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                      exportOptions.format === 'excel'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <FileSpreadsheet className="h-5 w-5" />
                    <span className="text-sm font-medium">Excel</span>
                  </button>
                  
                  <button
                    onClick={() => setExportOptions(prev => ({ ...prev, format: 'pdf' }))}
                    className={`p-3 border-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                      exportOptions.format === 'pdf'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <FileText className="h-5 w-5" />
                    <span className="text-sm font-medium">PDF</span>
                  </button>
                </div>
              </div>

              {/* Content Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Include
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeCharts}
                      onChange={(e) => setExportOptions(prev => ({ ...prev, includeCharts: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Charts and visualizations</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeRawData}
                      onChange={(e) => setExportOptions(prev => ({ ...prev, includeRawData: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Raw data tables</span>
                  </label>
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date Range
                </label>
                <select
                  value={exportOptions.dateRange}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, dateRange: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="1y">Last year</option>
                  <option value="all">All time</option>
                </select>
              </div>

              {/* Scheduled Export */}
              <div>
                <label className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.scheduledExport}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, scheduledExport: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Schedule automatic exports</span>
                </label>
                
                {exportOptions.scheduledExport && (
                  <div className="ml-6 space-y-2">
                    <select
                      value={exportOptions.reportFrequency}
                      onChange={(e) => setExportOptions(prev => ({ ...prev, reportFrequency: e.target.value as typeof exportOptions.reportFrequency }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportOptions.emailReport}
                        onChange={(e) => setExportOptions(prev => ({ ...prev, emailReport: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Email reports</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              
              {exportOptions.scheduledExport ? (
                <button
                  onClick={handleScheduledExport}
                  disabled={exporting}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {exporting ? 'Setting up...' : 'Schedule Export'}
                </button>
              ) : (
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {exporting ? 'Exporting...' : `Export ${exportOptions.format.toUpperCase()}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ExportTools