import React, { useState } from 'react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { AnalyticsData } from '../../types/dashboard'
import LoadingSkeleton from '../ui/LoadingSkeleton'
import { TrendingUp, BarChart3, PieChart as PieChartIcon } from 'lucide-react'

interface UsageAnalyticsProps {
  data?: AnalyticsData
  loading: boolean
}

const CHART_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#8B5CF6', // purple
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
]

const UsageAnalytics: React.FC<UsageAnalyticsProps> = ({ data, loading }) => {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')
  const [timeFrame, setTimeFrame] = useState<'daily' | 'weekly' | 'monthly'>('daily')

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <LoadingSkeleton className="h-6 w-32" />
          <div className="flex space-x-2">
            <LoadingSkeleton className="h-8 w-16" />
            <LoadingSkeleton className="h-8 w-16" />
          </div>
        </div>
        <LoadingSkeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data?.usageChart?.data?.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Usage Analytics</h3>
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No usage data available yet</p>
            <p className="text-sm">Start running analyses to see your usage trends</p>
          </div>
        </div>
      </div>
    )
  }

  const { usageChart, channelAnalytics } = data

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatTooltipValue = (value: number, name: string) => {
    if (name === 'processing_time') {
      return [`${Math.round(value / 1000)}s`, 'Processing Time']
    }
    return [value, name]
  }

  const chartData = usageChart.data.map(item => ({
    ...item,
    date: formatDate(item.date),
    processing_time: item.processing_time / 1000 // Convert to seconds
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Usage Analytics</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track your analysis patterns and performance</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setChartType('line')}
            className={`p-2 rounded-md transition-colors ${
              chartType === 'line'
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
            title="Line Chart"
          >
            <TrendingUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`p-2 rounded-md transition-colors ${
              chartType === 'bar'
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
            title="Bar Chart"
          >
            <BarChart3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={chartData}>
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
                formatter={formatTooltipValue}
              />
              <Line 
                type="monotone" 
                dataKey="analyses" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                name="Analyses"
              />
              <Line 
                type="monotone" 
                dataKey="outliers" 
                stroke="#10B981" 
                strokeWidth={2}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                name="Outliers"
              />
            </LineChart>
          ) : (
            <BarChart data={chartData}>
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
                formatter={formatTooltipValue}
              />
              <Bar 
                dataKey="analyses" 
                fill="#3B82F6" 
                name="Analyses"
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="outliers" 
                fill="#10B981" 
                name="Outliers"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Data Points</div>
          <div className="text-xl font-semibold text-gray-900 dark:text-white">
            {usageChart.summary.totalDataPoints}
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Peak Day</div>
          <div className="text-xl font-semibold text-gray-900 dark:text-white">
            {formatDate(usageChart.summary.peakDay)}
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Daily Average</div>
          <div className="text-xl font-semibold text-gray-900 dark:text-white">
            {usageChart.summary.averageDaily.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Channel Categories */}
      {channelAnalytics?.channelCategories?.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Channel Categories</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pie Chart */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelAnalytics.channelCategories}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ category, percentage }) => `${category} (${percentage}%)`}
                    labelLine={false}
                  >
                    {channelAnalytics.channelCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Category List */}
            <div className="space-y-2">
              {channelAnalytics.channelCategories.map((category, index) => (
                <div key={category.category} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{category.category}</span>
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {category.count} ({category.percentage}%)
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UsageAnalytics