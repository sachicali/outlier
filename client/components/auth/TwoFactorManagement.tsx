import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ShieldX, Key, Download, Copy, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { apiClient } from '../../utils/apiClient';
import TwoFactorSetup from './TwoFactorSetup';

interface TwoFactorStatus {
  enabled: boolean;
  backupCodes: {
    total: number;
    used: number;
    remaining: number;
  };
}

const TwoFactorManagement: React.FC = () => {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [showBackupCodeForm, setShowBackupCodeForm] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [showDisablePassword, setShowDisablePassword] = useState(false);
  const [showBackupPassword, setShowBackupPassword] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/auth/2fa/status');
      setStatus(response.data);
    } catch (err: any) {
      setError('Failed to fetch 2FA status');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword.trim()) {
      setError('Password is required to disable 2FA');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await apiClient.post('/auth/2fa/disable', {
        password: disablePassword,
      });

      setStatus({
        enabled: false,
        backupCodes: {
          total: 0,
          used: 0,
          remaining: 0,
        },
      });
      setShowDisableForm(false);
      setDisablePassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!backupPassword.trim()) {
      setError('Password is required to regenerate backup codes');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await apiClient.post('/auth/2fa/backup-codes');

      setNewBackupCodes(response.data.backupCodes);
      setStatus(prev => prev ? {
        ...prev,
        backupCodes: {
          total: response.data.backupCodes.length,
          used: 0,
          remaining: response.data.backupCodes.length,
        },
      } : null);
      setBackupPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to regenerate backup codes');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(newBackupCodes.join('\n'));
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    } catch (err) {
      console.error('Failed to copy backup codes:', err);
    }
  };

  const downloadBackupCodes = () => {
    const content = `Two-Factor Authentication Backup Codes\n\nRegenerated on: ${new Date().toLocaleString()}\n\nIMPORTANT: Store these codes securely. Each code can only be used once.\n\n${newBackupCodes.join('\n')}\n\nIf you lose access to your authenticator app, you can use these codes to regain access to your account.`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes-new.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (showSetup) {
    return (
      <TwoFactorSetup
        onComplete={() => {
          setShowSetup(false);
          fetchStatus();
        }}
        onCancel={() => setShowSetup(false)}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center mb-6">
        <Shield className="h-6 w-6 text-blue-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-900">Two-Factor Authentication</h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {status && (
        <div className="space-y-6">
          {/* Current Status */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {status.enabled ? (
                  <>
                    <ShieldCheck className="h-5 w-5 text-green-600 mr-2" />
                    <div>
                      <p className="font-medium text-gray-900">2FA Enabled</p>
                      <p className="text-sm text-gray-500">
                        Your account is protected with 2FA
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <ShieldX className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <p className="font-medium text-gray-900">2FA Disabled</p>
                      <p className="text-sm text-gray-500">
                        Your account is protected by password only
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              {!status.enabled && (
                <button
                  onClick={() => setShowSetup(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Enable 2FA
                </button>
              )}
            </div>
          </div>

          {status.enabled && (
            <>
              {/* Backup Codes Status */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Key className="h-5 w-5 text-gray-600 mr-2" />
                    <div>
                      <p className="font-medium text-gray-900">Backup Codes</p>
                      <p className="text-sm text-gray-500">
                        {status.backupCodes.remaining} backup codes remaining
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowBackupCodeForm(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Regenerate Codes
                  </button>
                </div>

                {status.backupCodes.remaining <= 2 && status.backupCodes.total > 0 && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-700">
                      ⚠️ You have {status.backupCodes.remaining} backup codes remaining. 
                      Consider regenerating new codes.
                    </p>
                  </div>
                )}
              </div>

              {/* Regenerate Backup Codes Form */}
              {showBackupCodeForm && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-3">Regenerate Backup Codes</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    This will invalidate all existing backup codes and generate new ones.
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm your password
                      </label>
                      <div className="relative">
                        <input
                          type={showBackupPassword ? 'text' : 'password'}
                          value={backupPassword}
                          onChange={(e) => setBackupPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                          placeholder="Enter your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowBackupPassword(!showBackupPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showBackupPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={handleRegenerateBackupCodes}
                        disabled={loading || !backupPassword.trim()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {loading ? 'Generating...' : 'Generate New Codes'}
                      </button>
                      <button
                        onClick={() => {
                          setShowBackupCodeForm(false);
                          setBackupPassword('');
                          setError('');
                        }}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* New Backup Codes Display */}
              {newBackupCodes.length > 0 && (
                <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-green-900">New Backup Codes Generated</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={copyBackupCodes}
                        className="text-sm text-green-700 hover:text-green-800 flex items-center"
                      >
                        {copiedCodes ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                        Copy
                      </button>
                      <button
                        onClick={downloadBackupCodes}
                        className="text-sm text-green-700 hover:text-green-800 flex items-center"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {newBackupCodes.map((code, index) => (
                      <code key={index} className="text-sm font-mono bg-white p-2 rounded border text-center">
                        {code}
                      </code>
                    ))}
                  </div>
                  
                  <p className="text-xs text-green-700">
                    Save these codes in a secure location. Each code can only be used once.
                  </p>
                  
                  <button
                    onClick={() => setNewBackupCodes([])}
                    className="mt-3 text-sm text-green-600 hover:text-green-700"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Disable 2FA */}
              <div className="border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Disable Two-Factor Authentication</p>
                    <p className="text-sm text-gray-500">
                      Remove 2FA protection from your account
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setShowDisableForm(true)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Disable 2FA
                  </button>
                </div>

                {showDisableForm && (
                  <div className="mt-4 pt-4 border-t border-red-200">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Confirm your password to disable 2FA
                        </label>
                        <div className="relative">
                          <input
                            type={showDisablePassword ? 'text' : 'password'}
                            value={disablePassword}
                            onChange={(e) => setDisablePassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent pr-10"
                            placeholder="Enter your password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowDisablePassword(!showDisablePassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            {showDisablePassword ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex space-x-3">
                        <button
                          onClick={handleDisable2FA}
                          disabled={loading || !disablePassword.trim()}
                          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {loading ? 'Disabling...' : 'Disable 2FA'}
                        </button>
                        <button
                          onClick={() => {
                            setShowDisableForm(false);
                            setDisablePassword('');
                            setError('');
                          }}
                          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TwoFactorManagement;