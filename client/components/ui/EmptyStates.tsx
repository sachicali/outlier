import React from 'react';
import { 
  Search, 
  BarChart3, 
  TrendingUp, 
  Play, 
  Lightbulb, 
  RefreshCw,
  AlertCircle,
  Filter,
  Database,
  Settings
} from 'lucide-react';

interface EmptyStateProps {
  variant: 'initial' | 'no-results' | 'filtered' | 'error' | 'loading';
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  tips?: string[];
}

const EmptyState: React.FC<EmptyStateProps> = ({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  tips
}) => {
  const getVariantConfig = () => {
    switch (variant) {
      case 'initial':
        return {
          icon: BarChart3,
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          defaultTitle: 'Ready to Discover Outliers',
          defaultDescription: 'Configure your analysis parameters and discover high-performing videos from adjacent channels that your audience might love.',
          defaultActionLabel: 'Start Analysis',
          defaultTips: [
            'Start with 2-3 competitor channels for better results',
            'Set realistic subscriber ranges (10K-500K works well)',
            'Use 7-day windows for trending content discovery',
            'Higher outlier thresholds (30+) find more exceptional content'
          ]
        };
      
      case 'no-results':
        return {
          icon: Search,
          iconBg: 'bg-yellow-100',
          iconColor: 'text-yellow-600',
          defaultTitle: 'No Outlier Videos Found',
          defaultDescription: 'We couldn\'t find any videos that meet your criteria. Try adjusting your parameters to discover more content.',
          defaultActionLabel: 'Adjust Parameters',
          defaultSecondaryActionLabel: 'Try Different Channels',
          defaultTips: [
            'Try lowering the outlier threshold',
            'Expand the subscriber range',
            'Increase the time window to 14-30 days',
            'Use different exclusion channels'
          ]
        };
      
      case 'filtered':
        return {
          icon: Filter,
          iconBg: 'bg-purple-100',
          iconColor: 'text-purple-600',
          defaultTitle: 'No Results Match Your Filters',
          defaultDescription: 'All videos have been filtered out by your current search and filter criteria.',
          defaultActionLabel: 'Clear Filters',
          defaultSecondaryActionLabel: 'Adjust Filters',
          defaultTips: [
            'Try broadening your search terms',
            'Adjust view count ranges',
            'Modify score thresholds',
            'Change the date range'
          ]
        };
      
      case 'error':
        return {
          icon: AlertCircle,
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          defaultTitle: 'Analysis Failed',
          defaultDescription: 'We encountered an error while analyzing the data. This could be due to API limits or connectivity issues.',
          defaultActionLabel: 'Try Again',
          defaultSecondaryActionLabel: 'Check Settings',
          defaultTips: [
            'Check your internet connection',
            'Verify exclusion channels exist',
            'Try with fewer channels first',
            'Wait a few minutes and retry'
          ]
        };
      
      case 'loading':
        return {
          icon: RefreshCw,
          iconBg: 'bg-gray-100',
          iconColor: 'text-gray-600',
          defaultTitle: 'Analyzing Data',
          defaultDescription: 'Please wait while we search for outlier videos and calculate performance scores.',
          defaultTips: [
            'This process typically takes 1-3 minutes',
            'We\'re analyzing thousands of videos',
            'Results will appear automatically',
            'You can adjust parameters for the next analysis'
          ]
        };
      
      default:
        return {
          icon: Database,
          iconBg: 'bg-gray-100',
          iconColor: 'text-gray-600',
          defaultTitle: 'No Data Available',
          defaultDescription: 'There\'s nothing to display here yet.',
          defaultActionLabel: 'Get Started'
        };
    }
  };

  const config = getVariantConfig();
  const IconComponent = config.icon;
  const isLoading = variant === 'loading';

  return (
    <div className="bg-white rounded-lg shadow p-8 lg:p-12 text-center max-w-2xl mx-auto">
      {/* Icon */}
      <div className={`w-16 h-16 ${config.iconBg} rounded-full flex items-center justify-center mx-auto mb-6`}>
        <IconComponent 
          className={`w-8 h-8 ${config.iconColor} ${
            isLoading ? 'animate-spin' : ''
          }`} 
        />
      </div>

      {/* Title */}
      <h3 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-3">
        {title || config.defaultTitle}
      </h3>

      {/* Description */}
      <p className="text-gray-600 mb-8 text-base lg:text-lg leading-relaxed">
        {description || config.defaultDescription}
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
        {(actionLabel || config.defaultActionLabel) && onAction && (
          <button
            onClick={onAction}
            disabled={isLoading}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            <Play className="w-4 h-4 mr-2" />
            {actionLabel || config.defaultActionLabel}
          </button>
        )}
        
        {(secondaryActionLabel || config.defaultSecondaryActionLabel) && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            disabled={isLoading}
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Settings className="w-4 h-4 mr-2" />
            {secondaryActionLabel || config.defaultSecondaryActionLabel}
          </button>
        )}
      </div>

      {/* Tips */}
      {(tips || config.defaultTips) && (
        <div className="bg-gray-50 rounded-lg p-6 text-left">
          <div className="flex items-center mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-500 mr-2" />
            <h4 className="text-sm font-medium text-gray-900">
              {variant === 'loading' ? 'What\'s happening?' : 'Pro Tips'}
            </h4>
          </div>
          <ul className="text-sm text-gray-600 space-y-2">
            {(tips || config.defaultTips || []).map((tip, index) => (
              <li key={index} className="flex items-start">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default EmptyState;