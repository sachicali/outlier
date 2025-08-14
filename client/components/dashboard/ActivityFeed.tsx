import React, { useState } from 'react'
import { 
  Activity as ActivityIcon, 
  Play, 
  CheckCircle, 
  XCircle, 
  Star, 
  Download, 
  Clock,
  Filter,
  ChevronRight
} from 'lucide-react'
import { Activity } from '../../types/dashboard'
import LoadingSkeleton from '../ui/LoadingSkeleton'

interface ActivityFeedProps {
  activities: Activity[]
  loading: boolean
  maxItems?: number
  showFilter?: boolean
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ 
  activities, 
  loading, 
  maxItems = 10,
  showFilter = true 
}) => {
  const [filter, setFilter] = useState<'all' | 'analysis' | 'outlier' | 'export'>('all')
  const [showAll, setShowAll] = useState(false)

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'analysis_started':
        return Play
      case 'analysis_completed':
        return CheckCircle
      case 'analysis_failed':
        return XCircle
      case 'outlier_found':
        return Star
      case 'channel_favorited':
        return Star
      case 'export_generated':
        return Download
      default:
        return ActivityIcon
    }
  }

  const getActivityColor = (severity: Activity['severity']) => {
    switch (severity) {
      case 'success':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20'
      case 'error':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20'
      default:
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20'
    }
  }

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now.getTime() - time.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return time.toLocaleDateString()
  }

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true
    if (filter === 'analysis') return activity.type.includes('analysis')
    if (filter === 'outlier') return activity.type === 'outlier_found'
    if (filter === 'export') return activity.type === 'export_generated'
    return true
  })

  const displayedActivities = showAll 
    ? filteredActivities 
    : filteredActivities.slice(0, maxItems)

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <LoadingSkeleton className="h-6 w-32" />
          {showFilter && <LoadingSkeleton className="h-8 w-24" />}
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start space-x-3">
              <LoadingSkeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <LoadingSkeleton className="h-4 w-3/4" />
                <LoadingSkeleton className="h-3 w-1/2" />
              </div>
              <LoadingSkeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <ActivityIcon className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        </div>
        
        {showFilter && (
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="analysis">Analysis</option>
              <option value="outlier">Outliers</option>
              <option value="export">Exports</option>
            </select>
          </div>
        )}
      </div>

      {/* Activity List */}
      {displayedActivities.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <ActivityIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
            <p className="text-xs">Your activities will appear here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedActivities.map((activity) => {
            const Icon = getActivityIcon(activity.type)
            const colorClass = getActivityColor(activity.severity)
            
            return (
              <div key={activity.id} className="flex items-start space-x-3 group">
                {/* Icon */}
                <div className={`flex-shrink-0 p-2 rounded-full ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {activity.title}
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(activity.timestamp)}
                      </span>
                      <Clock className="h-3 w-3 text-gray-400" />
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {activity.description}
                  </p>
                  
                  {/* Metadata */}
                  {activity.metadata && (
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {activity.metadata.outlierCount && (
                        <span>Outliers: {activity.metadata.outlierCount}</span>
                      )}
                      {activity.metadata.processingTime && (
                        <span>Time: {Math.round(activity.metadata.processingTime / 1000)}s</span>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Action */}
                {(activity.metadata?.analysisId || activity.metadata?.channelId) && (
                  <button 
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="View details"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Show More/Less Button */}
      {filteredActivities.length > maxItems && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
          >
            {showAll 
              ? `Show Less (${filteredActivities.length - maxItems} hidden)`
              : `Show All (${filteredActivities.length - maxItems} more)`}
          </button>
        </div>
      )}
      
      {/* Summary */}
      {activities.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Total activities: {activities.length}</span>
            <span>Filtered: {filteredActivities.length}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivityFeed