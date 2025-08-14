import React from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  Video, 
  Clock, 
  Users, 
  Target,
  Calendar,
  Filter
} from 'lucide-react'
import { OverviewData, DashboardFilters } from '../../types/dashboard'
import MetricsCard from './MetricsCard'
import LoadingSkeleton from '../ui/LoadingSkeleton'

interface MetricsOverviewProps {
  data?: OverviewData
  loading: boolean
  filters: DashboardFilters
  onFiltersChange: (filters: Partial<DashboardFilters>) => void
}

const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  data,
  loading,
  filters,
  onFiltersChange
}) => {
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.round(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.round(seconds / 60)
    return `${minutes}m`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Filter Controls Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <LoadingSkeleton className="h-6 w-32 mb-2 sm:mb-0" />
          <div className="flex space-x-3">
            <LoadingSkeleton className="h-8 w-32" />
            <LoadingSkeleton className="h-8 w-24" />
          </div>
        </div>
        
        {/* Metrics Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <LoadingSkeleton className="h-4 w-24 mb-2" />
              <LoadingSkeleton className="h-8 w-16 mb-2" />
              <LoadingSkeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        
        {/* Quick Stats Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <LoadingSkeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <LoadingSkeleton className="h-4 w-20 mb-1" />
                <LoadingSkeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { metrics, quickStats } = data

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2 mb-4 sm:mb-0">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <select
              value={filters.dateRange}
              onChange={(e) => onFiltersChange({ dateRange: e.target.value as DashboardFilters['dateRange'] })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
            
            <select
              value={filters.compareWith}
              onChange={(e) => onFiltersChange({ compareWith: e.target.value as DashboardFilters['compareWith'] })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">No comparison</option>
              <option value="previous_period">Previous period</option>
              <option value="previous_year">Previous year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricsCard
          title="Total Analyses"
          value={metrics.totalAnalyses}
          change={calculateChange(metrics.last30Days.analyses, metrics.previousPeriod.analyses)}
          changeLabel="vs previous period"
          icon={TrendingUp}
          color="blue"
          showComparison={filters.compareWith !== 'none'}
        />
        
        <MetricsCard
          title="Outliers Found"
          value={metrics.totalOutliers}
          change={calculateChange(metrics.last30Days.outliers, metrics.previousPeriod.outliers)}
          changeLabel="vs previous period"
          icon={Video}
          color="green"
          showComparison={filters.compareWith !== 'none'}
        />
        
        <MetricsCard
          title="Avg Processing Time"
          value={formatDuration(metrics.avgProcessingTime)}
          icon={Clock}
          color="purple"
          showComparison={false}
        />
        
        <MetricsCard
          title="Success Rate"
          value={`${Math.round(metrics.successRate)}%`}
          icon={Target}
          color={metrics.successRate >= 90 ? 'green' : metrics.successRate >= 75 ? 'yellow' : 'red'}
          showComparison={false}
        />
      </div>

      {/* Quick Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Stats</h3>
          <Calendar className="h-5 w-5 text-gray-400" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {quickStats.todayAnalyses}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Today</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {quickStats.weekAnalyses}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">This Week</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {quickStats.monthAnalyses}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">This Month</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {quickStats.avgOutliersPerAnalysis.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Avg Outliers</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MetricsOverview