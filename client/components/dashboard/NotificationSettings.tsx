import React, { useState } from 'react'
import { 
  Bell, 
  Mail, 
  Smartphone, 
  Clock, 
  Volume2, 
  VolumeX,
  Save,
  RefreshCw
} from 'lucide-react'
import { NotificationSettings as NotificationSettingsType } from '../../types/dashboard'
import { toast } from 'react-hot-toast'

interface NotificationSettingsProps {
  settings?: NotificationSettingsType
  onSave: (settings: NotificationSettingsType) => void
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ settings, onSave }) => {
  const [saving, setSaving] = useState(false)
  const [localSettings, setLocalSettings] = useState<NotificationSettingsType>(settings || {
    email: {
      analysisComplete: true,
      analysisError: true,
      quotaWarning: true,
      weeklyReport: false,
      monthlyReport: true
    },
    push: {
      analysisComplete: true,
      analysisError: true,
      quotaWarning: true
    },
    preferences: {
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      frequency: 'immediate'
    }
  })

  const handleEmailToggle = (key: keyof NotificationSettingsType['email']) => {
    setLocalSettings(prev => ({
      ...prev,
      email: {
        ...prev.email,
        [key]: !prev.email[key]
      }
    }))
  }

  const handlePushToggle = (key: keyof NotificationSettingsType['push']) => {
    setLocalSettings(prev => ({
      ...prev,
      push: {
        ...prev.push,
        [key]: !prev.push[key]
      }
    }))
  }

  const handleQuietHoursToggle = () => {
    setLocalSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        quietHours: {
          ...prev.preferences.quietHours,
          enabled: !prev.preferences.quietHours.enabled
        }
      }
    }))
  }

  const handleQuietHoursChange = (field: 'start' | 'end', value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        quietHours: {
          ...prev.preferences.quietHours,
          [field]: value
        }
      }
    }))
  }

  const handleFrequencyChange = (frequency: NotificationSettingsType['preferences']['frequency']) => {
    setLocalSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        frequency
      }
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await onSave(localSettings)
    } catch (error) {
      // Error is handled by parent component
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(localSettings)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Notification Settings
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure how you want to be notified</p>
          </div>
          
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Email Notifications */}
        <div>
          <div className="flex items-center mb-4">
            <Mail className="h-5 w-5 text-gray-400 mr-2" />
            <h4 className="text-md font-medium text-gray-900 dark:text-white">Email Notifications</h4>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Analysis Complete</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Get notified when your analysis finishes</p>
              </div>
              <button
                onClick={() => handleEmailToggle('analysisComplete')}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  localSettings.email.analysisComplete ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    localSettings.email.analysisComplete ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Analysis Errors</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Get notified when an analysis fails</p>
              </div>
              <button
                onClick={() => handleEmailToggle('analysisError')}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  localSettings.email.analysisError ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    localSettings.email.analysisError ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Quota Warnings</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Get warned when approaching API limits</p>
              </div>
              <button
                onClick={() => handleEmailToggle('quotaWarning')}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  localSettings.email.quotaWarning ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    localSettings.email.quotaWarning ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Weekly Report</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Weekly summary of your activity</p>
              </div>
              <button
                onClick={() => handleEmailToggle('weeklyReport')}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  localSettings.email.weeklyReport ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    localSettings.email.weeklyReport ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Monthly Report</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Monthly summary with insights and trends</p>
              </div>
              <button
                onClick={() => handleEmailToggle('monthlyReport')}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  localSettings.email.monthlyReport ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    localSettings.email.monthlyReport ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center mb-4">
            <Smartphone className="h-5 w-5 text-gray-400 mr-2" />
            <h4 className="text-md font-medium text-gray-900 dark:text-white">Push Notifications</h4>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Analysis Complete</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Browser notification when analysis finishes</p>
              </div>
              <button
                onClick={() => handlePushToggle('analysisComplete')}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  localSettings.push.analysisComplete ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    localSettings.push.analysisComplete ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Analysis Errors</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Browser notification when analysis fails</p>
              </div>
              <button
                onClick={() => handlePushToggle('analysisError')}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  localSettings.push.analysisError ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    localSettings.push.analysisError ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Quota Warnings</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Browser notification for quota warnings</p>
              </div>
              <button
                onClick={() => handlePushToggle('quotaWarning')}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  localSettings.push.quotaWarning ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    localSettings.push.quotaWarning ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center mb-4">
            <Clock className="h-5 w-5 text-gray-400 mr-2" />
            <h4 className="text-md font-medium text-gray-900 dark:text-white">Preferences</h4>
          </div>
          
          <div className="space-y-4">
            {/* Notification Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notification Frequency
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'immediate', label: 'Immediate', icon: Volume2 },
                  { value: 'hourly', label: 'Hourly', icon: Clock },
                  { value: 'daily', label: 'Daily', icon: VolumeX }
                ].map((option) => {
                  const Icon = option.icon
                  const isSelected = localSettings.preferences.frequency === option.value
                  
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleFrequencyChange(option.value as any)}
                      className={`p-3 border-2 rounded-lg flex flex-col items-center justify-center space-y-1 transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${
                        isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                      }`} />
                      <span className={`text-sm font-medium ${
                        isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {option.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Quiet Hours */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Quiet Hours</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Disable notifications during specific hours</p>
                </div>
                <button
                  onClick={handleQuietHoursToggle}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    localSettings.preferences.quietHours.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      localSettings.preferences.quietHours.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              
              {localSettings.preferences.quietHours.enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={localSettings.preferences.quietHours.start}
                      onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={localSettings.preferences.quietHours.end}
                      onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setLocalSettings(settings || localSettings)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationSettings