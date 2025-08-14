import React, { useState, useMemo } from 'react'
import { 
  Search, 
  Filter, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock,
  RefreshCw,
  Download,
  Eye,
  Trash2,
  MoreVertical,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Analysis } from '../../types/dashboard'
import LoadingSkeleton from '../ui/LoadingSkeleton'
import { toast } from 'react-hot-toast'

interface AnalysisHistoryProps {
  analyses: Analysis[]
  loading: boolean
  onRefresh: () => void
}

const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({ 
  analyses, 
  loading, 
  onRefresh 
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed' | 'processing'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'outliers' | 'processing_time'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([])
  const [showActions, setShowActions] = useState<string | null>(null)

  const getStatusIcon = (status: Analysis['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: Analysis['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.round(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.round(minutes / 60)
    return `${hours}h`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  // Filtered and sorted analyses
  const filteredAnalyses = useMemo(() => {
    let filtered = analyses.filter(analysis => {
      const matchesSearch = searchTerm === '' || 
        (analysis.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        analysis.id.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || analysis.status === statusFilter
      
      return matchesSearch && matchesStatus
    })

    // Sort analyses
    filtered.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.started_at).getTime()
          bValue = new Date(b.started_at).getTime()
          break
        case 'name':
          aValue = a.name || a.id
          bValue = b.name || b.id
          break
        case 'outliers':
          aValue = a.total_outliers_found || 0
          bValue = b.total_outliers_found || 0
          break
        case 'processing_time':
          aValue = a.processing_time_ms || 0
          bValue = b.processing_time_ms || 0
          break
        default:
          return 0
      }
      
      if (typeof aValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
      
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
    })

    return filtered
  }, [analyses, searchTerm, statusFilter, sortBy, sortOrder])

  // Pagination
  const totalPages = Math.ceil(filteredAnalyses.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedAnalyses = filteredAnalyses.slice(startIndex, startIndex + pageSize)

  const handleSort = (column: typeof sortBy) => {
    if (column === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAnalyses(paginatedAnalyses.map(a => a.id))
    } else {
      setSelectedAnalyses([])
    }
  }

  const handleSelectAnalysis = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedAnalyses(prev => [...prev, id])
    } else {
      setSelectedAnalyses(prev => prev.filter(analysisId => analysisId !== id))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedAnalyses.length === 0) return
    
    if (confirm(`Delete ${selectedAnalyses.length} selected analyses? This action cannot be undone.`)) {
      try {
        // In a real implementation, this would call the API
        toast.success(`${selectedAnalyses.length} analyses deleted`)
        setSelectedAnalyses([])
        onRefresh()
      } catch (error) {
        toast.error('Failed to delete analyses')
      }
    }
  }

  const handleExportSelected = async () => {
    if (selectedAnalyses.length === 0) return
    
    try {
      // In a real implementation, this would call the API
      toast.success(`Exporting ${selectedAnalyses.length} analyses...`)
    } catch (error) {
      toast.error('Failed to export analyses')
    }
  }

  const handleViewAnalysis = (id: string) => {
    // Navigate to analysis details page
    window.open(`/analysis/${id}`, '_blank')
  }

  const handleRerunAnalysis = async (analysis: Analysis) => {
    try {
      // In a real implementation, this would call the API to rerun
      toast.success('Analysis restarted')
      onRefresh()
    } catch (error) {
      toast.error('Failed to restart analysis')
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <LoadingSkeleton className="h-6 w-32" />
        </div>
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <LoadingSkeleton className="h-4 w-4" />
              <LoadingSkeleton className="h-4 w-32" />
              <LoadingSkeleton className="h-4 w-24" />
              <LoadingSkeleton className="h-4 w-16" />
              <LoadingSkeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Analysis History</h2>
          
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search analyses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
            
            <button
              onClick={onRefresh}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Bulk Actions */}
        {selectedAnalyses.length > 0 && (
          <div className="mt-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <span className="text-sm text-blue-800 dark:text-blue-300">
              {selectedAnalyses.length} selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportSelected}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-300 dark:hover:bg-blue-700"
              >
                <Download className="w-3 h-3 mr-1" />
                Export
              </button>
              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 dark:bg-red-800 dark:text-red-300 dark:hover:bg-red-700"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedAnalyses.length === paginatedAnalyses.length && paginatedAnalyses.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                onClick={() => handleSort('name')}
              >
                Name
                {sortBy === 'name' && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                onClick={() => handleSort('date')}
              >
                Started
                {sortBy === 'date' && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                onClick={() => handleSort('outliers')}
              >
                Outliers
                {sortBy === 'outliers' && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                onClick={() => handleSort('processing_time')}
              >
                Duration
                {sortBy === 'processing_time' && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedAnalyses.map((analysis) => (
              <tr key={analysis.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedAnalyses.includes(analysis.id)}
                    onChange={(e) => handleSelectAnalysis(analysis.id, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </td>
                
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {analysis.name || `Analysis ${analysis.id.slice(0, 8)}`}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {analysis.id}
                    </div>
                  </div>
                </td>
                
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    {getStatusIcon(analysis.status)}
                    <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(analysis.status)}`}>
                      {analysis.status}
                    </span>
                  </div>
                  {analysis.progress !== undefined && analysis.status === 'processing' && (
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
                      <div 
                        className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${analysis.progress}%` }}
                      />
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(analysis.started_at)}
                </td>
                
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                  {analysis.total_outliers_found ?? '-'}
                </td>
                
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {analysis.processing_time_ms ? formatDuration(analysis.processing_time_ms) : '-'}
                </td>
                
                <td className="px-6 py-4 text-right">
                  <div className="relative">
                    <button
                      onClick={() => setShowActions(showActions === analysis.id ? null : analysis.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    
                    {showActions === analysis.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-600">
                        <div className="py-1">
                          <button
                            onClick={() => {
                              handleViewAnalysis(analysis.id)
                              setShowActions(null)
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </button>
                          
                          {analysis.status === 'completed' && (
                            <button
                              onClick={() => {
                                handleRerunAnalysis(analysis)
                                setShowActions(null)
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Re-run Analysis
                            </button>
                          )}
                          
                          <button
                            onClick={() => {
                              // Export single analysis
                              toast.success('Exporting analysis...')
                              setShowActions(null)
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </button>
                          
                          <button
                            onClick={() => {
                              if (confirm('Delete this analysis? This action cannot be undone.')) {
                                toast.success('Analysis deleted')
                                onRefresh()
                              }
                              setShowActions(null)
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredAnalyses.length === 0 && (
        <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No analyses found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filteredAnalyses.length)} of {filteredAnalyses.length} results
              </span>
              
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnalysisHistory