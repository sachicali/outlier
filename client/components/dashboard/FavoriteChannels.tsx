import React, { useState } from 'react'
import { Users, Star, StarOff, ExternalLink, Calendar, TrendingUp } from 'lucide-react'
import axios from 'axios'
import { toast } from 'react-hot-toast'

interface Channel {
  id: string
  name: string
  subscriberCount: number
  lastAnalyzed?: string
  avgOutlierScore: number
  thumbnailUrl?: string
  channelUrl?: string
  isFavorited?: boolean
}

interface FavoriteChannelsProps {
  channels: Channel[]
  loading?: boolean
  onRefresh?: () => void
}

export default function FavoriteChannels({ 
  channels, 
  loading = false, 
  onRefresh 
}: FavoriteChannelsProps) {
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null)

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toLocaleString()
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) return 'Today'
    if (diffInDays === 1) return 'Yesterday'
    if (diffInDays < 7) return `${diffInDays} days ago`
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600'
    if (score >= 60) return 'text-orange-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-green-600'
  }

  const handleToggleFavorite = async (channelId: string, isFavorited: boolean) => {
    try {
      setFavoriteLoading(channelId)
      
      if (isFavorited) {
        await axios.delete(`/api/favorites/channels/${channelId}`)
        toast.success('Channel removed from favorites')
      } else {
        await axios.post(`/api/favorites/channels/${channelId}`)
        toast.success('Channel added to favorites')
      }
      
      if (onRefresh) {
        onRefresh()
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
      toast.error('Failed to update favorites')
    } finally {
      setFavoriteLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Favorite Channels</h2>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2"></div>
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
          <h2 className="text-lg font-medium text-gray-900">Favorite Channels</h2>
          <span className="text-sm text-gray-500">
            {channels.length} {channels.length === 1 ? 'channel' : 'channels'}
          </span>
        </div>
      </div>
      
      <div className="divide-y divide-gray-200">
        {channels.length === 0 ? (
          <div className="p-6 text-center">
            <Star className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No favorite channels</h3>
            <p className="mt-1 text-sm text-gray-500">
              Star channels during analysis to track them here.
            </p>
          </div>
        ) : (
          channels.map((channel) => (
            <div key={channel.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  {/* Channel Avatar */}
                  <div className="flex-shrink-0">
                    {channel.thumbnailUrl ? (
                      <img
                        src={channel.thumbnailUrl}
                        alt={channel.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Channel Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {channel.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatNumber(channel.subscriberCount)} subscribers
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center mt-3 space-x-4 text-xs text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>Last analyzed: {formatDate(channel.lastAnalyzed)}</span>
                      </div>
                      <div className="flex items-center">
                        <TrendingUp className={`w-3 h-3 mr-1 ${getScoreColor(channel.avgOutlierScore)}`} />
                        <span className={getScoreColor(channel.avgOutlierScore)}>
                          Avg score: {channel.avgOutlierScore.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center mt-3 space-x-3">
                      {channel.channelUrl && (
                        <a
                          href={channel.channelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View Channel
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Favorite Button */}
                <div className="flex-shrink-0 ml-4">
                  <button
                    onClick={() => handleToggleFavorite(channel.id, channel.isFavorited || false)}
                    disabled={favoriteLoading === channel.id}
                    className={`p-2 rounded-full transition-colors ${
                      channel.isFavorited
                        ? 'text-yellow-500 hover:text-yellow-600 bg-yellow-50'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                    } disabled:opacity-50`}
                    title={channel.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {favoriteLoading === channel.id ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : channel.isFavorited ? (
                      <Star className="w-4 h-4 fill-current" />
                    ) : (
                      <StarOff className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}