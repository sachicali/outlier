import React from 'react'
import { Video, ExternalLink, Calendar, TrendingUp, Eye } from 'lucide-react'
import Link from 'next/link'

interface Outlier {
  id: string
  title: string
  channelName: string
  views: number
  outlierScore: number
  publishedAt: string
  analysisId: string
  thumbnailUrl?: string
  channelUrl?: string
  videoUrl?: string
}

interface RecentOutliersProps {
  outliers: Outlier[]
  loading?: boolean
}

export default function RecentOutliers({ outliers, loading = false }: RecentOutliersProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toLocaleString()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 24) {
      return `${diffInHours}h ago`
    }
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 30) {
      return `${diffInDays}d ago`
    }
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600 bg-red-100'
    if (score >= 60) return 'text-orange-600 bg-orange-100'
    if (score >= 40) return 'text-yellow-600 bg-yellow-100'
    return 'text-green-600 bg-green-100'
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Outliers</h2>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-start space-x-4">
                <div className="w-20 h-12 bg-gray-300 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  <div className="flex space-x-4">
                    <div className="h-3 bg-gray-300 rounded w-16"></div>
                    <div className="h-3 bg-gray-300 rounded w-20"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Recent Outliers</h2>
          <Link
            href="/discovery"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View all
          </Link>
        </div>
      </div>
      
      <div className="divide-y divide-gray-200">
        {outliers.length === 0 ? (
          <div className="p-6 text-center">
            <Video className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No outliers yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Run your first analysis to discover outlier videos.
            </p>
            <div className="mt-6">
              <Link
                href="/discovery"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Start Discovery
              </Link>
            </div>
          </div>
        ) : (
          outliers.slice(0, 5).map((outlier) => (
            <div key={outlier.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start space-x-4">
                {/* Thumbnail */}
                <div className="flex-shrink-0">
                  {outlier.thumbnailUrl ? (
                    <img
                      src={outlier.thumbnailUrl}
                      alt={outlier.title}
                      className="w-20 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-20 h-12 bg-gray-200 rounded flex items-center justify-center">
                      <Video className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
                        {outlier.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {outlier.channelName}
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0 ml-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        getScoreColor(outlier.outlierScore)
                      }`}>
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {outlier.outlierScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center mt-3 space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Eye className="w-4 h-4 mr-1" />
                      <span>{formatNumber(outlier.views)} views</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span>{formatDate(outlier.publishedAt)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center mt-3 space-x-3">
                    {outlier.videoUrl && (
                      <a
                        href={outlier.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Watch Video
                      </a>
                    )}
                    <Link
                      href={`/analysis/${outlier.analysisId}`}
                      className="inline-flex items-center text-xs text-gray-600 hover:text-gray-800"
                    >
                      View Analysis
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {outliers.length > 5 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <Link
            href="/discovery"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View {outliers.length - 5} more outliers →
          </Link>
        </div>
      )}
    </div>
  )
}