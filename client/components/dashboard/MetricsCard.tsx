import React from 'react'
import { LucideIcon } from 'lucide-react'

interface MetricsCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: LucideIcon
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow'
  loading?: boolean
  showComparison?: boolean
  trend?: 'up' | 'down' | 'stable'
  onClick?: () => void
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-500',
    text: 'text-blue-600',
    lightBg: 'bg-blue-50',
    darkText: 'dark:text-blue-400',
    darkLightBg: 'dark:bg-blue-900/20'
  },
  green: {
    bg: 'bg-green-500',
    text: 'text-green-600',
    lightBg: 'bg-green-50',
    darkText: 'dark:text-green-400',
    darkLightBg: 'dark:bg-green-900/20'
  },
  purple: {
    bg: 'bg-purple-500',
    text: 'text-purple-600',
    lightBg: 'bg-purple-50',
    darkText: 'dark:text-purple-400',
    darkLightBg: 'dark:bg-purple-900/20'
  },
  orange: {
    bg: 'bg-orange-500',
    text: 'text-orange-600',
    lightBg: 'bg-orange-50',
    darkText: 'dark:text-orange-400',
    darkLightBg: 'dark:bg-orange-900/20'
  },
  red: {
    bg: 'bg-red-500',
    text: 'text-red-600',
    lightBg: 'bg-red-50',
    darkText: 'dark:text-red-400',
    darkLightBg: 'dark:bg-red-900/20'
  },
  yellow: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600',
    lightBg: 'bg-yellow-50',
    darkText: 'dark:text-yellow-400',
    darkLightBg: 'dark:bg-yellow-900/20'
  }
}

export default function MetricsCard({ 
  title, 
  value, 
  change, 
  changeLabel, 
  icon: Icon, 
  color,
  loading = false,
  showComparison = true,
  trend,
  onClick
}: MetricsCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg animate-pulse border border-gray-200 dark:border-gray-700">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`${colorClasses[color].lightBg} ${colorClasses[color].darkLightBg} inline-flex items-center justify-center p-3 rounded-md`}>
                <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded"></div>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-2"></div>
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`
        bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg 
        hover:shadow-md transition-all duration-200 
        border border-gray-200 dark:border-gray-700
        ${onClick ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-600' : ''}
      `}
      onClick={onClick}
    >
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`${colorClasses[color].lightBg} ${colorClasses[color].darkLightBg} inline-flex items-center justify-center p-3 rounded-md`}>
              <Icon className={`w-6 h-6 ${colorClasses[color].text} ${colorClasses[color].darkText}`} />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                {title}
              </dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </div>
                {showComparison && change !== undefined && (
                  <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                    change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {change >= 0 ? '+' : ''}{Math.abs(change) < 1 ? change.toFixed(1) : Math.round(change)}{typeof change === 'number' ? '%' : ''}
                    {changeLabel && (
                      <span className="ml-1 text-gray-500 dark:text-gray-400 font-normal">
                        {changeLabel}
                      </span>
                    )}
                  </div>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}