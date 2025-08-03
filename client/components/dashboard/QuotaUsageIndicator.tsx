import React from 'react'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'

interface QuotaUsageIndicatorProps {
  used: number
  limit: number
  period: string
  loading?: boolean
}

export default function QuotaUsageIndicator({ 
  used, 
  limit, 
  period, 
  loading = false 
}: QuotaUsageIndicatorProps) {
  const percentage = Math.min((used / limit) * 100, 100)
  const remaining = Math.max(limit - used, 0)
  
  const getStatusColor = () => {
    if (percentage >= 90) return 'red'
    if (percentage >= 75) return 'yellow'
    return 'green'
  }

  const getStatusIcon = () => {
    if (percentage >= 90) return AlertTriangle
    if (percentage >= 75) return Clock
    return CheckCircle
  }

  const getStatusMessage = () => {
    if (percentage >= 90) return 'Quota nearly exhausted'
    if (percentage >= 75) return 'High quota usage'
    return 'Quota usage normal'
  }

  const statusColor = getStatusColor()
  const StatusIcon = getStatusIcon()
  const statusMessage = getStatusMessage()

  const colorClasses = {
    red: {
      bg: 'bg-red-500',
      lightBg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200'
    },
    yellow: {
      bg: 'bg-yellow-500',
      lightBg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200'
    },
    green: {
      bg: 'bg-green-500',
      lightBg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200'
    }
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 bg-gray-300 rounded w-32"></div>
          <div className="h-4 bg-gray-300 rounded w-20"></div>
        </div>
        <div className="mb-4">
          <div className="h-2 bg-gray-300 rounded w-full"></div>
        </div>
        <div className="flex justify-between text-sm">
          <div className="h-4 bg-gray-300 rounded w-16"></div>
          <div className="h-4 bg-gray-300 rounded w-24"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white shadow rounded-lg p-6 border-l-4 ${colorClasses[statusColor].border}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className={`${colorClasses[statusColor].lightBg} p-2 rounded-md mr-3`}>
            <StatusIcon className={`w-5 h-5 ${colorClasses[statusColor].text}`} />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">API Quota Usage</h3>
            <p className={`text-sm ${colorClasses[statusColor].text}`}>{statusMessage}</p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {percentage.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">of {period} limit</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex mb-2 items-center justify-between">
          <div>
            <span className="text-xs font-semibold inline-block text-gray-600">
              Usage Progress
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold inline-block text-gray-600">
              {used.toLocaleString()} / {limit.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
          <div 
            style={{ width: `${percentage}%` }}
            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${colorClasses[statusColor].bg}`}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-lg font-semibold text-gray-900">{used.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Used</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">{remaining.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Remaining</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">{limit.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Limit</div>
        </div>
      </div>

      {/* Recommendations */}
      {percentage >= 75 && (
        <div className={`mt-4 p-3 rounded-md ${colorClasses[statusColor].lightBg}`}>
          <div className="flex">
            <div className="flex-shrink-0">
              <StatusIcon className={`h-5 w-5 ${colorClasses[statusColor].text}`} />
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${colorClasses[statusColor].text}`}>
                {percentage >= 90 ? 'Action Required' : 'Recommendation'}
              </h3>
              <div className={`mt-2 text-sm ${colorClasses[statusColor].text}`}>
                <p>
                  {percentage >= 90 
                    ? 'Consider upgrading your quota or optimizing analysis frequency to avoid service interruption.'
                    : 'Monitor your usage closely. Consider caching results or reducing analysis frequency.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}