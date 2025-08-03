/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, mock, jest } from 'bun:test';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import YouTubeOutlierApp from './YouTubeOutlierApp';
import { OutlierResultFactory, SocketEventFactory } from '../../test/factories/testDataFactory';

// Mock axios
jest.mock('axios', () => ({
  post: mock(() => Promise.resolve({ data: { analysisId: 'test-id' } })),
  get: mock(() => Promise.resolve({ data: 'csv,data' }))
}));

// Mock socket.io
const mockSocket = {
  emit: mock(() => {}),
  on: mock(() => {}),
  off: mock(() => {}),
  close: mock(() => {})
};

jest.mock('socket.io-client', () => ({
  io: mock(() => mockSocket)
}));

// Mock URL.createObjectURL and revokeObjectURL
Object.defineProperty(global.URL, 'createObjectURL', {
  writable: true,
  value: mock(() => 'blob:mock-url')
});

Object.defineProperty(global.URL, 'revokeObjectURL', {
  writable: true,
  value: mock(() => {})
});

// Mock document.createElement for download functionality
const mockAnchorElement = {
  href: '',
  download: '',
  click: mock(() => {})
};

Object.defineProperty(document, 'createElement', {
  writable: true,
  value: mock((tagName: string) => {
    if (tagName === 'a') {
      return mockAnchorElement;
    }
    return {};
  })
});

describe('YouTubeOutlierApp', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockSocket.emit.mockReset();
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.close.mockReset();
    (axios.post as any).mockReset();
    (axios.get as any).mockReset();
  });

  describe('Initial Render', () => {
    it('should render the main app structure', () => {
      render(<YouTubeOutlierApp />);
      
      expect(screen.getByText('YouTube Outlier Discovery')).toBeInTheDocument();
      expect(screen.getByText('Configuration')).toBeInTheDocument();
      expect(screen.getByText('Ready to Discover Outliers')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /discover outliers/i })).toBeInTheDocument();
    });

    it('should initialize socket connection', () => {
      render(<YouTubeOutlierApp />);
      
      expect(io).toHaveBeenCalledWith(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
    });

    it('should display default configuration values', () => {
      render(<YouTubeOutlierApp />);
      
      // Check default values are displayed
      expect(screen.getByDisplayValue('50000')).toBeInTheDocument(); // minSubs
      expect(screen.getByDisplayValue('500000')).toBeInTheDocument(); // maxSubs
      expect(screen.getByText('7 days')).toBeInTheDocument(); // timeWindow
      expect(screen.getByText('30')).toBeInTheDocument(); // outlierThreshold
    });
  });

  describe('Configuration Panel', () => {
    it('should add and remove exclusion channels', async () => {
      const user = userEvent.setup();
      render(<YouTubeOutlierApp />);
      
      // Add a channel
      const addButton = screen.getByText('+ Add Channel');
      await user.click(addButton);
      
      // Should have multiple channel inputs now
      const channelInputs = screen.getAllByRole('textbox', { name: '' });
      expect(channelInputs.length).toBeGreaterThan(0);
    });

    it('should update subscriber range values', async () => {
      const user = userEvent.setup();
      render(<YouTubeOutlierApp />);
      
      const minSubsInput = screen.getByDisplayValue('50000');
      await user.clear(minSubsInput);
      await user.type(minSubsInput, '25000');
      
      expect(screen.getByDisplayValue('25000')).toBeInTheDocument();
    });

    it('should update time window slider', async () => {
      const user = userEvent.setup();
      render(<YouTubeOutlierApp />);
      
      const timeWindowSlider = screen.getByRole('slider', { name: /time window/i });
      fireEvent.change(timeWindowSlider, { target: { value: '14' } });
      
      expect(screen.getByText('14 days')).toBeInTheDocument();
    });

    it('should update outlier threshold slider', async () => {
      const user = userEvent.setup();
      render(<YouTubeOutlierApp />);
      
      const outlierSlider = screen.getByRole('slider', { name: /outlier threshold/i });
      fireEvent.change(outlierSlider, { target: { value: '50' } });
      
      expect(screen.getByText('50')).toBeInTheDocument();
    });
  });

  describe('Analysis Workflow', () => {
    it('should start analysis when button is clicked', async () => {
      const user = userEvent.setup();
      (axios.post as any).mockResolvedValue({ data: { analysisId: 'test-analysis-id' } });
      
      render(<YouTubeOutlierApp />);
      
      const startButton = screen.getByRole('button', { name: /discover outliers/i });
      await user.click(startButton);
      
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3001/api/outlier/start',
        expect.objectContaining({
          exclusionChannels: expect.any(Array),
          minSubs: expect.any(Number),
          maxSubs: expect.any(Number),
          timeWindow: expect.any(Number),
          outlierThreshold: expect.any(Number)
        })
      );
    });

    it('should show processing state during analysis', async () => {
      const user = userEvent.setup();
      (axios.post as any).mockResolvedValue({ data: { analysisId: 'test-analysis-id' } });
      
      render(<YouTubeOutlierApp />);
      
      const startButton = screen.getByRole('button', { name: /discover outliers/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });
      
      expect(startButton).toBeDisabled();
    });

    it('should join analysis room when analysis starts', async () => {
      const user = userEvent.setup();
      (axios.post as any).mockResolvedValue({ data: { analysisId: 'test-analysis-id' } });
      
      render(<YouTubeOutlierApp />);
      
      const startButton = screen.getByRole('button', { name: /discover outliers/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('join-analysis', 'test-analysis-id');
      });
    });

    it('should handle analysis progress updates', async () => {
      const user = userEvent.setup();
      (axios.post as any).mockResolvedValue({ data: { analysisId: 'test-analysis-id' } });
      
      render(<YouTubeOutlierApp />);
      
      const startButton = screen.getByRole('button', { name: /discover outliers/i });
      await user.click(startButton);
      
      // Simulate progress event
      const progressHandler = mockSocket.on.mock.calls.find(call => call[0] === 'progress')?.[1];
      if (progressHandler) {
        act(() => {
          progressHandler(SocketEventFactory.createProgressEvent(2, 75));
        });
      }
      
      await waitFor(() => {
        expect(screen.getByText(/75% complete/i)).toBeInTheDocument();
      });
    });

    it('should handle analysis completion', async () => {
      const user = userEvent.setup();
      const mockResults = OutlierResultFactory.createBatch(3);
      (axios.post as any).mockResolvedValue({ data: { analysisId: 'test-analysis-id' } });
      
      render(<YouTubeOutlierApp />);
      
      const startButton = screen.getByRole('button', { name: /discover outliers/i });
      await user.click(startButton);
      
      // Simulate completion event
      const completeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'complete')?.[1];
      if (completeHandler) {
        act(() => {
          completeHandler(SocketEventFactory.createCompleteEvent(mockResults));
        });
      }
      
      await waitFor(() => {
        expect(screen.getByText(/outlier videos \(3 found\)/i)).toBeInTheDocument();
      });
      
      // Should show results table
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should handle analysis errors', async () => {
      const user = userEvent.setup();
      (axios.post as any).mockResolvedValue({ data: { analysisId: 'test-analysis-id' } });
      
      render(<YouTubeOutlierApp />);
      
      const startButton = screen.getByRole('button', { name: /discover outliers/i });
      await user.click(startButton);
      
      // Simulate error event
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')?.[1];
      if (errorHandler) {
        act(() => {
          errorHandler(SocketEventFactory.createErrorEvent('Analysis failed'));
        });
      }
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /discover outliers/i })).not.toBeDisabled();
      });
    });
  });

  describe('Results Display', () => {
    const setupWithResults = async () => {
      const user = userEvent.setup();
      const mockResults = OutlierResultFactory.createBatch(5);
      (axios.post as any).mockResolvedValue({ data: { analysisId: 'test-analysis-id' } });
      
      render(<YouTubeOutlierApp />);
      
      const startButton = screen.getByRole('button', { name: /discover outliers/i });
      await user.click(startButton);
      
      const completeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'complete')?.[1];
      if (completeHandler) {
        act(() => {
          completeHandler(SocketEventFactory.createCompleteEvent(mockResults));
        });
      }
      
      return { user, mockResults };
    };

    it('should display results table with correct data', async () => {
      await setupWithResults();
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
      
      // Check table headers
      expect(screen.getByText('Video')).toBeInTheDocument();
      expect(screen.getByText('Channel')).toBeInTheDocument();
      expect(screen.getByText('Performance')).toBeInTheDocument();
      expect(screen.getByText('Scores')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should display video information correctly', async () => {
      await setupWithResults();
      
      await waitFor(() => {
        // Should display video titles and view counts
        expect(screen.getAllByText(/view/i).length).toBeGreaterThan(0);
      });
    });

    it('should format numbers correctly', async () => {
      await setupWithResults();
      
      await waitFor(() => {
        // Should format large numbers with K/M suffixes
        const viewCounts = screen.getAllByText(/\d+(\.\d+)?[KM]/);
        expect(viewCounts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Export Functionality', () => {
    const setupWithResultsAndExport = async () => {
      const { user } = await setupWithResults();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
      });
      
      return { user };
    };

    it('should export results as CSV', async () => {
      const { user } = await setupWithResultsAndExport();
      (axios.get as any).mockResolvedValue({ data: 'csv,data\ntest,values' });
      
      const exportButton = screen.getByRole('button', { name: /export csv/i });
      await user.click(exportButton);
      
      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:3001/api/outlier/export/test-analysis-id',
        { responseType: 'blob' }
      );
    });

    it('should handle export errors gracefully', async () => {
      const { user } = await setupWithResultsAndExport();
      (axios.get as any).mockRejectedValue(new Error('Export failed'));
      
      const exportButton = screen.getByRole('button', { name: /export csv/i });
      await user.click(exportButton);
      
      // Should not crash the application
      expect(exportButton).toBeInTheDocument();
    });
  });

  describe('Exclusion Games Display', () => {
    it('should display exclusion games when provided', async () => {
      const user = userEvent.setup();
      (axios.post as any).mockResolvedValue({ data: { analysisId: 'test-analysis-id' } });
      
      render(<YouTubeOutlierApp />);
      
      const startButton = screen.getByRole('button', { name: /discover outliers/i });
      await user.click(startButton);
      
      // Simulate progress event with exclusion games
      const progressHandler = mockSocket.on.mock.calls.find(call => call[0] === 'progress')?.[1];
      if (progressHandler) {
        act(() => {
          progressHandler({
            step: 0,
            progress: 100,
            data: { exclusionGames: ['doors', 'piggy', 'brookhaven'] }
          });
        });
      }
      
      await waitFor(() => {
        expect(screen.getByText('Excluded Games')).toBeInTheDocument();
        expect(screen.getByText('doors')).toBeInTheDocument();
        expect(screen.getByText('piggy')).toBeInTheDocument();
        expect(screen.getByText('brookhaven')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should handle different screen sizes', () => {
      render(<YouTubeOutlierApp />);
      
      // Check for responsive classes
      const mainContainer = screen.getByText('YouTube Outlier Discovery').closest('div');
      expect(mainContainer).toHaveClass('max-w-7xl');
    });

    it('should display grid layout properly', () => {
      render(<YouTubeOutlierApp />);
      
      const gridContainer = screen.getByText('Configuration').closest('.grid');
      expect(gridContainer).toHaveClass('grid-cols-1', 'lg:grid-cols-4');
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<YouTubeOutlierApp />);
      
      expect(screen.getByLabelText(/exclusion channels/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/subscriber range/i)).toBeInTheDocument(); 
      expect(screen.getByLabelText(/time window/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/outlier threshold/i)).toBeInTheDocument();
    });

    it('should have proper button accessibility', () => {
      render(<YouTubeOutlierApp />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      // Primary action button should be clearly labeled
      expect(screen.getByRole('button', { name: /discover outliers/i })).toBeInTheDocument();
    });

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<YouTubeOutlierApp />);
      
      // Should be able to tab through form elements
      await user.tab();
      expect(document.activeElement).toBeInstanceOf(HTMLElement);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during analysis start', async () => {
      const user = userEvent.setup();
      (axios.post as any).mockRejectedValue(new Error('Network error'));
      
      render(<YouTubeOutlierApp />);
      
      const startButton = screen.getByRole('button', { name: /discover outliers/i });
      await user.click(startButton);
      
      await waitFor(() => {
        // Should reset processing state on error
        expect(startButton).not.toBeDisabled();
      });
    });

    it('should handle malformed socket data', async () => {
      const user = userEvent.setup();
      (axios.post as any).mockResolvedValue({ data: { analysisId: 'test-analysis-id' } });
      
      render(<YouTubeOutlierApp />);
      
      const startButton = screen.getByRole('button', { name: /discover outliers/i });
      await user.click(startButton);
      
      // Simulate malformed progress event
      const progressHandler = mockSocket.on.mock.calls.find(call => call[0] === 'progress')?.[1];
      if (progressHandler) {
        act(() => {
          progressHandler(null); // Malformed data
        });
      }
      
      // Should not crash
      expect(screen.getByText('YouTube Outlier Discovery')).toBeInTheDocument();
    });
  });
});