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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Clock,
  Calendar,
  BarChart3,
  Activity
} from 'lucide-react'
import { TrendData } from '../../types/dashboard'
import LoadingSkeleton from '../ui/LoadingSkeleton'

interface TrendAnalysisProps {
  data?: TrendData
  loading: boolean
}

const TrendAnalysis: React.FC<TrendAnalysisProps> = ({ data, loading }) => {
  const [activeView, setActiveView] = useState<'outliers' | 'channels' | 'patterns'>('outliers')
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d')

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <LoadingSkeleton className="h-6 w-48 mb-4" />
          <LoadingSkeleton className="h-64 w-full" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <LoadingSkeleton className="h-6 w-32 mb-4" />
            <LoadingSkeleton className="h-48 w-full" />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <LoadingSkeleton className="h-6 w-32 mb-4" />
            <LoadingSkeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No trend data available</p>
            <p className="text-sm">Trend analysis will appear after accumulating more data</p>
          </div>
        </div>
      </div>
    )
  }

  const { outliersOverTime, channelTrends, seasonalPatterns } = data

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return TrendingUp
      case 'down':
        return TrendingDown
      default:
        return Minus
    }
  }

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-green-600 dark:text-green-400'
      case 'down':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const chartData = outliersOverTime?.map(item => ({
    ...item,
    date: formatDate(item.date)
  })) || []

  return (
    <div className="space-y-6">
      {/* View Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { id: 'outliers', name: 'Outlier Trends', icon: TrendingUp },
            { id: 'channels', name: 'Channel Performance', icon: BarChart3 },
            { id: 'patterns', name: 'Seasonal Patterns', icon: Calendar }
          ].map((tab) => {
            const isActive = activeView === tab.id
            const Icon = tab.icon
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as typeof activeView)}
                className={`
                  group inline-flex items-center px-1 py-4 border-b-2 font-medium text-sm transition-colors duration-200
                  ${
                    isActive
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <Icon className="-ml-0.5 mr-2 h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Outlier Trends View */}
      {activeView === 'outliers' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Outlier Discovery Trends
            </h3>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as typeof timeframe)}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
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
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  name="Outliers Found"
                />
                <Line 
                  type="monotone" 
                  dataKey="avgScore" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  name="Avg Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Category Breakdown */}
          <div>
            <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
              Top Categories Over Time
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {chartData[chartData.length - 1]?.categories?.map((category, index) => (
                <div key={category.name} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {category.name}
                  </div>
                  <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {category.count}
                  </div>
                </div>
              )) || []}
            </div>
          </div>
        </div>
      )}

      {/* Channel Performance View */}
      {activeView === 'channels' && (
        <div className="space-y-6">
          {/* Top Performing Channels */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Channel Performance Trends
            </h3>
            
            <div className="space-y-4">
              {channelTrends?.slice(0, 10).map((channel, index) => {
                const TrendIcon = getTrendIcon(channel.trend)
                const trendColor = getTrendColor(channel.trend)
                
                return (
                  <div key={channel.channelName} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            #{index + 1}
                          </span>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {channel.channelName}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {channel.data.length} data points
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Latest Outliers</div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {channel.data[channel.data.length - 1]?.outlierCount || 0}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Avg Score</div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {channel.data[channel.data.length - 1]?.avgScore.toFixed(1) || '0'}
                        </div>
                      </div>
                      
                      <div className={`flex items-center ${trendColor}`}>
                        <TrendIcon className="h-4 w-4 mr-1" />
                        <span className="text-sm font-medium">
                          {Math.abs(channel.changePercentage).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              }) || []}
            </div>
          </div>
        </div>
      )}

      {/* Seasonal Patterns View */}
      {activeView === 'patterns' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hourly Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Activity by Hour
            </h3>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={seasonalPatterns?.hourlyDistribution || []}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fontSize: 11 }}
                    className="text-gray-600 dark:text-gray-400"
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    className="text-gray-600 dark:text-gray-400"
                  />
                  <Tooltip />
                  <Bar 
                    dataKey="analysisCount" 
                    fill="#3B82F6" 
                    radius={[2, 2, 0, 0]}
                    name="Analyses"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Peak Hour:</span>
                <span className="font-medium">
                  {seasonalPatterns?.hourlyDistribution?.reduce((max, curr) => 
                    curr.analysisCount > max.analysisCount ? curr : max
                  )?.hour || 'N/A'}:00
                </span>
              </div>
            </div>
          </div>

          {/* Weekly Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Activity by Day of Week
            </h3>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={seasonalPatterns?.weeklyDistribution || []}>
                  <PolarGrid />
                  <PolarAngleAxis 
                    dataKey="dayOfWeek" 
                    tick={{ fontSize: 11 }}
                    className="text-gray-600 dark:text-gray-400"
                  />
                  <PolarRadiusAxis 
                    tick={{ fontSize: 10 }}
                    className="text-gray-600 dark:text-gray-400"
                  />
                  <Radar
                    name="Analysis Count"
                    dataKey="analysisCount"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.1}
                  />
                  <Radar
                    name="Outlier Rate"
                    dataKey="outlierRate"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.1}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 space-y-2">
              <div className="flex items-center text-sm">
                <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                <span className="text-gray-600 dark:text-gray-400">Analysis Count</span>
              </div>
              <div className="flex items-center text-sm">
                <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                <span className="text-gray-600 dark:text-gray-400">Outlier Rate</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TrendAnalysis