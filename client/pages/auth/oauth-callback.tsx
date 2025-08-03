import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface CallbackState {
  status: 'loading' | 'success' | 'error';
  message: string;
  provider?: string;
  isNewUser?: boolean;
  wasLinked?: boolean;
}

export default function OAuthCallback() {
  const router = useRouter();
  const { setAuthToken, fetchUserProfile } = useAuth();
  const [state, setState] = useState<CallbackState>({
    status: 'loading',
    message: 'Processing authentication...',
  });

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Check for error parameters
        const error = urlParams.get('error');
        const errorMessage = urlParams.get('message');
        
        if (error) {
          setState({
            status: 'error',
            message: errorMessage || 'OAuth authentication failed',
          });
          return;
        }

        // Check for success parameters
        const success = urlParams.get('success');
        const provider = urlParams.get('provider');
        const isNewUser = urlParams.get('isNewUser') === 'true';
        const wasLinked = urlParams.get('wasLinked') === 'true';
        const token = urlParams.get('token');

        if (success === 'true' && token) {
          // Set the authentication token
          setAuthToken(token);
          
          // Fetch user profile to update auth context
          await fetchUserProfile();

          // Determine success message
          let message = 'Authentication successful!';
          if (isNewUser) {
            message = `Welcome! Your account has been created with ${provider}.`;
          } else if (wasLinked) {
            message = `${provider} account has been linked to your existing account.`;
          } else {
            message = `Successfully signed in with ${provider}.`;
          }

          setState({
            status: 'success',
            message,
            provider,
            isNewUser,
            wasLinked,
          });

          // Get redirect URL from session storage or default to home
          const redirectUrl = sessionStorage.getItem('oauth_redirect_url') || '/';
          sessionStorage.removeItem('oauth_redirect_url');

          // Redirect after a short delay
          setTimeout(() => {
            router.replace(redirectUrl);
          }, 2000);
        } else {
          setState({
            status: 'error',
            message: 'Invalid callback parameters',
          });
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        setState({
          status: 'error',
          message: 'An unexpected error occurred during authentication',
        });
      }
    };

    // Only run if we have query parameters
    if (Object.keys(router.query).length > 0 || window.location.search) {
      handleCallback();
    }
  }, [router.query, setAuthToken, fetchUserProfile, router]);

  const renderIcon = () => {
    switch (state.status) {
      case 'loading':
        return <Loader className="w-12 h-12 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-600" />;
      case 'error':
        return <XCircle className="w-12 h-12 text-red-600" />;
      default:
        return <Loader className="w-12 h-12 text-blue-600 animate-spin" />;
    }
  };

  const renderActionButton = () => {
    if (state.status === 'error') {
      return (
        <div className="space-y-3">
          <button
            onClick={() => router.push('/auth/login')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      );
    }

    if (state.status === 'success') {
      return (
        <div className="space-y-3">
          <button
            onClick={() => router.push('/')}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Continue to App
          </button>
          {state.isNewUser && (
            <button
              onClick={() => router.push('/profile')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Complete Profile
            </button>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center">
              {renderIcon()}
            </div>
            
            <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
              {state.status === 'loading' && 'Processing...'}
              {state.status === 'success' && 'Authentication Successful!'}
              {state.status === 'error' && 'Authentication Failed'}
            </h2>
            
            <p className="mt-4 text-center text-sm text-gray-600">
              {state.message}
            </p>

            {state.provider && state.status === 'success' && (
              <div className="mt-4 p-3 bg-green-50 rounded-md">
                <p className="text-sm text-green-800">
                  {state.isNewUser && 'Account created and '}
                  {state.wasLinked && 'Account linked and '}
                  signed in with {state.provider}
                </p>
              </div>
            )}

            {state.status === 'success' && (
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-800">
                  Redirecting you to the app...
                </p>
              </div>
            )}

            <div className="mt-6">
              {renderActionButton()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}