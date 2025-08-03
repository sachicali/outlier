import { useState, useMemo } from 'react';
import { FilterState } from '../components/ui/FilterControls';

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

const useResultsFilter = (results: VideoResult[]) => {
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

  const filteredResults = useMemo(() => {
    let filtered = [...results];

    // Text search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(result => 
        result.snippet.title.toLowerCase().includes(searchLower) ||
        result.channelInfo.snippet.title.toLowerCase().includes(searchLower) ||
        result.snippet.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // View count filter
    filtered = filtered.filter(result => {
      const views = parseInt(result.statistics.viewCount);
      return views >= filters.minViews && views <= filters.maxViews;
    });

    // Outlier score filter
    filtered = filtered.filter(result => 
      result.outlierScore >= filters.minOutlierScore && 
      result.outlierScore <= filters.maxOutlierScore
    );

    // Brand fit filter
    filtered = filtered.filter(result => 
      result.brandFit >= filters.minBrandFit && 
      result.brandFit <= filters.maxBrandFit
    );

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (filters.dateRange) {
        case '24h':
          cutoffDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          cutoffDate.setDate(now.getDate() - 30);
          break;
      }
      
      filtered = filtered.filter(result => 
        new Date(result.snippet.publishedAt) >= cutoffDate
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (filters.sortBy) {
        case 'title':
          aValue = a.snippet.title.toLowerCase();
          bValue = b.snippet.title.toLowerCase();
          break;
        case 'channel':
          aValue = a.channelInfo.snippet.title.toLowerCase();
          bValue = b.channelInfo.snippet.title.toLowerCase();
          break;
        case 'views':
          aValue = parseInt(a.statistics.viewCount);
          bValue = parseInt(b.statistics.viewCount);
          break;
        case 'outlierScore':
          aValue = a.outlierScore;
          bValue = b.outlierScore;
          break;
        case 'brandFit':
          aValue = a.brandFit;
          bValue = b.brandFit;
          break;
        case 'publishedAt':
          aValue = new Date(a.snippet.publishedAt).getTime();
          bValue = new Date(b.snippet.publishedAt).getTime();
          break;
        default:
          aValue = a.outlierScore;
          bValue = b.outlierScore;
      }

      if (filters.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [results, filters]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      filters.sortBy !== 'outlierScore' ||
      filters.sortOrder !== 'desc' ||
      filters.minViews !== 0 ||
      filters.maxViews !== 10000000 ||
      filters.minOutlierScore !== 0 ||
      filters.maxOutlierScore !== 100 ||
      filters.minBrandFit !== 0 ||
      filters.maxBrandFit !== 10 ||
      filters.dateRange !== 'all'
    );
  }, [filters]);

  const resetFilters = () => {
    setFilters({
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

  const updateFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  return {
    filters,
    filteredResults,
    hasActiveFilters,
    updateFilters,
    resetFilters,
    totalCount: results.length,
    filteredCount: filteredResults.length
  };
};

export default useResultsFilter;