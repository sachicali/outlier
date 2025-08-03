import Head from 'next/head'
import { useAuth, withAuth } from '../../contexts/AuthContext'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { 
  ArrowLeft,
  Download,
  Clock,
  Video,
  Users,
  TrendingUp,
  Calendar,
  Settings,
  ExternalLink,
  Eye,
  Share2,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Loader,
  AlertCircle
} from 'lucide-react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

interface AnalysisDetails {
  id: string
  name?: string
  description?: string
  status: string
  started_at: string
  completed_at?: string
  config: {
    exclusionChannels?: string[]
    timeWindow?: number
    minSubs?: number
    maxSubs?: number
    outlierThreshold?: number
  }
  processing_time_ms?: number
  total_outliers_found?: number
  total_channels_analyzed?: number
  error_message?: string
  results?: Array<{
    id: { videoId: string }
    snippet: {
      title: string
      description: string
      publishedAt: string
      thumbnails: {
        medium: { url: string }
      }
      tags?: string[]
    }
    statistics: {
      viewCount: string
      likeCount?: string
      commentCount?: string
    }
    channelInfo: {
      snippet: {
        title: string
        description: string
        thumbnails: {
          medium: { url: string }
        }
      }
      statistics: {
        subscriberCount: string
      }
    }
    outlierScore: number
    brandFit?: number
  }>
  summary?: {
    totalOutliers: number
    channelsAnalyzed: number
    processingTime: number
    config: any
  }
}

function AnalysisDetail() {
  const { user } = useAuth()
  const router = useRouter()
  const { id } = router.query
  const [analysis, setAnalysis] = useState<AnalysisDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [sortBy, setSortBy] = useState<'outlierScore' | 'views' | 'publishedAt'>('outlierScore')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterScore, setFilterScore] = useState<number>(0)

  useEffect(() => {
    if (id) {
      fetchAnalysisDetails()
    }
  }, [id])

  const fetchAnalysisDetails = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/dashboard/analysis/${id}`)
      setAnalysis(response.data.analysis)
    } catch (error) {
      console.error('Error fetching analysis details:', error)
      toast.error('Failed to load analysis details')
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      setDownloading(true)
      const response = await axios.get(`/api/outlier/export/${id}`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `outliers-${id}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('Analysis results downloaded successfully')
    } catch (error) {
      console.error('Error downloading analysis:', error)
      toast.error('Failed to download analysis results')
    } finally {
      setDownloading(false)
    }
  }

  const formatNumber = (num: string | number) => {
    const n = typeof num === 'string' ? parseInt(num) : num
    if (n >= 1000000) {
      return `${(n / 1000000).toFixed(1)}M`
    }
    if (n >= 1000) {
      return `${(n / 1000).toFixed(1)}K`
    }
    return n.toLocaleString()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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

  const getStatusConfig = (status: string) => {
    const configs = {
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
    return configs[status as keyof typeof configs] || configs.pending
  }

  const sortedAndFilteredResults = analysis?.results
    ?.filter(result => result.outlierScore >= filterScore)
    ?.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortBy) {
        case 'outlierScore':
          aValue = a.outlierScore
          bValue = b.outlierScore
          break
        case 'views':
          aValue = parseInt(a.statistics.viewCount)
          bValue = parseInt(b.statistics.viewCount)
          break
        case 'publishedAt':
          aValue = new Date(a.snippet.publishedAt)
          bValue = new Date(b.snippet.publishedAt)
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    }) || []

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!analysis) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Analysis not found</h3>
          <p className="mt-1 text-sm text-gray-500">
            The analysis you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const statusConfig = getStatusConfig(analysis.status)
  const StatusIcon = statusConfig.icon

  return (
    <>
      <Head>
        <title>{analysis.name || `Analysis ${analysis.id.slice(0, 8)}`} - YouTube Outlier Discovery Tool</title>
        <meta name="description" content="Detailed analysis results and insights" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start space-x-4">
              <Link
                href="/dashboard"
                className="mt-1 p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {analysis.name || `Analysis ${analysis.id.slice(0, 8)}`}
                </h1>
                <div className="flex items-center mt-2 space-x-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {statusConfig.label}
                  </span>
                  <span className="text-sm text-gray-500">
                    ID: {analysis.id}
                  </span>
                  <span className="text-sm text-gray-500">
                    Started: {formatDate(analysis.started_at)}
                  </span>
                </div>
                {analysis.description && (
                  <p className="mt-2 text-sm text-gray-600">{analysis.description}</p>
                )}
              </div>
            </div>
            
            <div className="mt-4 sm:mt-0 flex space-x-3">
              {analysis.status === 'completed' && (
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Download CSV
                </button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Video className="h-8 w-8 text-blue-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Outliers Found</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {analysis.total_outliers_found || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Channels Analyzed</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {analysis.total_channels_analyzed || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Clock className="h-8 w-8 text-purple-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Processing Time</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatDuration(analysis.processing_time_ms)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Settings className="h-8 w-8 text-orange-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Time Window</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {analysis.config.timeWindow || 7} days
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Analysis Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <dt className="text-sm font-medium text-gray-500">Subscriber Range</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {analysis.config.minSubs?.toLocaleString()} - {analysis.config.maxSubs?.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Outlier Threshold</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {analysis.config.outlierThreshold || 20}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Exclusion Channels</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {analysis.config.exclusionChannels?.length || 0} channels
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Completed At</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {analysis.completed_at ? formatDate(analysis.completed_at) : 'Not completed'}
                </dd>
              </div>
            </div>
          </div>

          {/* Results */}
          {analysis.status === 'completed' && analysis.results && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-medium text-gray-900">Outlier Videos</h2>
                  
                  <div className="mt-4 sm:mt-0 flex space-x-3">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="outlierScore">Sort by Score</option>
                      <option value="views">Sort by Views</option>
                      <option value="publishedAt">Sort by Date</option>
                    </select>
                    
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </select>
                    
                    <input
                      type="number"
                      placeholder="Min score"
                      value={filterScore}
                      onChange={(e) => setFilterScore(Number(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>
              
              <div className="divide-y divide-gray-200">
                {sortedAndFilteredResults.length === 0 ? (
                  <div className="p-6 text-center">
                    <Video className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Try adjusting your filters to see more results.
                    </p>
                  </div>
                ) : (
                  sortedAndFilteredResults.map((result) => (
                    <div key={result.id.videoId} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <img
                            src={result.snippet.thumbnails.medium.url}
                            alt={result.snippet.title}
                            className="w-32 h-18 object-cover rounded"
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
                                {result.snippet.title}
                              </h3>
                              <p className="text-sm text-gray-600 mt-1">
                                {result.channelInfo.snippet.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {result.snippet.description}
                              </p>
                            </div>
                            
                            <div className="flex-shrink-0 ml-4 text-right">
                              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                result.outlierScore >= 80 ? 'bg-red-100 text-red-800' :
                                result.outlierScore >= 60 ? 'bg-orange-100 text-orange-800' :
                                result.outlierScore >= 40 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                <TrendingUp className="w-3 h-3 mr-1" />
                                {result.outlierScore.toFixed(1)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center mt-3 space-x-6 text-sm text-gray-500">
                            <div className="flex items-center">
                              <Eye className="w-4 h-4 mr-1" />
                              <span>{formatNumber(result.statistics.viewCount)} views</span>
                            </div>
                            <div className="flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              <span>{formatNumber(result.channelInfo.statistics.subscriberCount)} subs</span>
                            </div>
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              <span>{formatDate(result.snippet.publishedAt)}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center mt-3 space-x-3">
                            <a
                              href={`https://youtube.com/watch?v=${result.id.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Watch Video
                            </a>
                            <a
                              href={`https://youtube.com/channel/${result.channelInfo.snippet.title}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800"
                            >
                              <Users className="w-4 h-4 mr-1" />
                              View Channel
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {analysis.status === 'failed' && analysis.error_message && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <XCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Analysis Failed</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{analysis.error_message}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}

export default withAuth(AnalysisDetail)