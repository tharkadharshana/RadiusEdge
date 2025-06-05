import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

interface ApiRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  validateStatus?: (status: number) => boolean;
}

interface ApiResponse<T = any> {
  status: number;
  headers: Record<string, string>;
  data: T;
  error?: Error;
}

interface ValidationRule {
  path: string;
  operator: 'equals' | 'contains' | 'exists' | 'matches';
  value?: any;
  pattern?: RegExp;
}

export class ApiService {
  private client: AxiosInstance;

  constructor(baseConfig: AxiosRequestConfig = {}) {
    this.client = axios.create({
      timeout: 30000, // Default timeout of 30 seconds
      validateStatus: (status) => true, // Don't throw on any status code
      ...baseConfig,
    });
  }

  async makeRequest<T = any>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    try {
      const axiosConfig: AxiosRequestConfig = {
        url: config.url,
        method: config.method,
        headers: config.headers,
        data: config.body,
        timeout: config.timeout,
        validateStatus: config.validateStatus,
      };

      const response: AxiosResponse<T> = await this.client.request(axiosConfig);

      return {
        status: response.status,
        headers: response.headers as Record<string, string>,
        data: response.data,
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        return {
          status: error.response?.status || 0,
          headers: error.response?.headers as Record<string, string> || {},
          data: error.response?.data as T,
          error: new Error(error.message),
        };
      }

      return {
        status: 0,
        headers: {},
        data: {} as T,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      };
    }
  }

  validateResponse<T = any>(
    response: ApiResponse<T>,
    expectedStatus?: number | number[],
    validationRules?: ValidationRule[]
  ): boolean {
    // Check for errors
    if (response.error) {
      return false;
    }

    // Validate status code if expected status is provided
    if (expectedStatus) {
      if (Array.isArray(expectedStatus)) {
        if (!expectedStatus.includes(response.status)) {
          return false;
        }
      } else if (response.status !== expectedStatus) {
        return false;
      }
    }

    // If no validation rules, we're done
    if (!validationRules || validationRules.length === 0) {
      return true;
    }

    // Check each validation rule
    return validationRules.every((rule) => {
      const value = this.getValueByPath(response.data, rule.path);

      switch (rule.operator) {
        case 'equals':
          return value === rule.value;

        case 'contains':
          if (typeof value === 'string') {
            return value.includes(String(rule.value));
          }
          if (Array.isArray(value)) {
            return value.includes(rule.value);
          }
          return false;

        case 'exists':
          return value !== undefined && value !== null;

        case 'matches':
          if (typeof value === 'string' && rule.pattern) {
            return rule.pattern.test(value);
          }
          return false;

        default:
          return false;
      }
    });
  }

  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  setBaseUrl(url: string): void {
    this.client.defaults.baseURL = url;
  }

  setDefaultHeaders(headers: Record<string, string>): void {
    this.client.defaults.headers.common = {
      ...this.client.defaults.headers.common,
      ...headers,
    };
  }

  setDefaultTimeout(timeout: number): void {
    this.client.defaults.timeout = timeout;
  }
}

// Create a singleton instance
export const apiService = new ApiService(); 