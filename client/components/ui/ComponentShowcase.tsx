import React, { useState } from 'react';
import { 
  ConfigurationSkeleton, 
  ResultsTableSkeleton, 
  AnalysisProgressSkeleton, 
  ExclusionGamesSkeleton,
  VideoResultSkeleton
} from '../skeletons/SkeletonComponents';
import FilterControls, { FilterState } from './FilterControls';
import EmptyState from './EmptyStates';
import VideoResultCard from './VideoResultCard';
import Tooltip, { HelpTooltip, InfoTooltip } from './Tooltip';

// Mock data for demonstration
const mockVideoResult = {
  id: 'dQw4w9WgXcQ',
  snippet: {
    title: 'Never Gonna Give You Up - Rick Astley (Official Music Video)',
    publishedAt: '2023-12-01T10:00:00Z',
    tags: ['Music', 'Pop', 'Classic']
  },
  statistics: {
    viewCount: '1234567890'
  },
  channelInfo: {
    snippet: {
      title: 'Rick Astley Official'
    },
    statistics: {
      subscriberCount: '2500000'
    }
  },
  outlierScore: 75.5,
  brandFit: 8.2
};

const ComponentShowcase: React.FC = () => {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    sortBy: 'outlierScore',
    sortOrder: 'desc',
    minViews: 0,
    maxViews: 10000000,
    minOutlierScore: 0,
    maxOutlierScore: 100,
    minBrandFit: 0,
    maxBrandFit: 10,
    dateRange: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Component Showcase</h1>
          <p className="text-gray-600">Testing all UI components for the YouTube Outlier Discovery Tool</p>
        </div>

        {/* Skeleton Components */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800">Loading Skeletons</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">Configuration Skeleton</h3>
              <ConfigurationSkeleton />
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">Exclusion Games Skeleton</h3>
              <ExclusionGamesSkeleton />
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-4">Analysis Progress Skeleton</h3>
            <AnalysisProgressSkeleton />
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-4">Results Table Skeleton</h3>
            <ResultsTableSkeleton rows={3} />
          </div>
        </section>

        {/* Empty States */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800">Empty States</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">Initial State</h3>
              <EmptyState variant="initial" onAction={() => alert('Start Analysis!')} />
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">No Results</h3>
              <EmptyState 
                variant="no-results" 
                onAction={() => alert('Adjust Parameters!')} 
                onSecondaryAction={() => alert('Try Different Channels!')}
              />
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">Filtered Results</h3>
              <EmptyState 
                variant="filtered" 
                onAction={() => alert('Clear Filters!')} 
                onSecondaryAction={() => alert('Adjust Filters!')}
              />
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">Error State</h3>
              <EmptyState 
                variant="error" 
                onAction={() => alert('Try Again!')} 
                onSecondaryAction={() => alert('Check Settings!')}
              />
            </div>
          </div>
        </section>

        {/* Filter Controls */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800">Filter Controls</h2>
          <FilterControls
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={42}
            isVisible={showFilters}
            onToggle={() => setShowFilters(!showFilters)}
          />
        </section>

        {/* Video Result Cards */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800">Video Result Cards</h2>
          
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-4">Mobile Card Layout</h3>
            <div className="max-w-md">
              <VideoResultCard result={mockVideoResult} index={0} isMobile={true} />
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-4">Desktop Table Layout</h3>
            <div className="bg-white rounded-lg shadow overflow-hidden">
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
                  <VideoResultCard result={mockVideoResult} index={0} isMobile={false} />
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Tooltips */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800">Tooltips</h2>
          
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <span>Help Tooltip</span>
              <HelpTooltip content="This is a help tooltip to explain complex features" />
            </div>
            
            <div className="flex items-center space-x-2">
              <span>Info Tooltip</span>
              <InfoTooltip content="This is an info tooltip with additional context" />
            </div>
            
            <Tooltip content="Custom tooltip with different positioning" position="bottom">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                Hover for tooltip
              </button>
            </Tooltip>
          </div>
        </section>

        {/* Responsive Design Test */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800">Responsive Design Test</h2>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="bg-gray-100 p-4 rounded text-center">
                  <div className="h-20 w-full bg-gray-200 rounded mb-2"></div>
                  <p className="text-sm text-gray-600">Responsive Item {i + 1}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ComponentShowcase;