import React, { useEffect, useState } from 'react';
import { Github } from 'lucide-react';

interface OAuthProvider {
  enabled: boolean;
  authUrl: string;
  name: string;
}

interface OAuthConfig {
  providers: {
    google: OAuthProvider;
    github: OAuthProvider;
  };
}

interface OAuthButtonsProps {
  isLoading?: boolean;
  disabled?: boolean;
  showDivider?: boolean;
}

// Google icon component (SVG)
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default function OAuthButtons({ isLoading = false, disabled = false, showDivider = true }: OAuthButtonsProps) {
  const [config, setConfig] = useState<OAuthConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/auth/oauth/config');
        if (!response.ok) {
          throw new Error('Failed to fetch OAuth configuration');
        }
        const data = await response.json();
        setConfig(data);
      } catch (error) {
        console.error('Failed to fetch OAuth config:', error);
        setConfigError('Failed to load OAuth configuration');
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleOAuthLogin = (provider: string, authUrl: string) => {
    if (disabled || isLoading) return;
    
    // Store the current page URL for redirect after authentication
    sessionStorage.setItem('oauth_redirect_url', window.location.pathname);
    
    // Redirect to OAuth provider
    window.location.href = authUrl;
  };

  if (configLoading) {
    return (
      <div className="space-y-3">
        {showDivider && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <div className="w-full h-10 bg-gray-200 animate-pulse rounded-md"></div>
          <div className="w-full h-10 bg-gray-200 animate-pulse rounded-md"></div>
        </div>
      </div>
    );
  }

  if (configError || !config) {
    return null; // Don't show OAuth buttons if config failed to load
  }

  const enabledProviders = Object.entries(config.providers).filter(([_, provider]) => provider.enabled);

  if (enabledProviders.length === 0) {
    return null; // Don't show anything if no providers are enabled
  }

  return (
    <div className="space-y-3">
      {showDivider && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {enabledProviders.map(([providerKey, provider]) => {
          const isGoogleProvider = providerKey === 'google';
          const isGithubProvider = providerKey === 'github';
          
          return (
            <button
              key={providerKey}
              type="button"
              onClick={() => handleOAuthLogin(providerKey, provider.authUrl)}
              disabled={disabled || isLoading}
              className={`
                w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium
                ${
                  disabled || isLoading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                }
                transition-colors duration-200
              `}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-3"></div>
              ) : (
                <>
                  {isGoogleProvider && <GoogleIcon />}
                  {isGithubProvider && <Github className="w-5 h-5" />}
                  <span className="ml-3">Continue with {provider.name}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}