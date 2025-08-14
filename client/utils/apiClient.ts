import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

interface RequestConfigWithMetadata extends AxiosRequestConfig {
  metadata?: { startTime: number };
  _retryCount?: number;
}

interface RetryConfig {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableStatusCodes?: number[];
  retryableErrorCodes?: string[];
}

interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  retry?: RetryConfig;
  enableCorrelationId?: boolean;
}

class ApiClient {
  private client: AxiosInstance;
  private retryConfig: RetryConfig;

  constructor(config: ApiClientConfig = {}) {
    const {
      baseURL = 'http://localhost:5000', // Python backend default
      timeout = 30000,
      retry = {},
      enableCorrelationId = true
    } = config;

    this.retryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      retryableErrorCodes: ['NETWORK_ERROR', 'YOUTUBE_QUOTA_EXCEEDED'],
      ...retry
    };

    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors(enableCorrelationId);
  }

  private setupInterceptors(enableCorrelationId: boolean) {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add correlation ID
        if (enableCorrelationId && !config.headers['x-correlation-id']) {
          config.headers['x-correlation-id'] = this.generateCorrelationId();
        }

        // Add request timestamp
        (config as any).metadata = { startTime: Date.now() };

        return config;
      },
      (error) => {
        // Request interceptor error occurred
        return Promise.reject(error);
      }
    );

    // Response interceptor with retry logic
    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - ((response.config as RequestConfigWithMetadata).metadata?.startTime || 0);
        
        // Log API response for debugging
        
        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as RequestConfigWithMetadata;
        const duration = Date.now() - (config?.metadata?.startTime || 0);
        
        // Log API error for debugging

        // Don't retry if already attempted max times
        if ((config._retryCount || 0) >= this.retryConfig.maxAttempts!) {
          return Promise.reject(error);
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          return Promise.reject(error);
        }

        // Increment retry count
        config._retryCount = (config._retryCount || 0) + 1;

        // Calculate delay
        const delay = this.calculateDelay(config._retryCount);
        
        // Retrying API request

        // Wait and retry
        await this.sleep(delay);
        
        // Reset start time for new attempt
        (config as RequestConfigWithMetadata).metadata = { startTime: Date.now() };
        
        return this.client(config);
      }
    );
  }

  private generateCorrelationId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isRetryableError(error: AxiosError): boolean {
    // Network errors (no response)
    if (!error.response) {
      return true;
    }

    const statusCode = error.response.status;
    const errorCode = (error.response.data as any)?.errorCode;

    // Check status codes
    if (this.retryConfig.retryableStatusCodes?.includes(statusCode)) {
      return true;
    }

    // Check error codes
    if (errorCode && this.retryConfig.retryableErrorCodes?.includes(errorCode)) {
      return true;
    }

    return false;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.retryConfig.baseDelay! * 
      Math.pow(this.retryConfig.backoffFactor!, attempt - 1);
    
    const delayWithJitter = exponentialDelay * (0.5 + Math.random() * 0.5);
    
    return Math.min(delayWithJitter, this.retryConfig.maxDelay!);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  // Upload with progress tracking
  async upload<T = any>(
    url: string, 
    file: File | FormData, 
    options: {
      onProgress?: (progressEvent: any) => void;
      correlationId?: string;
    } = {}
  ): Promise<AxiosResponse<T>> {
    const formData = file instanceof FormData ? file : new FormData();
    if (file instanceof File) {
      formData.append('file', file);
    }

    return this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(options.correlationId && { 'x-correlation-id': options.correlationId })
      },
      onUploadProgress: options.onProgress
    });
  }

  // Download with progress tracking
  async download(
    url: string, 
    options: {
      filename?: string;
      onProgress?: (progressEvent: any) => void;
      correlationId?: string;
    } = {}
  ): Promise<void> {
    const response = await this.client.get(url, {
      responseType: 'blob',
      headers: {
        ...(options.correlationId && { 'x-correlation-id': options.correlationId })
      },
      onDownloadProgress: options.onProgress
    });

    // Create download link
    const blob = new Blob([response.data]);
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = options.filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Get instance for direct access
  getInstance(): AxiosInstance {
    return this.client;
  }
}

// Create default instance
export const apiClient = new ApiClient();

// Export class for custom instances
export { ApiClient };

// Error recovery utilities
export class ErrorRecoveryUtils {
  static async withErrorRecovery<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      onError?: (error: any, attempt: number) => void;
      shouldRetry?: (error: any) => boolean;
      delay?: number;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      onError,
      shouldRetry = () => true,
      delay = 1000
    } = options;

    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (onError) {
          onError(error, attempt);
        }

        if (attempt === maxAttempts || !shouldRetry(error)) {
          break;
        }

        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }

    throw lastError;
  }

  static createCircuitBreaker<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    options: {
      failureThreshold?: number;
      resetTimeout?: number;
      onStateChange?: (state: 'open' | 'closed' | 'half-open') => void;
    } = {}
  ) {
    const {
      failureThreshold = 5,
      resetTimeout = 60000,
      onStateChange
    } = options;

    let state: 'open' | 'closed' | 'half-open' = 'closed';
    let failureCount = 0;
    let lastFailureTime = 0;

    return async (...args: T): Promise<R> => {
      if (state === 'open') {
        if (Date.now() - lastFailureTime >= resetTimeout) {
          state = 'half-open';
          onStateChange?.('half-open');
        } else {
          throw new Error('Circuit breaker is OPEN');
        }
      }

      try {
        const result = await fn(...args);
        
        if (state === 'half-open') {
          state = 'closed';
          failureCount = 0;
          onStateChange?.('closed');
        }
        
        return result;
      } catch (error) {
        failureCount++;
        lastFailureTime = Date.now();

        if (failureCount >= failureThreshold) {
          state = 'open';
          onStateChange?.('open');
        }

        throw error;
      }
    };
  }

  static async retry<T>(
    operation: () => Promise<T>,
    attempts: number = 3,
    delay: number = 1000
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempts <= 1) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retry(operation, attempts - 1, delay * 1.5);
    }
  }
}

export default apiClient;