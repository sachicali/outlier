import React, { useState } from 'react'
import { 
  Key, 
  Plus, 
  Eye, 
  EyeOff, 
  Copy, 
  Trash2, 
  Calendar,
  Activity,
  AlertTriangle,
  Settings,
  X
} from 'lucide-react'
import { ApiKey } from '../../types/dashboard'
import { toast } from 'react-hot-toast'
import LoadingSkeleton from '../ui/LoadingSkeleton'

interface ApiKeyManagementProps {
  apiKeys: ApiKey[]
  onRefresh: () => void
}

const ApiKeyManagement: React.FC<ApiKeyManagementProps> = ({ apiKeys, onRefresh }) => {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    permissions: [] as string[],
    expiresIn: '30' // days
  })

  const availablePermissions = [
    { id: 'analysis:read', name: 'Read Analyses', description: 'View analysis results and history' },
    { id: 'analysis:create', name: 'Create Analyses', description: 'Start new outlier analyses' },
    { id: 'analysis:delete', name: 'Delete Analyses', description: 'Remove analysis records' },
    { id: 'channels:read', name: 'Read Channels', description: 'View channel information' },
    { id: 'channels:favorite', name: 'Manage Favorites', description: 'Add/remove favorite channels' },
    { id: 'export:create', name: 'Export Data', description: 'Export analysis results and reports' },
    { id: 'dashboard:read', name: 'Dashboard Access', description: 'View dashboard metrics and insights' }
  ]

  const toggleKeyVisibility = (keyId: string) => {
    const newVisible = new Set(visibleKeys)
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId)
    } else {
      newVisible.add(keyId)
    }
    setVisibleKeys(newVisible)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('API key copied to clipboard')
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      toast.success('API key copied to clipboard')
    }
  }

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key
    return `${key.substring(0, 4)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 4)}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getKeyStatus = (apiKey: ApiKey) => {
    if (!apiKey.isActive) return { status: 'inactive', color: 'text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400' }
    
    if (apiKey.expiresAt) {
      const expiryDate = new Date(apiKey.expiresAt)
      const now = new Date()
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysUntilExpiry <= 0) {
        return { status: 'expired', color: 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400' }
      } else if (daysUntilExpiry <= 7) {
        return { status: 'expiring', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400' }
      }
    }
    
    return { status: 'active', color: 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400' }
  }

  const handleCreateApiKey = async () => {
    if (!newKeyForm.name.trim()) {
      toast.error('Please enter a name for the API key')
      return
    }
    
    if (newKeyForm.permissions.length === 0) {
      toast.error('Please select at least one permission')
      return
    }

    try {
      setCreating(true)
      
      // In a real implementation, this would call the API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast.success('API key created successfully')
      setShowCreateModal(false)
      setNewKeyForm({ name: '', permissions: [], expiresIn: '30' })
      onRefresh()
    } catch (error) {
      toast.error('Failed to create API key')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteApiKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Delete API key "${keyName}"? This action cannot be undone and will immediately revoke access for any applications using this key.`)) {
      return
    }

    try {
      // In a real implementation, this would call the API
      toast.success('API key deleted successfully')
      onRefresh()
    } catch (error) {
      toast.error('Failed to delete API key')
    }
  }

  const handleToggleKeyStatus = async (keyId: string, currentStatus: boolean) => {
    try {
      // In a real implementation, this would call the API
      toast.success(`API key ${currentStatus ? 'deactivated' : 'activated'} successfully`)
      onRefresh()
    } catch (error) {
      toast.error(`Failed to ${currentStatus ? 'deactivate' : 'activate'} API key`)
    }
  }

  const handlePermissionToggle = (permissionId: string) => {
    setNewKeyForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }))
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">API Keys</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your API keys for programmatic access</p>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create API Key
          </button>
        </div>
      </div>

      {/* API Keys List */}
      <div className="p-6">
        {apiKeys.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No API keys found</p>
              <p className="text-sm">Create your first API key to get started</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {apiKeys.map((apiKey) => {
              const keyStatus = getKeyStatus(apiKey)
              const isVisible = visibleKeys.has(apiKey.id)
              
              return (
                <div key={apiKey.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {apiKey.name}
                        </h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${keyStatus.color}`}>
                          {keyStatus.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Created {formatDate(apiKey.createdAt)}
                        </div>
                        
                        {apiKey.lastUsed && (
                          <div className="flex items-center">
                            <Activity className="w-4 h-4 mr-1" />
                            Last used {formatDate(apiKey.lastUsed)}
                          </div>
                        )}
                        
                        <div className="flex items-center">
                          <span>Usage: {apiKey.usageCount.toLocaleString()}</span>
                        </div>
                        
                        {apiKey.expiresAt && (
                          <div className="flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-1 text-yellow-500" />
                            Expires {formatDate(apiKey.expiresAt)}
                          </div>
                        )}
                      </div>
                      
                      {/* API Key Display */}
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 mb-3">
                        <div className="flex items-center justify-between">
                          <code className="text-sm font-mono text-gray-900 dark:text-gray-100">
                            {isVisible ? apiKey.key : maskApiKey(apiKey.key)}
                          </code>
                          
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleKeyVisibility(apiKey.id)}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              title={isVisible ? 'Hide key' : 'Show key'}
                            >
                              {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            
                            <button
                              onClick={() => copyToClipboard(apiKey.key)}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              title="Copy to clipboard"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Permissions */}
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Permissions:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {apiKey.permissions.map((permission) => (
                            <span key={permission} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                              {permission}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleToggleKeyStatus(apiKey.id, apiKey.isActive)}
                        className={`px-3 py-1 text-xs font-medium rounded ${
                          apiKey.isActive
                            ? 'text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                            : 'text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
                        }`}
                      >
                        {apiKey.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      
                      <button
                        onClick={() => handleDeleteApiKey(apiKey.id, apiKey.name)}
                        className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                        title="Delete API key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Create API Key
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={newKeyForm.name}
                  onChange={(e) => setNewKeyForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Production API, Mobile App"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Expires in
                </label>
                <select
                  value={newKeyForm.expiresIn}
                  onChange={(e) => setNewKeyForm(prev => ({ ...prev, expiresIn: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                  <option value="never">Never</option>
                </select>
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Permissions
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availablePermissions.map((permission) => (
                    <label key={permission.id} className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={newKeyForm.permissions.includes(permission.id)}
                        onChange={() => handlePermissionToggle(permission.id)}
                        className="mt-1 rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {permission.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {permission.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              
              <button
                onClick={handleCreateApiKey}
                disabled={creating || !newKeyForm.name.trim() || newKeyForm.permissions.length === 0}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Create Key
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ApiKeyManagement