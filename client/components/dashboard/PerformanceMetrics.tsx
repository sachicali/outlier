import React, { useState } from 'react'
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  Clock, 
  Target, 
  AlertTriangle, 
  TrendingUp,
  Activity,
  Zap
} from 'lucide-react'
import { PerformanceData, DashboardFilters } from '../../types/dashboard'
import LoadingSkeleton from '../ui/LoadingSkeleton'
import MetricsCard from './MetricsCard'

interface PerformanceMetricsProps {
  data?: PerformanceData
  loading: boolean
  filters: DashboardFilters
  onFiltersChange: (filters: Partial<DashboardFilters>) => void
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  data,
  loading,
  filters,
  onFiltersChange
}) => {
  const [activeChart, setActiveChart] = useState<'trends' | 'distribution' | 'errors'>('trends')

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Metrics Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <LoadingSkeleton className="h-4 w-24 mb-2" />
              <LoadingSkeleton className="h-8 w-16 mb-2" />
              <LoadingSkeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        
        {/* Chart Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <LoadingSkeleton className="h-6 w-48 mb-4" />
          <LoadingSkeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No performance data available</p>
            <p className="text-sm">Performance metrics will appear after running analyses</p>
          </div>
        </div>
      </div>
    )
  }

  const { metrics, timeDistribution, errorAnalysis, performanceTrends } = data

  const formatDuration = (ms: number) => {
    const seconds = Math.round(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.round(seconds / 60)
    return `${minutes}m`
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'green'
    if (rate >= 90) return 'yellow'
    if (rate >= 75) return 'orange'
    return 'red'
  }

  return (
    <div className="space-y-6">
      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricsCard
          title="Avg Processing Time"
          value={formatDuration(metrics.avgProcessingTime)}
          icon={Clock}
          color="blue"
          showComparison={false}
        />
        
        <MetricsCard
          title="Median Processing Time"
          value={formatDuration(metrics.medianProcessingTime)}
          icon={Zap}
          color="purple"
          showComparison={false}
        />
        
        <MetricsCard
          title="Success Rate"
          value={`${metrics.successRate.toFixed(1)}%`}
          icon={Target}
          color={getSuccessRateColor(metrics.successRate)}
          showComparison={false}
        />
        
        <MetricsCard
          title="Error Rate"
          value={`${metrics.errorRate.toFixed(1)}%`}
          icon={AlertTriangle}
          color={metrics.errorRate < 5 ? 'green' : metrics.errorRate < 10 ? 'yellow' : 'red'}
          showComparison={false}
        />
        
        <MetricsCard
          title="Avg Outliers/Analysis"
          value={metrics.avgOutliersPerAnalysis.toFixed(1)}
          icon={TrendingUp}
          color="green"
          showComparison={false}
        />
        
        <MetricsCard
          title="Avg Channels/Analysis"
          value={metrics.avgChannelsPerAnalysis.toFixed(1)}
          icon={Activity}
          color="orange"
          showComparison={false}
        />
      </div>

      {/* Chart Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'trends', name: 'Performance Trends', icon: TrendingUp },
              { id: 'distribution', name: 'Time Distribution', icon: Clock },
              { id: 'errors', name: 'Error Analysis', icon: AlertTriangle }
            ].map((tab) => {
              const isActive = activeChart === tab.id
              const Icon = tab.icon
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveChart(tab.id as typeof activeChart)}
                  className={`
                    group inline-flex items-center px-1 py-4 border-b-2 font-medium text-sm transition-colors duration-200
                    ${
                      isActive
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }
                  `}
                >
                  <Icon className={`-ml-0.5 mr-2 h-4 w-4`} />
                  <span>{tab.name}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Performance Trends Chart */}
          {activeChart === 'trends' && (
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Performance Trends Over Time
              </h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      className="text-gray-600 dark:text-gray-400"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      className="text-gray-600 dark:text-gray-400"
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'var(--tooltip-bg, #ffffff)',
                        border: '1px solid var(--tooltip-border, #e5e7eb)',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="avgProcessingTime" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      name="Avg Processing Time (ms)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="successRate" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      name="Success Rate (%)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="outlierRate" 
                      stroke="#F59E0B" 
                      strokeWidth={2}
                      name="Outlier Rate"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Time Distribution Chart */}
          {activeChart === 'distribution' && (
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Processing Time Distribution
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis 
                        dataKey="timeRange" 
                        tick={{ fontSize: 11 }}
                        className="text-gray-600 dark:text-gray-400"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        className="text-gray-600 dark:text-gray-400"
                      />
                      <Tooltip />
                      <Bar 
                        dataKey="count" 
                        fill="#3B82F6" 
                        radius={[2, 2, 0, 0]}
                        name="Analyses"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Pie Chart */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={timeDistribution}
                        dataKey="count"
                        nameKey="timeRange"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ timeRange, percentage }) => `${timeRange}: ${percentage}%`}
                      >
                        {timeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Error Analysis */}
          {activeChart === 'errors' && (
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Error Analysis
              </h4>
              
              {errorAnalysis.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No errors recorded</p>
                    <p className="text-sm">Great job! Your analyses are running smoothly.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {errorAnalysis.map((error, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div 
                            className="w-4 h-4 rounded-full mr-3"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <h5 className="font-medium text-gray-900 dark:text-white">
                            {error.errorType}
                          </h5>
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {error.count} occurrences
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Last occurrence: {new Date(error.lastOccurrence).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PerformanceMetrics