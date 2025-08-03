import React, { useState, useMemo } from 'react'
import { 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  Download, 
  MoreHorizontal,
  Calendar,
  Clock,
  Video,
  Users,
  CheckCircle,
  XCircle,
  Loader,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import axios from 'axios'
import { toast } from 'react-hot-toast'

interface Analysis {
  id: string
  name?: string
  status: string
  started_at: string
  completed_at?: string
  total_outliers_found?: number
  total_channels_analyzed?: number
  processing_time_ms?: number
  config?: {
    exclusionChannels?: string[]
    timeWindow?: number
    minSubs?: number
    maxSubs?: number
  }
}

interface AnalysisHistoryTableProps {
  analyses: Analysis[]
  searchTerm: string
  filterStatus: string
  onRefresh: () => void
}

type SortField = 'started_at' | 'status' | 'total_outliers_found' | 'processing_time_ms'
type SortDirection = 'asc' | 'desc'

const statusConfig = {
  completed: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-100',
    label: 'Completed'
  },
  pending: {
    icon: Clock,
    color: 'text-yellow-600',
    bg: 'bg-yellow-100',
    label: 'Pending'
  },
  processing: {
    icon: Loader,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    label: 'Processing'
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-100',
    label: 'Failed'
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-600',
    bg: 'bg-red-100',
    label: 'Error'
  }
}

export default function AnalysisHistoryTable({ 
  analyses, 
  searchTerm, 
  filterStatus, 
  onRefresh 
}: AnalysisHistoryTableProps) {
  const [sortField, setSortField] = useState<SortField>('started_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const filteredAndSortedAnalyses = useMemo(() => {
    let filtered = analyses

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(analysis => 
        (analysis.name && analysis.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        analysis.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(analysis => analysis.status === filterStatus)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'started_at':
          aValue = new Date(a.started_at)
          bValue = new Date(b.started_at)
          break
        case 'total_outliers_found':
          aValue = a.total_outliers_found || 0
          bValue = b.total_outliers_found || 0
          break
        case 'processing_time_ms':
          aValue = a.processing_time_ms || 0
          bValue = b.processing_time_ms || 0
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [analyses, searchTerm, filterStatus, sortField, sortDirection])

  const paginatedAnalyses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredAndSortedAnalyses.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredAndSortedAnalyses, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredAndSortedAnalyses.length / itemsPerPage)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const handleDownload = async (analysisId: string) => {
    try {
      setDownloadingId(analysisId)
      const response = await axios.get(`/api/outlier/export/${analysisId}`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `outliers-${analysisId}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('Analysis results downloaded successfully')
    } catch (error) {
      console.error('Error downloading analysis:', error)
      toast.error('Failed to download analysis results')
    } finally {
      setDownloadingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    const seconds = Math.round(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 text-left font-medium text-gray-500 hover:text-gray-700"
    >
      <span>{children}</span>
      {sortField === field && (
        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
      )}
    </button>
  )

  const StatusBadge = ({ status }: { status: string }) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    )
  }

  if (analyses.length === 0) {
    return (
      <div className="text-center py-12">
        <Video className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No analyses yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Start your first analysis to see results here.
        </p>
        <div className="mt-6">
          <Link
            href="/discovery"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Start Analysis
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Analysis
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortButton field="status">Status</SortButton>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortButton field="started_at">Started</SortButton>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortButton field="total_outliers_found">Outliers</SortButton>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortButton field="processing_time_ms">Duration</SortButton>
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedAnalyses.map((analysis) => (
                <tr key={analysis.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {analysis.name || `Analysis ${analysis.id.slice(0, 8)}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {analysis.id.slice(0, 8)}...
                      </div>
                      {analysis.config && (
                        <div className="flex items-center mt-1 space-x-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <Users className="w-3 h-3 mr-1" />
                            {analysis.config.minSubs?.toLocaleString()} - {analysis.config.maxSubs?.toLocaleString()} subs
                          </span>
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {analysis.config.timeWindow} days
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={analysis.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatDate(analysis.started_at)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {analysis.total_outliers_found !== undefined ? (
                      <div className="flex items-center">
                        <Video className="w-4 h-4 mr-1 text-gray-400" />
                        {analysis.total_outliers_found}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatDuration(analysis.processing_time_ms)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <Link
                        href={`/analysis/${analysis.id}`}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      
                      {analysis.status === 'completed' && (
                        <button
                          onClick={() => handleDownload(analysis.id)}
                          disabled={downloadingId === analysis.id}
                          className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50 disabled:opacity-50"
                          title="Download results"
                        >
                          {downloadingId === analysis.id ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
                {' '}to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * itemsPerPage, filteredAndSortedAnalyses.length)}
                </span>
                {' '}of{' '}
                <span className="font-medium">{filteredAndSortedAnalyses.length}</span>
                {' '}results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === page
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}