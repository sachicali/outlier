import React from 'react';
import { 
  Play, 
  Users, 
  Eye, 
  Clock, 
  ExternalLink,
  Calendar,
  TrendingUp,
  Award
} from 'lucide-react';
import Tooltip from './Tooltip';

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

interface VideoResultCardProps {
  result: VideoResult;
  index: number;
  isMobile?: boolean;
}

const VideoResultCard: React.FC<VideoResultCardProps> = ({ 
  result, 
  index, 
  isMobile = false 
}) => {
  const formatNumber = (num: string | number): string => {
    const n = typeof num === 'string' ? parseInt(num) : num;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getBrandFitColor = (score: number): string => {
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 6) return 'text-blue-600 bg-blue-100';
    if (score >= 4) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Mobile card layout
  if (isMobile) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        {/* Header with rank and scores */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
              #{index + 1}
            </span>
            <Tooltip content="Outlier Score: How much this video outperformed the channel's average">
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                getScoreColor(result.outlierScore)
              }`}>
                {result.outlierScore.toFixed(1)}
              </span>
            </Tooltip>
          </div>
          
          <div className="flex items-center space-x-2">
            <Tooltip content="Brand Fit Score: How well this content aligns with your brand">
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                getBrandFitColor(result.brandFit)
              }`}>
                {result.brandFit.toFixed(1)}/10
              </span>
            </Tooltip>
            <a 
              href={`https://youtube.com/watch?v=${result.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Video thumbnail and title */}
        <div className="flex space-x-3 mb-3">
          <div className="w-24 h-18 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
            <Play className="h-6 w-6 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
              {result.snippet.title}
            </h3>
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(result.snippet.publishedAt)}</span>
              </div>
              {result.snippet.tags?.[0] && (
                <div className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                  {result.snippet.tags[0]}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Channel info and stats */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-1 text-gray-600">
              <Users className="h-3 w-3" />
              <span className="font-medium">{result.channelInfo.snippet.title}</span>
            </div>
            <div className="text-xs text-gray-500">
              {formatNumber(result.channelInfo.statistics.subscriberCount)} subs
            </div>
          </div>
          
          <div className="flex items-center space-x-1 text-sm">
            <Eye className="h-3 w-3 text-gray-500" />
            <span className="font-medium text-gray-900">
              {formatNumber(result.statistics.viewCount)} views
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Desktop table row layout
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-start space-x-3">
          <div className="w-20 h-15 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
            <Play className="h-6 w-6 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start space-x-2">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                  {result.snippet.title}
                </h3>
                <div className="text-sm text-gray-500 flex items-center space-x-2">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(result.snippet.publishedAt)}</span>
                  {result.snippet.tags?.[0] && (
                    <>
                      <span>•</span>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                        {result.snippet.tags[0]}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded flex-shrink-0">
                #{index + 1}
              </span>
            </div>
          </div>
        </div>
      </td>
      
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-gray-900 mb-1">
          {result.channelInfo.snippet.title}
        </div>
        <div className="text-sm text-gray-500 flex items-center space-x-1">
          <Users className="h-3 w-3" />
          <span>{formatNumber(result.channelInfo.statistics.subscriberCount)}</span>
        </div>
      </td>
      
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-gray-900 flex items-center space-x-1">
          <Eye className="h-3 w-3" />
          <span>{formatNumber(result.statistics.viewCount)}</span>
        </div>
      </td>
      
      <td className="px-6 py-4">
        <div className="space-y-2">
          <Tooltip content="Outlier Score: How much this video outperformed the channel's average">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-3 w-3 text-gray-400" />
              <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                getScoreColor(result.outlierScore)
              }`}>
                {result.outlierScore.toFixed(1)}
              </span>
            </div>
          </Tooltip>
          
          <Tooltip content="Brand Fit Score: How well this content aligns with your brand">
            <div className="flex items-center space-x-2">
              <Award className="h-3 w-3 text-gray-400" />
              <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                getBrandFitColor(result.brandFit)
              }`}>
                {result.brandFit.toFixed(1)}/10
              </span>
            </div>
          </Tooltip>
        </div>
      </td>
      
      <td className="px-6 py-4">
        <a 
          href={`https://youtube.com/watch?v=${result.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          <span>Watch</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </td>
    </tr>
  );
};

export default VideoResultCard;