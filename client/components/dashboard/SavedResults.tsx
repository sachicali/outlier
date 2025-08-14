import React, { useState } from 'react'
import { 
  Star, 
  Heart, 
  Eye, 
  Download, 
  Trash2, 
  Edit3, 
  Tag,
  Folder,
  Search,
  Filter,
  Plus,
  MoreVertical
} from 'lucide-react'
import { SavedChannel, SavedVideo, SavedCollection } from '../../types/dashboard'
import LoadingSkeleton from '../ui/LoadingSkeleton'
import { toast } from 'react-hot-toast'

interface SavedResultsProps {
  savedChannels: SavedChannel[]
  savedVideos: SavedVideo[]
  loading: boolean
  onRefresh: () => void
}

const SavedResults: React.FC<SavedResultsProps> = ({ 
  savedChannels, 
  savedVideos, 
  loading, 
  onRefresh 
}) => {
  const [activeTab, setActiveTab] = useState<'channels' | 'videos' | 'collections'>('channels')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [showCreateCollection, setShowCreateCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [showActions, setShowActions] = useState<string | null>(null)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString()
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return
    
    try {
      // In a real implementation, this would call the API
      toast.success('Collection created successfully')
      setNewCollectionName('')
      setShowCreateCollection(false)
      onRefresh()
    } catch (error) {
      toast.error('Failed to create collection')
    }
  }

  const handleAddToCollection = async (itemIds: string[]) => {
    try {
      // In a real implementation, this would show a collection selector modal
      toast.success(`${itemIds.length} items added to collection`)
      setSelectedItems([])
    } catch (error) {
      toast.error('Failed to add to collection')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return
    
    if (confirm(`Delete ${selectedItems.length} selected items? This action cannot be undone.`)) {
      try {
        toast.success(`${selectedItems.length} items deleted`)
        setSelectedItems([])
        onRefresh()
      } catch (error) {
        toast.error('Failed to delete items')
      }
    }
  }

  const handleExportSelected = async () => {
    if (selectedItems.length === 0) return
    
    try {
      toast.success(`Exporting ${selectedItems.length} items...`)
    } catch (error) {
      toast.error('Failed to export items')
    }
  }

  const filteredChannels = savedChannels.filter(channel => 
    searchTerm === '' || 
    channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    channel.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const filteredVideos = savedVideos.filter(video => 
    searchTerm === '' || 
    video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.channelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <LoadingSkeleton className="h-6 w-32" />
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <LoadingSkeleton className="h-4 w-3/4 mb-2" />
                <LoadingSkeleton className="h-3 w-1/2 mb-2" />
                <LoadingSkeleton className="h-3 w-1/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Saved Results</h2>
          
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={() => setShowCreateCollection(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Collection
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="mt-4">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {[
              { id: 'channels', name: 'Channels', count: savedChannels.length },
              { id: 'videos', name: 'Videos', count: savedVideos.length },
              { id: 'collections', name: 'Collections', count: 0 }
            ].map((tab) => {
              const isActive = activeTab === tab.id
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`
                    group inline-flex items-center px-1 py-2 border-b-2 font-medium text-sm transition-colors duration-200
                    ${
                      isActive
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }
                  `}
                >
                  <span>{tab.name}</span>
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                    isActive 
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>
        
        {/* Bulk Actions */}
        {selectedItems.length > 0 && (
          <div className="mt-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <span className="text-sm text-blue-800 dark:text-blue-300">
              {selectedItems.length} selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleAddToCollection(selectedItems)}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-300 dark:hover:bg-blue-700"
              >
                <Folder className="w-3 h-3 mr-1" />
                Add to Collection
              </button>
              <button
                onClick={handleExportSelected}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-300 dark:hover:bg-blue-700"
              >
                <Download className="w-3 h-3 mr-1" />
                Export
              </button>
              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 dark:bg-red-800 dark:text-red-300 dark:hover:bg-red-700"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Channels Tab */}
        {activeTab === 'channels' && (
          <div>
            {filteredChannels.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No saved channels</p>
                  <p className="text-sm">Channels you favorite will appear here</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredChannels.map((channel) => (
                  <div key={channel.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {channel.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatNumber(channel.subscriberCount)} subscribers
                        </p>
                      </div>
                      
                      <div className="relative">
                        <button
                          onClick={() => setShowActions(showActions === channel.id ? null : channel.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        
                        {showActions === channel.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-600">
                            <div className="py-1">
                              <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">
                                <Eye className="w-4 h-4 mr-2" />
                                View Channel
                              </button>
                              <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">
                                <Edit3 className="w-4 h-4 mr-2" />
                                Edit Notes
                              </button>
                              <button className="flex items-center w-full px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Avg Score:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {channel.avgOutlierScore.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Analyses:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {channel.analysisCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Last Analyzed:</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {formatDate(channel.lastAnalyzed)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Tags */}
                    {channel.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {channel.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                            <Tag className="w-3 h-3 mr-1" />
                            {tag}
                          </span>
                        ))}
                        {channel.tags.length > 3 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">+{channel.tags.length - 3} more</span>
                        )}
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Saved {formatDate(channel.savedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <div>
            {filteredVideos.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <Heart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No saved videos</p>
                  <p className="text-sm">Videos you save will appear here</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVideos.map((video) => (
                  <div key={video.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm leading-tight mb-1">
                          {video.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {video.channelName}
                        </p>
                      </div>
                      
                      <div className="relative ml-2">
                        <button
                          onClick={() => setShowActions(showActions === video.id ? null : video.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Outlier Score:</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {video.outlierScore.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Views:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatNumber(video.views)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Published:</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {formatDate(video.publishedAt)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Tags */}
                    {video.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {video.tags.slice(0, 2).map((tag, index) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            <Tag className="w-3 h-3 mr-1" />
                            {tag}
                          </span>
                        ))}
                        {video.tags.length > 2 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">+{video.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Saved {formatDate(video.savedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collections Tab */}
        {activeTab === 'collections' && (
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Collections feature coming soon</p>
              <p className="text-sm">Organize your saved items into collections</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Collection Modal */}
      {showCreateCollection && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Create Collection
              </h3>
              <button
                onClick={() => setShowCreateCollection(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Collection Name
                </label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Enter collection name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateCollection(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCollection}
                disabled={!newCollectionName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SavedResults