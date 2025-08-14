import React, { useState } from 'react'
import { 
  Shield, 
  Key, 
  Smartphone, 
  Monitor, 
  AlertTriangle, 
  Check, 
  X,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  MapPin,
  Calendar
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import LoadingSkeleton from '../ui/LoadingSkeleton'

interface User {
  id: string
  username: string
  email: string
  role: string
}

interface SecuritySettingsProps {
  user: User | null
}

const SecuritySettings: React.FC<SecuritySettingsProps> = ({ user }) => {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [loading, setLoading] = useState(false)
  
  // Mock data - in real implementation, this would come from props or API
  const activeSessions = [
    {
      id: '1',
      device: 'Chrome on Windows',
      location: 'New York, US',
      lastActivity: '2024-01-15T10:30:00Z',
      isCurrentSession: true
    },
    {
      id: '2',
      device: 'Safari on iPhone',
      location: 'San Francisco, US',
      lastActivity: '2024-01-14T15:45:00Z',
      isCurrentSession: false
    },
    {
      id: '3',
      device: 'Firefox on Linux',
      location: 'London, UK',
      lastActivity: '2024-01-13T09:20:00Z',
      isCurrentSession: false
    }
  ]
  
  const loginHistory = [
    {
      timestamp: '2024-01-15T10:30:00Z',
      ip: '192.168.1.100',
      location: 'New York, US',
      success: true,
      userAgent: 'Chrome 120.0.0.0'
    },
    {
      timestamp: '2024-01-14T15:45:00Z',
      ip: '10.0.0.50',
      location: 'San Francisco, US',
      success: true,
      userAgent: 'Safari 17.0'
    },
    {
      timestamp: '2024-01-13T18:22:00Z',
      ip: '203.0.113.1',
      location: 'Unknown',
      success: false,
      userAgent: 'Chrome 119.0.0.0'
    }
  ]

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  const handleToggle2FA = async () => {
    try {
      setLoading(true)
      
      // In a real implementation, this would:
      // 1. If enabling: show QR code for authenticator app setup
      // 2. If disabling: require current password + 2FA code
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setTwoFactorEnabled(!twoFactorEnabled)
      toast.success(
        twoFactorEnabled 
          ? 'Two-factor authentication disabled' 
          : 'Two-factor authentication enabled'
      )
    } catch (error) {
      toast.error('Failed to update two-factor authentication')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Please fill in all password fields')
      return
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    try {
      setLoading(true)
      
      // In a real implementation, this would call the API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast.success('Password changed successfully')
      setShowChangePassword(false)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      toast.error('Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeSession = async (sessionId: string, deviceName: string) => {
    if (!confirm(`Revoke session for "${deviceName}"? This will immediately log out this device.`)) {
      return
    }

    try {
      // In a real implementation, this would call the API
      toast.success('Session revoked successfully')
    } catch (error) {
      toast.error('Failed to revoke session')
    }
  }

  const handleRevokeAllSessions = async () => {
    if (!confirm('Revoke all other sessions? This will log out all devices except the current one.')) {
      return
    }

    try {
      // In a real implementation, this would call the API
      toast.success('All other sessions revoked')
    } catch (error) {
      toast.error('Failed to revoke sessions')
    }
  }

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    
    return {
      score: strength,
      label: ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][strength] || 'Very Weak',
      color: ['red', 'red', 'yellow', 'blue', 'green'][strength] || 'red'
    }
  }

  const passwordStrength = getPasswordStrength(passwordForm.newPassword)

  if (!user) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <LoadingSkeleton className="h-6 w-32 mb-4" />
        <LoadingSkeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Shield className="h-5 w-5 text-gray-400 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Security Settings</h3>
      </div>

      <div className="space-y-6">
        {/* Password Security */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-white">Password</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last changed 30 days ago</p>
            </div>
            <button
              onClick={() => setShowChangePassword(!showChangePassword)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <Key className="w-4 h-4 mr-2" />
              {showChangePassword ? 'Cancel' : 'Change Password'}
            </button>
          </div>

          {showChangePassword && (
            <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('current')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPasswords.current ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('new')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPasswords.new ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {passwordForm.newPassword && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Password strength:</span>
                        <span className={`font-medium ${
                          passwordStrength.color === 'green' ? 'text-green-600 dark:text-green-400' :
                          passwordStrength.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                          passwordStrength.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-1">
                        <div 
                          className={`h-1 rounded-full transition-all duration-300 ${
                            passwordStrength.color === 'green' ? 'bg-green-500' :
                            passwordStrength.color === 'blue' ? 'bg-blue-500' :
                            passwordStrength.color === 'yellow' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('confirm')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPasswords.confirm ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  
                  {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Passwords do not match
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3">
                  <button
                    onClick={() => setShowChangePassword(false)}
                    disabled={loading}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={loading || !passwordForm.currentPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    {loading ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Two-Factor Authentication */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-white flex items-center">
                <Smartphone className="w-4 h-4 mr-2" />
                Two-Factor Authentication
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {twoFactorEnabled 
                  ? 'Your account is protected with 2FA'
                  : 'Add an extra layer of security to your account'
                }
              </p>
            </div>
            
            <button
              onClick={handleToggle2FA}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                twoFactorEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-white flex items-center">
                <Monitor className="w-4 h-4 mr-2" />
                Active Sessions
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Devices currently signed into your account</p>
            </div>
            
            <button
              onClick={handleRevokeAllSessions}
              className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              Revoke All Others
            </button>
          </div>
          
          <div className="space-y-3">
            {activeSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Monitor className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {session.device}
                      </span>
                      {session.isCurrentSession && (
                        <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full dark:bg-green-900/20 dark:text-green-400">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-4">
                      <span className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        {session.location}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(session.lastActivity)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {!session.isCurrentSession && (
                  <button
                    onClick={() => handleRevokeSession(session.id, session.device)}
                    className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    title="Revoke session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Login History */}
        <div>
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">Recent Login Activity</h4>
          <div className="space-y-2">
            {loginHistory.slice(0, 5).map((login, index) => (
              <div key={index} className="flex items-center justify-between py-2 px-3 text-sm">
                <div className="flex items-center space-x-3">
                  {login.success ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <X className="w-4 h-4 text-red-500" />
                  )}
                  <div>
                    <span className="text-gray-900 dark:text-white">
                      {login.success ? 'Successful login' : 'Failed login attempt'}
                    </span>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {login.location} • {login.ip} • {login.userAgent}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(login.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SecuritySettings