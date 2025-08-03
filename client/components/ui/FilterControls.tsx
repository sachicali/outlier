import React, { useState } from 'react';
import { 
  Filter, 
  Search, 
  SortAsc, 
  SortDesc, 
  X,
  Calendar,
  Users,
  Eye,
  BarChart3,
  ChevronDown
} from 'lucide-react';

export interface FilterState {
  search: string;
  sortBy: 'title' | 'channel' | 'views' | 'outlierScore' | 'brandFit' | 'publishedAt';
  sortOrder: 'asc' | 'desc';
  minViews: number;
  maxViews: number;
  minOutlierScore: number;
  maxOutlierScore: number;
  minBrandFit: number;
  maxBrandFit: number;
  dateRange: 'all' | '24h' | '7d' | '30d';
}

interface FilterControlsProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  resultCount: number;
  isVisible: boolean;
  onToggle: () => void;
}

const FilterControls: React.FC<FilterControlsProps> = ({
  filters,
  onFiltersChange,
  resultCount,
  isVisible,
  onToggle
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    onFiltersChange({
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
  };

  const sortOptions = [
    { value: 'outlierScore', label: 'Outlier Score', icon: BarChart3 },
    { value: 'brandFit', label: 'Brand Fit', icon: BarChart3 },
    { value: 'views', label: 'View Count', icon: Eye },
    { value: 'publishedAt', label: 'Publish Date', icon: Calendar },
    { value: 'title', label: 'Title', icon: Search },
    { value: 'channel', label: 'Channel', icon: Users }
  ] as const;

  const dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
  ] as const;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      {/* Filter Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <button
            onClick={onToggle}
            className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
          >
            <Filter className="h-5 w-5" />
            <span className="font-medium">Filters & Sorting</span>
            <span className="text-sm text-gray-500">({resultCount} results)</span>
            <ChevronDown 
              className={`h-4 w-4 transition-transform ${
                isVisible ? 'rotate-180' : ''
              }`} 
            />
          </button>
          
          {(filters.search || filters.sortBy !== 'outlierScore' || filters.sortOrder !== 'desc') && (
            <button
              onClick={resetFilters}
              className="text-sm text-red-600 hover:text-red-800 flex items-center space-x-1"
            >
              <X className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Content */}
      {isVisible && (
        <div className="p-6 space-y-6">
          {/* Search and Sort Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search videos or channels..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value as FilterState['sortBy'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order
              </label>
              <button
                onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                {filters.sortOrder === 'asc' ? (
                  <>
                    <SortAsc className="h-4 w-4" />
                    <span>Ascending</span>
                  </>
                ) : (
                  <>
                    <SortDesc className="h-4 w-4" />
                    <span>Descending</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Advanced Filters Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
            >
              <span>Advanced Filters</span>
              <ChevronDown 
                className={`h-4 w-4 transition-transform ${
                  showAdvanced ? 'rotate-180' : ''
                }`} 
              />
            </button>
          </div>

          {/* Advanced Filters */}
          {showAdvanced && (
            <div className="space-y-6 pt-4 border-t border-gray-200">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {dateRangeOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => updateFilter('dateRange', option.value)}
                      className={`px-3 py-2 text-sm rounded-md border ${
                        filters.dateRange === option.value
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* View Count Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  View Count Range
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <input
                      type="number"
                      placeholder="Min views"
                      value={filters.minViews || ''}
                      onChange={(e) => updateFilter('minViews', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Min: {formatNumber(filters.minViews)}
                    </p>
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Max views"
                      value={filters.maxViews === 10000000 ? '' : filters.maxViews}
                      onChange={(e) => updateFilter('maxViews', parseInt(e.target.value) || 10000000)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Max: {filters.maxViews === 10000000 ? 'Unlimited' : formatNumber(filters.maxViews)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Score Ranges */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Outlier Score Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Outlier Score Range (0-100)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.minOutlierScore}
                      onChange={(e) => updateFilter('minOutlierScore', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Min: {filters.minOutlierScore}</span>
                      <span>Max: {filters.maxOutlierScore}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.maxOutlierScore}
                      onChange={(e) => updateFilter('maxOutlierScore', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Brand Fit Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brand Fit Range (0-10)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={filters.minBrandFit}
                      onChange={(e) => updateFilter('minBrandFit', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Min: {filters.minBrandFit.toFixed(1)}</span>
                      <span>Max: {filters.maxBrandFit.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={filters.maxBrandFit}
                      onChange={(e) => updateFilter('maxBrandFit', parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterControls;