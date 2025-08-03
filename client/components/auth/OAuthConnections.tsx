import React, { useEffect, useState } from 'react';
import { Github, Check, X, Link as LinkIcon, Unlink, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

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

interface OAuthConnection {
  id: string;
  email: string;
  name: string;
  username: string;
  linkedAt: string;
  lastUsed: string;
}

interface OAuthConnectionsData {
  connections: Record<string, OAuthConnection>;
  hasPassword: boolean;
  canUnlinkAll: boolean;
  availableProviders: string[];
}

export default function OAuthConnections() {
  const { authToken } = useAuth();
  const [connections, setConnections] = useState<OAuthConnectionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/auth/oauth/connections', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch OAuth connections');
      }

      const data = await response.json();
      setConnections(data);
    } catch (error) {
      console.error('Failed to fetch OAuth connections:', error);
      setError('Failed to load OAuth connections');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkProvider = async (provider: string) => {
    if (!connections) return;

    // Prevent unlinking if it's the only auth method
    if (!connections.hasPassword && Object.keys(connections.connections).length === 1) {
      setError('Cannot unlink the only authentication method. Please set a password first.');
      return;
    }

    try {
      setUnlinkingProvider(provider);
      setError(null);

      const response = await fetch(`/api/auth/oauth/${provider}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to unlink provider');
      }

      // Refresh connections
      await fetchConnections();
    } catch (error: any) {
      console.error('Failed to unlink provider:', error);
      setError(error.message || 'Failed to unlink provider');
    } finally {
      setUnlinkingProvider(null);
    }
  };

  const handleLinkProvider = (provider: string) => {
    // Store current page for redirect after OAuth
    sessionStorage.setItem('oauth_redirect_url', window.location.pathname);
    
    // Redirect to OAuth provider
    window.location.href = `/api/auth/${provider}`;
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return <GoogleIcon />;
      case 'github':
        return <Github className="w-5 h-5" />;
      default:
        return <LinkIcon className="w-5 h-5" />;
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'google':
        return 'Google';
      case 'github':
        return 'GitHub';
      default:
        return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">OAuth Connections</h3>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="space-y-2">
                  <div className="w-24 h-4 bg-gray-200 animate-pulse rounded"></div>
                  <div className="w-32 h-3 bg-gray-200 animate-pulse rounded"></div>
                </div>
              </div>
              <div className="w-20 h-8 bg-gray-200 animate-pulse rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!connections) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">OAuth Connections</h3>
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load OAuth connections</p>
          <button
            onClick={fetchConnections}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">OAuth Connections</h3>
        <div className="text-sm text-gray-600">
          {Object.keys(connections.connections).length} connected
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {!connections.hasPassword && Object.keys(connections.connections).length === 1 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 mr-2" />
            <div>
              <p className="text-sm text-yellow-800 font-medium">Security Notice</p>
              <p className="text-sm text-yellow-700 mt-1">
                This is your only authentication method. Consider setting a password as a backup.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {connections.availableProviders.map((provider) => {
          const connection = connections.connections[provider];
          const isConnected = !!connection;
          const isUnlinking = unlinkingProvider === provider;

          return (
            <div
              key={provider}
              className={`
                flex items-center justify-between p-4 border rounded-lg transition-colors
                ${isConnected ? 'border-green-200 bg-green-50' : 'border-gray-200'}
              `}
            >
              <div className="flex items-center space-x-3">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${isConnected ? 'bg-green-100' : 'bg-gray-100'}
                `}>
                  {getProviderIcon(provider)}
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900">
                    {getProviderName(provider)}
                  </h4>
                  
                  {isConnected ? (
                    <div className="text-sm text-gray-600">
                      <p>{connection.email}</p>
                      <p className="text-xs">
                        Connected {new Date(connection.linkedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Not connected</p>
                  )}\n                </div>\n              </div>\n\n              <div className=\"flex items-center space-x-2\">\n                {isConnected ? (\n                  <>\n                    <div className=\"flex items-center text-green-600 text-sm mr-3\">\n                      <Check className=\"w-4 h-4 mr-1\" />\n                      Connected\n                    </div>\n                    \n                    <button\n                      onClick={() => handleUnlinkProvider(provider)}\n                      disabled={isUnlinking || (!connections.hasPassword && Object.keys(connections.connections).length === 1)}\n                      className={`\n                        flex items-center px-3 py-1.5 text-sm rounded-md transition-colors\n                        ${\n                          isUnlinking\n                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'\n                            : !connections.hasPassword && Object.keys(connections.connections).length === 1\n                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'\n                            : 'bg-red-100 text-red-700 hover:bg-red-200'\n                        }\n                      `}\n                    >\n                      {isUnlinking ? (\n                        <>\n                          <div className=\"animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400 mr-1\"></div>\n                          Unlinking...\n                        </>\n                      ) : (\n                        <>\n                          <Unlink className=\"w-3 h-3 mr-1\" />\n                          Unlink\n                        </>\n                      )}\n                    </button>\n                  </>\n                ) : (\n                  <button\n                    onClick={() => handleLinkProvider(provider)}\n                    className=\"flex items-center px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors\"\n                  >\n                    <LinkIcon className=\"w-3 h-3 mr-1\" />\n                    Connect\n                  </button>\n                )}\n              </div>\n            </div>\n          );\n        })}\n      </div>\n\n      {Object.keys(connections.connections).length === 0 && (\n        <div className=\"text-center py-8\">\n          <LinkIcon className=\"w-12 h-12 text-gray-400 mx-auto mb-4\" />\n          <h4 className=\"text-lg font-medium text-gray-900 mb-2\">No OAuth Connections</h4>\n          <p className=\"text-gray-600 mb-4\">\n            Connect your social accounts for easier sign-in\n          </p>\n        </div>\n      )}\n\n      <div className=\"mt-6 pt-4 border-t border-gray-200\">\n        <div className=\"text-sm text-gray-600\">\n          <p className=\"mb-2\">\n            <strong>Security:</strong> OAuth connections provide secure authentication without sharing passwords.\n          </p>\n          <p>\n            <strong>Backup:</strong> We recommend having both a password and at least one OAuth connection for account recovery.\n          </p>\n        </div>\n      </div>\n    </div>\n  );\n}