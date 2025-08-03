import React from 'react';
import { 
  AlertTriangle, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Cloud, 
  Database, 
  Settings, 
  Home,
  Search,
  BarChart3,
  Clock,
  TrendingUp
} from 'lucide-react';

interface FallbackUIProps {
  type: 'network' | 'server' | 'data' | 'loading' | 'empty' | 'offline' | 'maintenance';
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  retryable?: boolean;
  showDetails?: boolean;
  correlationId?: string;
}

export function NetworkErrorFallback({ onRetry, correlationId }: { onRetry?: () => void; correlationId?: string }) {
  return (
    <div className="min-h-96 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
        <WifiOff className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        Connection Problem
      </h3>
      <p className="text-gray-600 mb-6 max-w-md">
        We're having trouble connecting to our servers. Please check your internet connection and try again.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reload Page
        </button>
      </div>
      {correlationId && (
        <p className="mt-4 text-xs text-gray-400 font-mono">
          Reference ID: {correlationId}
        </p>
      )}
    </div>
  );
}

export function ServerErrorFallback({ onRetry, correlationId }: { onRetry?: () => void; correlationId?: string }) {
  return (
    <div className="min-h-96 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
        <Cloud className="w-8 h-8 text-yellow-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        Server Unavailable
      </h3>
      <p className="text-gray-600 mb-6 max-w-md">
        Our servers are temporarily unavailable. We're working to fix this issue. Please try again in a few moments.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        )}
      </div>
      {correlationId && (
        <p className="mt-4 text-xs text-gray-400 font-mono">
          Reference ID: {correlationId}
        </p>
      )}
    </div>
  );
}

export function DataErrorFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="min-h-96 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
        <Database className="w-8 h-8 text-blue-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        Unable to Load Data
      </h3>
      <p className="text-gray-600 mb-6 max-w-md">
        We couldn't load the requested data. This might be temporary.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </button>
      )}
    </div>
  );
}

export function LoadingFallback({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-96 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {message}
      </h3>
      <p className="text-gray-600">
        Please wait while we fetch your data...
      </p>
    </div>
  );
}

export function EmptyStateFallback({ 
  title = "No Data Available", 
  message = "There's nothing to show here yet.",
  actionLabel,
  onAction
}: { 
  title?: string; 
  message?: string; 
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="min-h-96 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <Search className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {title}
      </h3>
      <p className="text-gray-600 mb-6 max-w-md">
        {message}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function OfflineFallback() {
  return (
    <div className="min-h-96 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <WifiOff className="w-8 h-8 text-gray-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        You're Offline
      </h3>
      <p className="text-gray-600 mb-6 max-w-md">
        It looks like you've lost your internet connection. Please check your connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Try Again
      </button>
    </div>
  );
}

export function MaintenanceFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Settings className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Scheduled Maintenance
          </h2>
          <p className="text-gray-600 mb-6">
            We're currently performing scheduled maintenance to improve your experience. 
            We'll be back shortly.
          </p>
          <div className="bg-blue-50 rounded-md p-4">
            <p className="text-sm text-blue-800">
              Follow us on social media for updates, or check back in a few minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main fallback component that chooses the right UI based on type
export default function FallbackUI({ 
  type, 
  title, 
  message, 
  onRetry, 
  onGoHome, 
  retryable = true,
  correlationId 
}: FallbackUIProps) {
  switch (type) {
    case 'network':
      return <NetworkErrorFallback onRetry={retryable ? onRetry : undefined} correlationId={correlationId} />;
    
    case 'server':
      return <ServerErrorFallback onRetry={retryable ? onRetry : undefined} correlationId={correlationId} />;
    
    case 'data':
      return <DataErrorFallback onRetry={retryable ? onRetry : undefined} />;
    
    case 'loading':
      return <LoadingFallback message={message} />;
    
    case 'empty':
      return <EmptyStateFallback title={title} message={message} />;
    
    case 'offline':
      return <OfflineFallback />;
    
    case 'maintenance':
      return <MaintenanceFallback />;
    
    default:
      return (
        <div className="min-h-96 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {title || 'Something went wrong'}
          </h3>
          <p className="text-gray-600 mb-6 max-w-md">
            {message || 'An unexpected error occurred. Please try again.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {retryable && onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>
            )}
            {onGoHome && (
              <button
                onClick={onGoHome}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </button>
            )}
          </div>
        </div>
      );
  }
}

// Specialized fallbacks for specific app sections
export function AnalysisErrorFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="bg-white rounded-lg shadow p-8 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <BarChart3 className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Analysis Failed
      </h3>
      <p className="text-gray-600 mb-6">
        We encountered an error while analyzing the data. This could be due to API limits or server issues.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Analysis
        </button>
      )}
    </div>
  );
}

export function ResultsErrorFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="bg-white rounded-lg shadow p-8 text-center">
      <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <TrendingUp className="w-8 h-8 text-yellow-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Results Unavailable
      </h3>
      <p className="text-gray-600 mb-6">
        We couldn't load the analysis results. The data might be processing or temporarily unavailable.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reload Results
        </button>
      )}
    </div>
  );
}