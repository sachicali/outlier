import Head from 'next/head'
import { useAuth, withAuth } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import MetricsCard from '../components/dashboard/MetricsCard'
import AnalysisHistoryTable from '../components/dashboard/AnalysisHistoryTable'
import UsageChart from '../components/dashboard/UsageChart'
import QuotaUsageIndicator from '../components/dashboard/QuotaUsageIndicator'
import RecentOutliers from '../components/dashboard/RecentOutliers'
import FavoriteChannels from '../components/dashboard/FavoriteChannels'
import { 
  TrendingUp, 
  Video, 
  Clock, 
  Users,
  Download,
  Filter,
  Calendar,
  Search
} from 'lucide-react'
import axios from 'axios'
import { toast } from 'react-hot-toast'

interface DashboardData {
  metrics: {
    totalAnalyses: number
    totalOutliers: number
    avgProcessingTime: number
    uniqueChannels: number
    last30Days: {
      analyses: number
      outliers: number
    }
  }
  recentAnalyses: Array<{
    id: string
    name?: string
    status: string
    started_at: string
    completed_at?: string
    total_outliers_found?: number
    total_channels_analyzed?: number
    processing_time_ms?: number
  }>
  usageData: Array<{
    date: string
    analyses: number
    outliers: number
  }>
  quotaUsage: {
    used: number
    limit: number
    period: string
  }
  recentOutliers: Array<{
    id: string
    title: string
    channelName: string
    views: number
    outlierScore: number
    publishedAt: string
    analysisId: string
  }>
  favoriteChannels: Array<{
    id: string
    name: string
    subscriberCount: number
    lastAnalyzed?: string
    avgOutlierScore: number
  }>
}

function Dashboard() {
  const { user } = useAuth()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    fetchDashboardData()
  }, [dateRange])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/dashboard?range=${dateRange}`)
      setDashboardData(response.data)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleExportHistory = async () => {
    try {
      const response = await axios.get('/api/dashboard/export', {
        responseType: 'blob',
        params: {
          range: dateRange,
          search: searchTerm,
          status: filterStatus
        }
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `analysis-history-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('Analysis history exported successfully')
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export analysis history')
    }
  }

  if (loading && !dashboardData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <>
      <Head>
        <title>Dashboard - YouTube Outlier Discovery Tool</title>
        <meta name="description" content="Analytics and insights dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Welcome back, {user?.username}! Here's your analytics overview.
              </p>
            </div>
            
            <div className="mt-4 sm:mt-0 flex space-x-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
              
              <button
                onClick={handleExportHistory}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
            </div>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricsCard
              title="Total Analyses"
              value={dashboardData?.metrics?.totalAnalyses || 0}
              change={dashboardData?.metrics?.last30Days?.analyses || 0}
              changeLabel="this month"
              icon={TrendingUp}
              color="blue"
            />
            <MetricsCard
              title="Outliers Found"
              value={dashboardData?.metrics?.totalOutliers || 0}
              change={dashboardData?.metrics?.last30Days?.outliers || 0}
              changeLabel="this month"
              icon={Video}
              color="green"
            />
            <MetricsCard
              title="Avg Processing Time"
              value={`${Math.round((dashboardData?.metrics?.avgProcessingTime || 0) / 1000)}s`}
              icon={Clock}
              color="purple"
            />
            <MetricsCard
              title="Unique Channels"
              value={dashboardData?.metrics?.uniqueChannels || 0}
              icon={Users}
              color="orange"
            />
          </div>

          {/* Quota Usage */}
          <QuotaUsageIndicator 
            used={dashboardData?.quotaUsage?.used || 0}
            limit={dashboardData?.quotaUsage?.limit || 10000}
            period={dashboardData?.quotaUsage?.period || 'daily'}
          />

          {/* Usage Chart */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Usage Trends</h2>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-gray-600">Analyses</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-gray-600">Outliers</span>
                </div>
              </div>
            </div>
            <UsageChart data={dashboardData?.usageData || []} />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Analysis History */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-medium text-gray-900">Analysis History</h2>
                    
                    <div className="mt-4 sm:mt-0 flex space-x-3">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          placeholder="Search analyses..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      {/* Status Filter */}
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <AnalysisHistoryTable 
                  analyses={dashboardData?.recentAnalyses || []}
                  searchTerm={searchTerm}
                  filterStatus={filterStatus}
                  onRefresh={fetchDashboardData}
                />
              </div>
            </div>
          </div>

          {/* Secondary Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Outliers */}
            <RecentOutliers outliers={dashboardData?.recentOutliers || []} />
            
            {/* Favorite Channels */}
            <FavoriteChannels channels={dashboardData?.favoriteChannels || []} />
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}

export default withAuth(Dashboard)