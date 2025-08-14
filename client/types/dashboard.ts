// Dashboard Data Types
export interface DashboardData {
  overview: OverviewData
  analytics: AnalyticsData
  quota: QuotaData
  activities: Activity[]
  performance: PerformanceData
  trends: TrendData
  history: HistoryData
  saved: SavedData
  account: AccountData
}

export interface OverviewData {
  metrics: {
    totalAnalyses: number
    totalOutliers: number
    avgProcessingTime: number
    uniqueChannels: number
    successRate: number
    last30Days: {
      analyses: number
      outliers: number
      channels: number
    }
    previousPeriod: {
      analyses: number
      outliers: number
      channels: number
    }
  }
  quickStats: {
    todayAnalyses: number
    weekAnalyses: number
    monthAnalyses: number
    avgOutliersPerAnalysis: number
  }
}

export interface AnalyticsData {
  usageChart: {
    data: Array<{
      date: string
      analyses: number
      outliers: number
      processing_time: number
    }>
    summary: {
      totalDataPoints: number
      peakDay: string
      averageDaily: number
    }
  }
  channelAnalytics: {
    topChannels: Array<{
      id: string
      name: string
      outlierCount: number
      avgScore: number
      lastAnalyzed: string
    }>
    channelCategories: Array<{
      category: string
      count: number
      percentage: number
    }>
  }
}

export interface QuotaData {
  current: {
    used: number
    limit: number
    remaining: number
    percentage: number
  }
  daily: {
    used: number
    limit: number
    resetTime: string
  }
  monthly: {
    used: number
    limit: number
    resetDate: string
  }
  forecast: {
    projectedDailyUsage: number
    projectedMonthlyUsage: number
    estimatedRemainingDays: number
  }
}

export interface Activity {
  id: string
  type: 'analysis_started' | 'analysis_completed' | 'analysis_failed' | 'outlier_found' | 'channel_favorited' | 'export_generated'
  title: string
  description: string
  timestamp: string
  metadata?: {
    analysisId?: string
    channelId?: string
    outlierCount?: number
    processingTime?: number
  }
  severity: 'info' | 'success' | 'warning' | 'error'
}

export interface PerformanceData {
  metrics: {
    avgProcessingTime: number
    medianProcessingTime: number
    successRate: number
    errorRate: number
    avgOutliersPerAnalysis: number
    avgChannelsPerAnalysis: number
  }
  timeDistribution: Array<{
    timeRange: string
    count: number
    percentage: number
  }>
  errorAnalysis: Array<{
    errorType: string
    count: number
    lastOccurrence: string
  }>
  performanceTrends: Array<{
    date: string
    avgProcessingTime: number
    successRate: number
    outlierRate: number
  }>
}

export interface TrendData {
  outliersOverTime: Array<{
    date: string
    count: number
    avgScore: number
    categories: Array<{
      name: string
      count: number
    }>
  }>
  channelTrends: Array<{
    channelName: string
    trend: 'up' | 'down' | 'stable'
    changePercentage: number
    data: Array<{
      date: string
      outlierCount: number
      avgScore: number
    }>
  }>
  seasonalPatterns: {
    hourlyDistribution: Array<{
      hour: number
      analysisCount: number
      outlierRate: number
    }>
    weeklyDistribution: Array<{
      dayOfWeek: string
      analysisCount: number
      outlierRate: number
    }>
  }
}

export interface HistoryData {
  analyses: Analysis[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    totalAnalyses: number
    completedAnalyses: number
    failedAnalyses: number
    avgProcessingTime: number
  }
}

export interface Analysis {
  id: string
  name?: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  started_at: string
  completed_at?: string
  failed_at?: string
  total_outliers_found?: number
  total_channels_analyzed?: number
  processing_time_ms?: number
  error_message?: string
  configuration?: {
    searchQueries: string[]
    outlierThreshold: number
    brandFitThreshold: number
  }
  results?: {
    outliers: OutlierVideo[]
    channels: AnalyzedChannel[]
    summary: AnalysisSummary
  }
}

export interface OutlierVideo {
  id: string
  title: string
  channelName: string
  channelId: string
  views: number
  subscribers: number
  outlierScore: number
  brandCompatibility: number
  publishedAt: string
  thumbnailUrl: string
  duration: string
  description: string
  tags: string[]
  analysisId: string
  isSaved?: boolean
}

export interface AnalyzedChannel {
  id: string
  name: string
  subscriberCount: number
  videoCount: number
  avgViewCount: number
  outlierVideosFound: number
  avgOutlierScore: number
  brandCompatibility: number
  lastAnalyzed: string
  isFavorited?: boolean
}

export interface AnalysisSummary {
  totalVideosAnalyzed: number
  totalOutliersFound: number
  avgOutlierScore: number
  avgBrandCompatibility: number
  topCategories: Array<{
    category: string
    count: number
  }>
}

export interface SavedData {
  channels: SavedChannel[]
  videos: SavedVideo[]
  collections: SavedCollection[]
  summary: {
    totalChannels: number
    totalVideos: number
    totalCollections: number
  }
}

export interface SavedChannel {
  id: string
  name: string
  subscriberCount: number
  avgOutlierScore: number
  lastAnalyzed: string
  savedAt: string
  notes?: string
  tags: string[]
  analysisCount: number
}

export interface SavedVideo {
  id: string
  title: string
  channelName: string
  channelId: string
  outlierScore: number
  views: number
  publishedAt: string
  savedAt: string
  notes?: string
  tags: string[]
  collection?: string
}

export interface SavedCollection {
  id: string
  name: string
  description?: string
  channelIds: string[]
  videoIds: string[]
  createdAt: string
  updatedAt: string
  isPublic: boolean
}

export interface AccountData {
  apiKeys: ApiKey[]
  notifications: NotificationSettings
  security: SecuritySettings
  usage: UsageStatistics
}

export interface ApiKey {
  id: string
  name: string
  key: string
  permissions: string[]
  usageCount: number
  lastUsed?: string
  createdAt: string
  expiresAt?: string
  isActive: boolean
}

export interface NotificationSettings {
  email: {
    analysisComplete: boolean
    analysisError: boolean
    quotaWarning: boolean
    weeklyReport: boolean
    monthlyReport: boolean
  }
  push: {
    analysisComplete: boolean
    analysisError: boolean
    quotaWarning: boolean
  }
  preferences: {
    quietHours: {
      enabled: boolean
      start: string
      end: string
    }
    frequency: 'immediate' | 'hourly' | 'daily'
  }
}

export interface SecuritySettings {
  twoFactorEnabled: boolean
  lastPasswordChange: string
  activeSessions: Array<{
    id: string
    device: string
    location: string
    lastActivity: string
    isCurrentSession: boolean
  }>
  loginHistory: Array<{
    timestamp: string
    ip: string
    location: string
    success: boolean
    userAgent: string
  }>
}

export interface UsageStatistics {
  currentPlan: string
  billingCycle: 'monthly' | 'yearly'
  nextBillingDate: string
  usageLimits: {
    analysesPerMonth: number
    apiCallsPerDay: number
    storageLimit: number
  }
  currentUsage: {
    analysesThisMonth: number
    apiCallsToday: number
    storageUsed: number
  }
}

// Filter and UI Types
export interface DashboardFilters {
  dateRange: '7' | '30' | '90' | '365' | 'custom'
  customStartDate?: string
  customEndDate?: string
  timezone: 'local' | 'utc'
  compareWith: 'none' | 'previous_period' | 'previous_year'
  status?: 'all' | 'completed' | 'failed' | 'processing'
  searchTerm?: string
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf'
  includeTabs: string[]
  dateRange: DashboardFilters['dateRange']
  customDateRange?: {
    start: string
    end: string
  }
}

export interface ChartDataPoint {
  date: string
  [key: string]: string | number
}

export interface TableColumn {
  key: string
  label: string
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: any, row: any) => React.ReactNode
}

export interface TableProps {
  columns: TableColumn[]
  data: any[]
  loading?: boolean
  searchable?: boolean
  sortable?: boolean
  pagination?: boolean
  pageSize?: number
  onRowClick?: (row: any) => void
  onSort?: (column: string, direction: 'asc' | 'desc') => void
  emptyMessage?: string
}

export interface NotificationItem {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
  actionLabel?: string
}

export interface SystemStatus {
  overall: 'operational' | 'degraded' | 'down'
  services: Array<{
    name: string
    status: 'operational' | 'degraded' | 'down'
    lastChecked: string
    responseTime?: number
  }>
  incidents: Array<{
    id: string
    title: string
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
    severity: 'low' | 'medium' | 'high' | 'critical'
    startedAt: string
    resolvedAt?: string
    description: string
  }>
}