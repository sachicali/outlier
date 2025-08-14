import React, { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Copy, Check, Download, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../utils/apiClient';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface SetupData {
  qrCode: string;
  manualEntryKey: string;
  backupCodes: string[];
}

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<'generate' | 'verify' | 'backup'>('generate');
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showManualKey, setShowManualKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [secret, setSecret] = useState('');

  // Generate 2FA setup data
  useEffect(() => {
    generateSetupData();
  }, []);

  const generateSetupData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiClient.post('/auth/2fa/setup');
      
      setSetupData({
        qrCode: response.data.qrCode,
        manualEntryKey: response.data.manualEntryKey,
        backupCodes: response.data.backupCodes
      });
      setSecret(response.data.manualEntryKey);
      setBackupCodes(response.data.backupCodes);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await apiClient.post('/auth/2fa/enable', {
        verificationCode: verificationCode,
        secret: secret,
        backupCodes: backupCodes
      });
      
      setStep('backup');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to enable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'key' | 'codes') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'key') {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      } else {
        setCopiedCodes(true);
        setTimeout(() => setCopiedCodes(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const downloadBackupCodes = () => {
    const content = `Two-Factor Authentication Backup Codes\n\nGenerated on: ${new Date().toLocaleString()}\n\nIMPORTANT: Store these codes securely. Each code can only be used once.\n\n${backupCodes.join('\n')}\n\nIf you lose access to your authenticator app, you can use these codes to regain access to your account.`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading && !setupData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center mb-6">
        <Shield className="h-6 w-6 text-blue-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-900">Set Up Two-Factor Authentication</h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {step === 'generate' && setupData && (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <div className="flex justify-center mb-4">
              <img 
                src={setupData.qrCode} 
                alt="2FA QR Code" 
                className="border border-gray-200 rounded-lg"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <button
              onClick={() => setShowManualKey(!showManualKey)}
              className="text-sm text-blue-600 hover:text-blue-700 mb-2"
            >
              Can't scan? Enter code manually
            </button>
            
            {showManualKey && (
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-xs text-gray-500 mb-2">Manual entry key:</p>
                <div className="flex items-center justify-between bg-white p-2 rounded border">
                  <code className="text-sm font-mono text-gray-800 break-all">
                    {setupData.manualEntryKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(setupData.manualEntryKey, 'key')}
                    className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    {copiedKey ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => setStep('verify')}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Next
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'verify' && (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Enter the 6-digit code from your authenticator app to verify the setup:
            </p>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setVerificationCode(value);
              }}
              placeholder="000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={6}
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={verifyAndEnable}
              disabled={loading || verificationCode.length !== 6}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify & Enable'}
            </button>
            <button
              onClick={() => setStep('generate')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === 'backup' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">2FA Enabled Successfully!</h3>
            <p className="text-sm text-gray-600">
              Save these backup codes in a secure location. Each code can only be used once.
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-md">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">Backup Codes</h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => copyToClipboard(backupCodes.join('\n'), 'codes')}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                >
                  {copiedCodes ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  Copy
                </button>
                <button
                  onClick={downloadBackupCodes}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, index) => (
                <code key={index} className="text-sm font-mono bg-white p-2 rounded border text-center">
                  {code}
                </code>
              ))}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div className="flex items-start">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2 mt-0.5" />
              <div>
                <p className="text-xs text-yellow-800 font-medium">Important:</p>
                <p className="text-xs text-yellow-700">
                  Store these codes securely offline. If you lose your authenticator device, 
                  these codes are your only way to regain access.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onComplete}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Complete Setup
          </button>
        </div>
      )}
    </div>
  );
};

export default TwoFactorSetup;