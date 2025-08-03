import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Clock } from 'lucide-react';
import { apiClient } from '../../utils/apiClient';

interface TwoFactorVerificationProps {
  identifier: string; // email or username
  onSuccess: (data: any) => void;
  onCancel: () => void;
}

const TwoFactorVerification: React.FC<TwoFactorVerificationProps> = ({
  identifier,
  onSuccess,
  onCancel,
}) => {
  const [code, setCode] = useState('');
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [remainingLockout, setRemainingLockout] = useState(0);

  // Countdown timer for lockout
  useEffect(() => {
    if (remainingLockout > 0) {
      const timer = setInterval(() => {
        setRemainingLockout(prev => {
          if (prev <= 1) {
            setError('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [remainingLockout]);

  const handleVerification = async () => {
    if (!code.trim()) {
      setError('Please enter a verification code');
      return;
    }

    // Validate code format
    if (!isBackupCode && !/^\d{6}$/.test(code)) {
      setError('TOTP code must be 6 digits');
      return;
    }

    if (isBackupCode && !/^[A-F0-9\s-]{8,10}$/i.test(code)) {
      setError('Invalid backup code format');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await apiClient.post('/auth/2fa/verify', {
        token: code,
        identifier,
        isBackupCode,
      });

      if (response.data.success) {
        onSuccess(response.data.data);
      } else {
        setError(response.data.message || 'Invalid verification code');
        if (response.data.remainingLockout) {
          setRemainingLockout(Math.ceil(response.data.remainingLockout / 1000));
        }
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Verification failed';
      setError(errorMessage);
      
      if (err.response?.data?.remainingLockout) {
        setRemainingLockout(Math.ceil(err.response.data.remainingLockout / 1000));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && remainingLockout === 0) {
      handleVerification();
    }
  };

  const formatLockoutTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Two-Factor Authentication</h2>
        <p className="text-sm text-gray-600">
          Enter the verification code from your authenticator app
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {remainingLockout > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <Clock className="h-4 w-4 text-yellow-600 mr-2" />
            <p className="text-sm text-yellow-700">
              Too many failed attempts. Try again in {formatLockoutTime(remainingLockout)}.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isBackupCode ? 'Backup Code' : 'Verification Code'}
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              if (isBackupCode) {
                // Allow alphanumeric, spaces, and dashes for backup codes
                const value = e.target.value.toUpperCase().replace(/[^A-F0-9\s-]/g, '');
                setCode(value);
              } else {
                // Only allow digits for TOTP codes
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(value);
              }
            }}
            onKeyPress={handleKeyPress}
            placeholder={isBackupCode ? 'ABCD-EFGH' : '000000'}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={isBackupCode ? 10 : 6}
            disabled={loading || remainingLockout > 0}
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setIsBackupCode(!isBackupCode);
              setCode('');
              setError('');
            }}
            className="text-sm text-blue-600 hover:text-blue-700"
            disabled={loading || remainingLockout > 0}
          >
            {isBackupCode ? 'Use authenticator app' : 'Use backup code'}
          </button>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleVerification}
            disabled={loading || !code.trim() || remainingLockout > 0}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500">
          Lost your device? Contact support for assistance with account recovery.
        </p>
      </div>
    </div>
  );
};

export default TwoFactorVerification;