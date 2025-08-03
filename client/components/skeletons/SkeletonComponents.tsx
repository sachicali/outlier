import React from 'react';

// Base skeleton for common elements
export const SkeletonBox: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 1, 
  className = '' 
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }, (_, i) => (
      <div 
        key={i} 
        className={`animate-pulse bg-gray-200 rounded h-4 ${
          i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
        }`} 
      />
    ))}
  </div>
);

// Configuration panel skeleton
export const ConfigurationSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6 space-y-6">
    <SkeletonText className="h-5 w-24" />
    
    {/* Exclusion Channels */}
    <div className="space-y-4">
      <SkeletonText className="h-4 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex items-center space-x-2">
            <SkeletonBox className="flex-1 h-10" />
            <SkeletonBox className="w-6 h-6" />
          </div>
        ))}
        <SkeletonText className="h-4 w-24" />
      </div>
    </div>

    {/* Subscriber Range */}
    <div className="space-y-4">
      <SkeletonText className="h-4 w-28" />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <SkeletonBox className="h-10" />
          <SkeletonText className="h-3 w-16" />
        </div>
        <div className="space-y-1">
          <SkeletonBox className="h-10" />
          <SkeletonText className="h-3 w-16" />
        </div>
      </div>
    </div>

    {/* Sliders */}
    <div className="space-y-6">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonText className="h-4 w-28" />
          <SkeletonBox className="h-6" />
          <div className="flex justify-between">
            <SkeletonText className="h-3 w-8" />
            <SkeletonText className="h-3 w-12" />
            <SkeletonText className="h-3 w-8" />
          </div>
        </div>
      ))}
    </div>

    {/* Start Button */}
    <SkeletonBox className="w-full h-12" />
  </div>
);

// Video result card skeleton
export const VideoResultSkeleton: React.FC = () => (
  <tr className="hover:bg-gray-50">
    <td className="px-6 py-4">
      <div className="flex items-start space-x-3">
        <SkeletonBox className="w-20 h-15" />
        <div className="flex-1 space-y-2">
          <SkeletonText lines={2} className="max-w-md" />
          <div className="flex items-center space-x-2">
            <SkeletonBox className="w-3 h-3" />
            <SkeletonText className="h-3 w-16" />
            <SkeletonText className="h-3 w-1" />
            <SkeletonText className="h-3 w-12" />
          </div>
        </div>
      </div>
    </td>
    <td className="px-6 py-4">
      <div className="space-y-1">
        <SkeletonText className="h-4 w-24" />
        <div className="flex items-center space-x-1">
          <SkeletonBox className="w-3 h-3" />
          <SkeletonText className="h-3 w-12" />
        </div>
      </div>
    </td>
    <td className="px-6 py-4">
      <div className="flex items-center space-x-1">
        <SkeletonBox className="w-3 h-3" />
        <SkeletonText className="h-4 w-16" />
      </div>
    </td>
    <td className="px-6 py-4">
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <SkeletonText className="h-3 w-8" />
          <SkeletonText className="h-4 w-8" />
        </div>
        <div className="flex items-center space-x-2">
          <SkeletonText className="h-3 w-8" />
          <SkeletonText className="h-4 w-12" />
        </div>
      </div>
    </td>
    <td className="px-6 py-4">
      <SkeletonText className="h-4 w-8" />
    </td>
  </tr>
);

// Results table skeleton
export const ResultsTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="bg-white rounded-lg shadow">
    <div className="p-6 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <SkeletonText className="h-6 w-48" />
        <div className="flex items-center space-x-3">
          <SkeletonBox className="w-8 h-8" />
          <SkeletonBox className="w-28 h-10" />
        </div>
      </div>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left">
              <SkeletonText className="h-4 w-12" />
            </th>
            <th className="px-6 py-3 text-left">
              <SkeletonText className="h-4 w-16" />
            </th>
            <th className="px-6 py-3 text-left">
              <SkeletonText className="h-4 w-20" />
            </th>
            <th className="px-6 py-3 text-left">
              <SkeletonText className="h-4 w-12" />
            </th>
            <th className="px-6 py-3 text-left">
              <SkeletonText className="h-4 w-16" />
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {Array.from({ length: rows }, (_, i) => (
            <VideoResultSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Progress skeleton for analysis
export const AnalysisProgressSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6 mb-6">
    <div className="flex items-center space-x-3 mb-4">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300"></div>
      <SkeletonText className="h-6 w-48" />
    </div>
    <SkeletonBox className="w-full h-2 rounded-full mb-2" />
    <SkeletonText className="h-4 w-64" />
  </div>
);

// Exclusion games skeleton
export const ExclusionGamesSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6 mt-6">
    <SkeletonText className="h-6 w-32 mb-3" />
    <div className="space-y-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center space-x-2">
          <SkeletonBox className="w-2 h-2 rounded-full" />
          <SkeletonText className="h-4 w-24" />
        </div>
      ))}
    </div>
  </div>
);

// Main dashboard skeleton
export const DashboardSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gray-50">
    {/* Header Skeleton */}
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <SkeletonBox className="h-8 w-8 rounded" />
            <SkeletonText className="h-8 w-64" />
          </div>
          <SkeletonBox className="w-10 h-10 rounded" />
        </div>
      </div>
    </div>

    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Configuration Panel Skeleton */}
        <div className="lg:col-span-1">
          <ConfigurationSkeleton />
        </div>

        {/* Main Content Skeleton */}
        <div className="lg:col-span-3">
          <ResultsTableSkeleton />
        </div>
      </div>
    </div>
  </div>
);