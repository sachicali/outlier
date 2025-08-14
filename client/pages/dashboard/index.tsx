import Head from 'next/head'
import { useAuth, withAuth } from '../../contexts/AuthContext'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { toast } from 'react-hot-toast'
import axios from 'axios'

// Layout and Components
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import DashboardTabs from '../../components/dashboard/DashboardTabs'

// Overview Tab Components
import MetricsOverview from '../../components/dashboard/MetricsOverview'
import UsageAnalytics from '../../components/dashboard/UsageAnalytics'
import QuotaTracker from '../../components/dashboard/QuotaTracker'
import ActivityFeed from '../../components/dashboard/ActivityFeed'

// Analytics Tab Components
import PerformanceMetrics from '../../components/dashboard/PerformanceMetrics'
import TrendAnalysis from '../../components/dashboard/TrendAnalysis'
import ExportTools from '../../components/dashboard/ExportTools'

// History Tab Components
import AnalysisHistory from '../../components/dashboard/AnalysisHistory'
import SavedResults from '../../components/dashboard/SavedResults'

// Account Tab Components
import ProfileManagement from '../../components/dashboard/ProfileManagement'
import ApiKeyManagement from '../../components/dashboard/ApiKeyManagement'
import SecuritySettings from '../../components/dashboard/SecuritySettings'
import NotificationSettings from '../../components/dashboard/NotificationSettings'

// Types
import { DashboardData, DashboardFilters } from '../../types/dashboard'

// Icons
import { 
  BarChart3, 
  TrendingUp, 
  History, 
  User,
  RefreshCw,
  Download
} from 'lucide-react'

const TABS = [
  { id: 'overview', name: 'Overview', icon: BarChart3 },
  { id: 'analytics', name: 'Analytics', icon: TrendingUp },
  { id: 'history', name: 'History', icon: History },
  { id: 'account', name: 'Account', icon: User },
]

function Dashboard() {
  const { user } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: '30',
    timezone: 'local',
    compareWith: 'previous_period'
  })

  // Get active tab from URL or default to overview
  useEffect(() => {
    const { tab } = router.query
    if (tab && typeof tab === 'string' && TABS.find(t => t.id === tab)) {
      setActiveTab(tab)
    }
  }, [router.query])

  // Update URL when tab changes
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    router.push({
      pathname: '/dashboard',
      query: { tab: tabId }
    }, undefined, { shallow: true })
  }

  // Fetch dashboard data
  const fetchDashboardData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const response = await axios.get('/api/dashboard/comprehensive', {
        params: {
          range: filters.dateRange,
          timezone: filters.timezone,
          compare: filters.compareWith
        }
      })
      
      setDashboardData(response.data)
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error)
      const errorMessage = error.response?.data?.message || 'Failed to load dashboard data'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData()
  }, [filters.dateRange, filters.timezone, filters.compareWith])

  // Handle filter changes
  const handleFiltersChange = (newFilters: Partial<DashboardFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  // Handle refresh
  const handleRefresh = () => {
    fetchDashboardData(true)
  }

  // Export dashboard data
  const handleExportDashboard = async (format: 'pdf' | 'excel') => {
    try {
      const response = await axios.get(`/api/dashboard/export/${format}`, {
        responseType: 'blob',
        params: {
          range: filters.dateRange,
          timezone: filters.timezone,
          tab: activeTab
        }
      })
      
      const contentType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const fileExtension = format === 'pdf' ? 'pdf' : 'xlsx'
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: contentType }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `dashboard-${activeTab}-${new Date().toISOString().split('T')[0]}.${fileExtension}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success(`Dashboard exported as ${format.toUpperCase()} successfully`)
    } catch (error: any) {
      console.error('Error exporting dashboard:', error)
      toast.error(`Failed to export dashboard as ${format.toUpperCase()}`)
    }
  }

  // Memoized tab content for performance
  const tabContent = useMemo(() => {
    if (!dashboardData && !loading) return null

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <MetricsOverview 
              data={dashboardData?.overview}
              loading={loading}
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UsageAnalytics 
                data={dashboardData?.analytics}
                loading={loading}
              />
              <QuotaTracker 
                data={dashboardData?.quota}
                loading={loading}
              />
            </div>
            
            <ActivityFeed 
              activities={dashboardData?.activities || []}
              loading={loading}
            />
          </div>
        )

      case 'analytics':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics & Insights</h2>
              <ExportTools onExport={handleExportDashboard} />
            </div>
            
            <PerformanceMetrics 
              data={dashboardData?.performance}
              loading={loading}
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
            
            <TrendAnalysis 
              data={dashboardData?.trends}
              loading={loading}
            />
          </div>
        )

      case 'history':
        return (
          <div className="space-y-6">
            <AnalysisHistory 
              analyses={dashboardData?.history?.analyses || []}
              loading={loading}
              onRefresh={() => fetchDashboardData(true)}
            />
            
            <SavedResults 
              savedChannels={dashboardData?.saved?.channels || []}
              savedVideos={dashboardData?.saved?.videos || []}
              loading={loading}
              onRefresh={() => fetchDashboardData(true)}
            />
          </div>
        )

      case 'account':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProfileManagement user={user} />
              <SecuritySettings user={user} />
            </div>
            
            <ApiKeyManagement 
              apiKeys={dashboardData?.account?.apiKeys || []}
              onRefresh={() => fetchDashboardData(true)}
            />
            
            <NotificationSettings 
              settings={dashboardData?.account?.notifications}
              onSave={(settings) => {
                // Handle notification settings save
                toast.success('Notification settings saved')
              }}
            />
          </div>
        )

      default:
        return null
    }
  }, [activeTab, dashboardData, loading, filters, user])

  // Loading state
  if (loading && !dashboardData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  // Error state
  if (error && !dashboardData) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
          <div className="text-red-500 text-center">
            <h3 className="text-lg font-semibold">Failed to load dashboard</h3>
            <p className="text-sm mt-2">{error}</p>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Try Again
          </button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <>
      <Head>
        <title>Dashboard - YouTube Outlier Discovery Tool</title>
        <meta name="description" content="Comprehensive analytics and insights dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Welcome back, {user?.username}! Here's your comprehensive analytics overview.
              </p>
            </div>
            
            <div className="mt-4 sm:mt-0 flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              
              <button
                onClick={() => handleExportDashboard('excel')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
            </div>
          </div>

          {/* Tabs Navigation */}
          <DashboardTabs
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />

          {/* Tab Content */}
          <div className="min-h-96">
            {tabContent}
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}

export default withAuth(Dashboard)