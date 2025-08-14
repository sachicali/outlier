import React, { useState, useEffect } from 'react';
import { Search, Play, Users, Eye, TrendingUp, Clock, BarChart3, Settings, Download, Filter, Menu, X } from 'lucide-react';
import useWebSocket from '../hooks/useWebSocket';
import useResponsive from '../hooks/useResponsive';
import useResultsFilter from '../hooks/useResultsFilter';
import { useError } from '../contexts/ErrorContext';
import { apiClient } from '../utils/apiClient';
import ErrorBoundary from './ErrorBoundary';
import FallbackUI, { AnalysisErrorFallback, ResultsErrorFallback } from './FallbackUI';
import { ConfigurationSkeleton, ResultsTableSkeleton, AnalysisProgressSkeleton, ExclusionGamesSkeleton } from './skeletons/SkeletonComponents';
import FilterControls from './ui/FilterControls';
import EmptyState from './ui/EmptyStates';
import VideoResultCard from './ui/VideoResultCard';
import { HelpTooltip } from './ui/Tooltip';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface AnalysisConfig {
  exclusionChannels: string[];
  minSubs: number;
  maxSubs: number;
  timeWindow: number;
  outlierThreshold: number;
}

interface VideoResult {
  id: string;
  snippet: {
    title: string;
    publishedAt: string;
    tags?: string[];
  };
  statistics: {
    viewCount: string;
  };
  channelInfo: {
    snippet: {
      title: string;
    };
    statistics: {
      subscriberCount: string;
    };
  };
  outlierScore: number;
  brandFit: number;
}

// Utility functions
const formatNumber = (num: string | number): string => {
  const n = typeof num === 'string' ? parseInt(num) : num;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
};

const YouTubeOutlierApp: React.FC = () => {
  const [exclusionChannels, setExclusionChannels] = useState<string[]>(['Thinknoodles', 'LankyBox']);
  const [minSubs, setMinSubs] = useState<number>(50000);
  const [maxSubs, setMaxSubs] = useState<number>(500000);
  const [timeWindow, setTimeWindow] = useState<number>(7);
  const [outlierThreshold, setOutlierThreshold] = useState<number>(30);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [results, setResults] = useState<VideoResult[]>([]);
  const [exclusionGames, setExclusionGames] = useState<string[]>([]);
  const [analysisId, setAnalysisId] = useState<string>('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  // Error handling hooks
  const { addError } = useError();
  
  // Responsive design hook
  const { isMobile, isTablet } = useResponsive();
  
  // Results filtering and sorting
  const {
    filters,
    filteredResults,
    hasActiveFilters,
    updateFilters,
    resetFilters,
    totalCount,
    filteredCount
  } = useResultsFilter(results);

  // WebSocket with reconnection handling
  const { socket, isConnected, isReconnecting, emit, on, off } = useWebSocket({
    autoConnect: true,
    reconnectAttempts: 5,
    reconnectDelay: 2000
  });

  const processingSteps = [
    'Initializing analysis...',
    'Searching for channels...',
    'Fetching channel data...',
    'Analyzing videos...',
    'Calculating outlier scores...',
    'Generating results...'
  ];

  // WebSocket event handlers
  // Handle initial load state
  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoad(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!analysisId) return;

    const handleProgress = (data: any) => {
      setCurrentStep(data.step);
      setProgress(data.progress);
      setAnalysisError(null); // Clear any previous errors
      
      if (data.data?.exclusionGames) {
        setExclusionGames(data.data.exclusionGames);
      }
    };

    const handleComplete = (data: any) => {
      setResults(data.results);
      setIsProcessing(false);
      setProgress(100);
      setAnalysisError(null);
      setResultsError(null);
    };

    const handleError = (data: any) => {
      console.error('Analysis error:', data.error);
      setIsProcessing(false);
      setAnalysisError(data.error || 'Analysis failed');
      
      addError(data.error || 'Analysis failed unexpectedly', 'error');
    };

    const handleDisconnect = () => {
      if (isProcessing) {
        setAnalysisError('Connection lost during analysis');
        addError('Real-time connection lost. Analysis may be incomplete.', 'warning');
      }
    };

    // Join analysis room
    if (isConnected) {
      emit('join-analysis', analysisId);
    }

    // Set up event listeners
    on('progress', handleProgress);
    on('complete', handleComplete);
    on('error', handleError);
    on('disconnect', handleDisconnect);

    return () => {
      off('progress', handleProgress);
      off('complete', handleComplete);
      off('error', handleError);
      off('disconnect', handleDisconnect);
    };
  }, [analysisId, isConnected, isProcessing, emit, on, off, addError]);

  const startAnalysis = async () => {
    setIsProcessing(true);
    setCurrentStep(0);
    setProgress(0);
    setResults([]);
    setExclusionGames([]);
    setAnalysisError(null);
    setResultsError(null);
    
    const config: AnalysisConfig = {
      exclusionChannels,
      minSubs,
      maxSubs,
      timeWindow,
      outlierThreshold
    };

    try {
      const response = await apiClient.post('/api/outlier/start', config);
      setAnalysisId(response.data.analysisId);
    } catch (error: any) {
      console.error('Failed to start analysis:', error);
      setIsProcessing(false);
      setAnalysisError('Failed to start analysis');
      addError(error instanceof Error ? error.message : 'An error occurred', 'error');
    }
  };

  const retryAnalysis = () => {
    setAnalysisError(null);
    startAnalysis();
  };

  const exportResults = async () => {
    if (!analysisId) return;
    
    try {
      await apiClient.download(`/api/outlier/export/${analysisId}`, {
        filename: `youtube-outliers-${analysisId}.csv`
      });
      
      addError('Results exported successfully', 'info');
    } catch (error: any) {
      console.error('Failed to export results:', error);
      addError(error instanceof Error ? error.message : 'An error occurred', 'error');
    }
  };

  const retryLoadResults = async () => {
    if (!analysisId) return;
    
    setResultsError(null);
    try {
      const response = await apiClient.get(`/api/outlier/results/${analysisId}`);
      setResults(response.data.results || []);
    } catch (error: any) {
      setResultsError('Failed to load results');
      addError(error instanceof Error ? error.message : 'An error occurred', 'error');
    }
  };

  const formatNumber = (num: string | number) => {
    const n = typeof num === 'string' ? parseInt(num) : num;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  const getScoreColor = (score: number) => {
    if (score > 40) return 'text-red-600';
    if (score > 30) return 'text-orange-600';
    return 'text-green-600';
  };

  const renderApp = () => {
    // Show initial loading skeleton
    if (isInitialLoad) {
      return (
        <div className="min-h-screen bg-gray-50">
          {/* Header Skeleton */}
          <div className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                  <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="h-10 w-10 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1">
                <ConfigurationSkeleton />
              </div>
              <div className="lg:col-span-3">
                <EmptyState 
                  variant="initial"
                  onAction={() => setIsInitialLoad(false)}
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-8 w-8 text-red-600" />
              <h1 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-gray-900`}>
                YouTube Outlier Discovery
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              {isMobile && (
                <button 
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-2 text-gray-600 hover:text-gray-900 lg:hidden"
                >
                  {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              )}
              <button className="p-2 text-gray-600 hover:text-gray-900 hidden lg:block">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className={`grid gap-6 ${
          isMobile 
            ? 'grid-cols-1' 
            : 'grid-cols-1 lg:grid-cols-4'
        }`}>
          
          {/* Mobile Configuration Panel */}
          {isMobile && showMobileMenu && (
            <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 lg:hidden">
              <div className="fixed inset-y-0 left-0 flex flex-col w-full max-w-sm bg-white shadow-xl">
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>
                  <button 
                    onClick={() => setShowMobileMenu(false)}
                    className="p-2 text-gray-600 hover:text-gray-900"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {/* Mobile Configuration Content */}
                  <ConfigurationPanel />
                </div>
              </div>
            </div>
          )}
          
          {/* Desktop Configuration Panel */}
          <div className={`${isMobile ? 'hidden' : 'lg:col-span-1'}`}>
            <ConfigurationPanel />

            {/* Exclusion Games */}
            {exclusionGames.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <div className="flex items-center space-x-2 mb-3">
                  <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900`}>
                    Excluded Games
                  </h3>
                  <HelpTooltip content="Games that have been identified and excluded from the analysis to avoid oversaturated content" />
                </div>
                <div className="space-y-2">
                  {exclusionGames.map((game, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                      <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-700`}>{game}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className={`${isMobile ? 'col-span-1' : 'lg:col-span-3'}`}>
            
            {/* Processing Status */}
            {isProcessing && !analysisError && (
              <ErrorBoundary level="component">
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                    <div className="flex-1">
                      <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900`}>
                        {processingSteps[currentStep]}
                      </h3>
                      {!isConnected && (
                        <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded mt-1 inline-block">
                          {isReconnecting ? 'Reconnecting...' : 'Disconnected'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className={`mt-2 ${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>
                    Step {currentStep + 1} of {processingSteps.length} • {Math.round(progress)}% complete
                  </div>
                </div>
              </ErrorBoundary>
            )}

            {/* Analysis Error */}
            {analysisError && (
              <AnalysisErrorFallback onRetry={retryAnalysis} />
            )}

            {/* Filter Controls */}
            {results.length > 0 && !resultsError && (
              <FilterControls
                filters={filters}
                onFiltersChange={updateFilters}
                resultCount={filteredCount}
                isVisible={showFilters}
                onToggle={() => setShowFilters(!showFilters)}
              />
            )}

            {/* Results */}
            {results.length > 0 && !resultsError && (
              <ErrorBoundary level="component">
                {filteredResults.length === 0 ? (
                  <EmptyState
                    variant="filtered"
                    onAction={resetFilters}
                    onSecondaryAction={() => setShowFilters(true)}
                  />
                ) : (
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200">
                      <div className={`flex items-center justify-between ${
                        isMobile ? 'flex-col space-y-3' : 'flex-row'
                      }`}>
                        <div>
                          <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900`}>
                            Outlier Videos
                          </h3>
                          <p className="text-sm text-gray-500">
                            {filteredCount} of {totalCount} videos
                            {hasActiveFilters && ' (filtered)'}
                          </p>
                        </div>
                        <div className={`flex items-center space-x-3 ${
                          isMobile ? 'w-full justify-between' : ''
                        }`}>
                          {!isMobile && (
                            <button 
                              onClick={() => setShowFilters(!showFilters)}
                              className={`p-2 rounded-md ${
                                showFilters 
                                  ? 'text-red-600 bg-red-100' 
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              <Filter className="h-4 w-4" />
                            </button>
                          )}
                          <button 
                            onClick={exportResults}
                            className={`flex items-center space-x-2 bg-green-600 text-white rounded-md hover:bg-green-700 ${
                              isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2'
                            }`}
                          >
                            <Download className="h-4 w-4" />
                            <span>{isMobile ? 'Export' : 'Export CSV'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Card Layout */}
                    {isMobile ? (
                      <div className="p-4 space-y-4">
                        {filteredResults.map((result, index) => (
                          <VideoResultCard 
                            key={`${result.id}-${index}`} 
                            result={result} 
                            index={index} 
                            isMobile={true}
                          />
                        ))}
                      </div>
                    ) : (
                      /* Desktop Table Layout */
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Video
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Channel
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Performance
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Scores
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredResults.map((result, index) => (
                              <VideoResultCard 
                                key={`${result.id}-${index}`} 
                                result={result} 
                                index={index} 
                                isMobile={false}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </ErrorBoundary>
            )}

            {/* Results Error */}
            {resultsError && (
              <ResultsErrorFallback onRetry={retryLoadResults} />
            )}

            {/* Empty State */}
            {!isProcessing && results.length === 0 && !analysisError && !resultsError && (
              <ErrorBoundary level="component">
                <EmptyState 
                  variant="initial"
                  onAction={startAnalysis}
                  onSecondaryAction={() => isMobile && setShowMobileMenu(true)}
                  secondaryActionLabel={isMobile ? "Configure" : undefined}
                />
              </ErrorBoundary>
            )}
          </div>
        </div>
      </div>
    </div>
    );
  };
  // Configuration Panel Component
  const ConfigurationPanel = () => (
    <ErrorBoundary level="component">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-2 mb-4">
          <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900`}>
            Configuration
          </h2>
          <HelpTooltip content="Configure your analysis parameters to discover outlier videos from adjacent channels" />
        </div>
        
        {/* Exclusion Channels */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Exclusion Channels
            </label>
            <HelpTooltip content="Channels to exclude from analysis. These are typically your direct competitors whose content games you want to avoid." />
          </div>
          <div className="space-y-2">
            {exclusionChannels.map((channel, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={channel}
                  onChange={(e) => {
                    const newChannels = [...exclusionChannels];
                    newChannels[index] = e.target.value;
                    setExclusionChannels(newChannels);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Channel name"
                  disabled={isProcessing}
                />
                {exclusionChannels.length > 1 && (
                  <button 
                    onClick={() => {
                      const newChannels = exclusionChannels.filter((_, i) => i !== index);
                      setExclusionChannels(newChannels);
                    }}
                    className="text-red-600 hover:text-red-800 p-1"
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button 
              onClick={() => setExclusionChannels([...exclusionChannels, ''])}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              disabled={isProcessing}
            >
              + Add Channel
            </button>
          </div>
        </div>

        {/* Subscriber Range */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Subscriber Range
            </label>
            <HelpTooltip content="Target channels within this subscriber range. Smaller channels (10K-500K) often produce more discoverable content." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                type="number"
                value={minSubs}
                onChange={(e) => setMinSubs(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Min"
                disabled={isProcessing}
              />
              <span className="text-xs text-gray-500">Min Subs</span>
            </div>
            <div>
              <input
                type="number"
                value={maxSubs}
                onChange={(e) => setMaxSubs(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Max"
                disabled={isProcessing}
              />
              <span className="text-xs text-gray-500">Max Subs</span>
            </div>
          </div>
        </div>

        {/* Time Window */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Time Window ({timeWindow} days)
            </label>
            <HelpTooltip content="Analyze videos published within this time window. Shorter windows (7 days) capture trending content, longer windows (30 days) provide more comprehensive results." />
          </div>
          <input
            type="range"
            min="1"
            max="30"
            value={timeWindow}
            onChange={(e) => setTimeWindow(parseInt(e.target.value))}
            className="w-full accent-red-600"
            disabled={isProcessing}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1 day</span>
            <span className="font-medium">{timeWindow} days</span>
            <span>30 days</span>
          </div>
        </div>

        {/* Outlier Threshold */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Outlier Threshold ({outlierThreshold})
            </label>
            <HelpTooltip content="Minimum outlier score required. Higher values (30+) find more exceptional content, lower values (10-20) find more opportunities." />
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={outlierThreshold}
            onChange={(e) => setOutlierThreshold(parseInt(e.target.value))}
            className="w-full accent-red-600"
            disabled={isProcessing}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>10</span>
            <span className="font-medium">{outlierThreshold}</span>
            <span>100</span>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={startAnalysis}
          disabled={isProcessing || exclusionChannels.filter(c => c.trim()).length === 0}
          className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>Discover Outliers</span>
            </>
          )}
        </button>
        
        {exclusionChannels.filter(c => c.trim()).length === 0 && (
          <p className="text-xs text-red-600 mt-2">
            Please add at least one exclusion channel to start the analysis.
          </p>
        )}
      </div>
    </ErrorBoundary>
  );

  return renderApp();
};

export default YouTubeOutlierApp;
