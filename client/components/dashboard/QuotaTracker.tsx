import React from 'react'
import { 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Info,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { QuotaData } from '../../types/dashboard'
import LoadingSkeleton from '../ui/LoadingSkeleton'

interface QuotaTrackerProps {
  data?: QuotaData
  loading: boolean
}

const QuotaTracker: React.FC<QuotaTrackerProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <LoadingSkeleton className="h-6 w-32 mb-4" />
        <div className="space-y-4">
          <LoadingSkeleton className="h-4 w-full" />
          <LoadingSkeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <LoadingSkeleton className="h-16 w-full" />
            <LoadingSkeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quota Usage</h3>
        <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Quota information unavailable</p>
          </div>
        </div>
      </div>
    )
  }

  const { current, daily, monthly, forecast } = data

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'red'
    if (percentage >= 75) return 'yellow'
    if (percentage >= 50) return 'orange'
    return 'green'
  }

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 90) return XCircle
    if (percentage >= 75) return AlertTriangle
    return CheckCircle
  }

  const formatTimeUntilReset = (resetTime: string) => {
    const now = new Date()
    const reset = new Date(resetTime)
    const diff = reset.getTime() - now.getTime()
    
    if (diff <= 0) return 'Resetting now'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days} day${days !== 1 ? 's' : ''}`
    }
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    
    return `${minutes}m`
  }

  const StatusIcon = getStatusIcon(current.percentage)
  const statusColor = getStatusColor(current.percentage)
  
  const statusColors = {
    green: 'text-green-600 dark:text-green-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    orange: 'text-orange-600 dark:text-orange-400',
    red: 'text-red-600 dark:text-red-400'
  }

  const progressColors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">API Quota Usage</h3>
        <StatusIcon className={`h-5 w-5 ${statusColors[statusColor]}`} />
      </div>

      {/* Main Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Current Usage
          </span>
          <span className={`text-sm font-medium ${statusColors[statusColor]}`}>
            {current.used.toLocaleString()} / {current.limit.toLocaleString()} ({current.percentage.toFixed(1)}%)
          </span>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${progressColors[statusColor]}`}
            style={{ width: `${Math.min(current.percentage, 100)}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Remaining: {current.remaining.toLocaleString()}</span>
          <span>{100 - current.percentage.toFixed(1)}% available</span>
        </div>
      </div>

      {/* Daily & Monthly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Daily</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Resets in {formatTimeUntilReset(daily.resetTime)}
            </span>
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {daily.used.toLocaleString()} / {daily.limit.toLocaleString()}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-2">
            <div
              className="h-2 bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((daily.used / daily.limit) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Monthly</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Resets {new Date(monthly.resetDate).toLocaleDateString()}
            </span>
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {monthly.used.toLocaleString()} / {monthly.limit.toLocaleString()}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-2">
            <div
              className="h-2 bg-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((monthly.used / monthly.limit) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Forecast */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <div className="flex items-center mb-2">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
          <span className="text-sm font-medium text-blue-900 dark:text-blue-300">Usage Forecast</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-blue-700 dark:text-blue-300">Projected Daily</div>
            <div className="font-semibold text-blue-900 dark:text-blue-100">
              {forecast.projectedDailyUsage.toLocaleString()}
            </div>
          </div>
          
          <div>
            <div className="text-blue-700 dark:text-blue-300">Projected Monthly</div>
            <div className="font-semibold text-blue-900 dark:text-blue-100">
              {forecast.projectedMonthlyUsage.toLocaleString()}
            </div>
          </div>
          
          <div>
            <div className="text-blue-700 dark:text-blue-300">Est. Remaining Days</div>
            <div className="font-semibold text-blue-900 dark:text-blue-100">
              {forecast.estimatedRemainingDays} days
            </div>
          </div>
        </div>
        
        {current.percentage >= 80 && (
          <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mr-2" />
              <span className="text-sm text-yellow-800 dark:text-yellow-300">
                {current.percentage >= 90 
                  ? 'Critical: Consider reducing API usage or upgrading your plan'
                  : 'Warning: High quota usage detected. Monitor your consumption.'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default QuotaTracker