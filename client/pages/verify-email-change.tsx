import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import apiClient from '../utils/apiClient';

const VerifyEmailChangePage: React.FC = () => {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const { token } = router.query;
    
    if (token && typeof token === 'string') {
      verifyEmailChange(token);
    } else if (router.isReady) {
      setStatus('error');
      setMessage('Invalid verification link');
    }
  }, [router.query, router.isReady]);

  const verifyEmailChange = async (token: string) => {
    try {
      setStatus('loading');
      
      const response = await apiClient.post('/api/auth/confirm-email-change', {
        token,
      });

      setStatus('success');
      setMessage('Email address changed successfully!');
      setUser(response.data.user);
    } catch (error: any) {
      console.error('Email verification failed:', error);
      setStatus('error');
      
      if (error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('Email verification failed. The link may be invalid or expired.');
      }
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Email Change</h2>
            <p className="text-gray-600">Please wait while we verify your new email address...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified Successfully!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            {user && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600">Your new email address:</p>
                <p className="font-semibold text-gray-900">{user.email}</p>
              </div>
            )}
            <div className="space-x-4">
              <button
                onClick={() => router.push('/profile')}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Go to Profile
              </button>
              <button
                onClick={() => router.push('/discovery')}
                className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                Continue to App
              </button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">What can you do?</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Check that you used the correct verification link</li>
                  <li>• Make sure the link hasn't expired (links expire after 24 hours)</li>
                  <li>• Try changing your email again from your profile settings</li>
                  <li>• Contact support if you continue to have issues</li>
                </ul>
              </div>
              <div className="space-x-4">
                <button
                  onClick={() => router.push('/profile')}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Back to Profile
                </button>
                <button
                  onClick={() => router.push('/login')}
                  className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            {renderContent()}
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            YouTube Outlier Discovery Tool
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailChangePage;