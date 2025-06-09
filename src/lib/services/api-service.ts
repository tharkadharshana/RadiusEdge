
// import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // Not used in client-side simulation

interface ApiRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number; // Milliseconds
}

export interface ApiResponse<T = any> { // Exported for ExecutionConsolePage
  status: number;
  headers: Record<string, string>;
  data: T;
  error?: string; // Changed to string for easier simulation
}

interface ValidationRule {
  path: string;
  operator: 'equals' | 'contains' | 'exists' | 'matches';
  value?: any;
  pattern?: RegExp; // Not used in mock
}

export class ApiService {
  // private client: AxiosInstance; // Not used in mock

  constructor() {
    // this.client = axios.create({ ... }); // Real client setup
  }

  // SIMULATED: This is a mock API request. Real implementation would use axios or fetch.
  async makeRequest<T = any>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    console.log(`[API_MOCK] Simulating API request: ${config.method} ${config.url}`);
    if(config.headers) console.log(`[API_MOCK] Headers: ${JSON.stringify(config.headers)}`);
    if(config.body) console.log(`[API_MOCK] Body: ${JSON.stringify(config.body)}`);

    return new Promise((resolve) => {
      setTimeout(() => {
        if (config.url.includes('fail_api_request')) {
          console.warn('[API_MOCK] Simulated API request failure.');
          resolve({
            status: 500,
            headers: { 'content-type': 'application/json', 'x-simulated-error': 'true' },
            data: { message: 'Simulated internal server error' } as any,
            error: 'Simulated: Internal Server Error',
          });
          return;
        }

        let responseData: any;
        let status = 200;

        if (config.method === 'POST' || config.method === 'PUT') {
          status = config.method === 'POST' ? 201 : 200;
          responseData = { success: true, message: `Resource ${config.method === 'POST' ? 'created' : 'updated'} successfully`, id: `sim_${Date.now()}`, data: config.body || {} };
        } else if (config.method === 'DELETE') {
          status = 204; // No content typically
          responseData = null;
        } else { // GET, PATCH
          responseData = {
            id: `sim_resource_${Math.random().toString(36).substring(7)}`,
            name: 'Simulated Resource Name',
            value: Math.random() * 100,
            timestamp: new Date().toISOString(),
            nested: { info: 'Some nested simulated data' },
          };
        }
        
        console.log(`[API_MOCK] Simulated API request successful. Status: ${status}`);
        resolve({
          status,
          headers: { 'content-type': 'application/json', 'x-simulated-by': 'RadiusEdgeMockAPI' },
          data: responseData as T,
        });
      }, 60 + Math.random() * 120);
    });
  }

  // SIMULATED: Mock validation. Real implementation would use the actual response.
  validateResponse<T = any>(
    response: ApiResponse<T>,
    expectedStatus?: number | number[],
    validationRules?: ValidationRule[] // Not deeply implemented in mock
  ): boolean {
    console.log(`[API_MOCK] Simulating validation of response (Status: ${response.status})`);
    if (response.error) {
      console.log('[API_MOCK] Validation failed due to response error.');
      return false;
    }

    if (expectedStatus) {
      if (Array.isArray(expectedStatus)) {
        if (!expectedStatus.includes(response.status)) {
           console.log(`[API_MOCK] Validation failed: Status ${response.status} not in expected [${expectedStatus.join(', ')}].`);
          return false;
        }
      } else if (response.status !== expectedStatus) {
        console.log(`[API_MOCK] Validation failed: Status ${response.status} !== expected ${expectedStatus}.`);
        return false;
      }
    }
    // Basic mock validation for rules
    if (validationRules && validationRules.length > 0) {
        // console.log(`[API_MOCK] Mock validation assumes rules passed for status ${response.status}.`); // Original line, can be removed or kept if desired
        console.warn(`[API_MOCK] INFO: Received ${validationRules.length} validation rule(s) for response with status ${response.status}. However, this mock service does not actually process these rules beyond checking the HTTP status code. All rule-based validation is assumed to pass if the status code matches expectations.`);
    }
    console.log('[API_MOCK] Simulated validation successful.');
    return true;
  }

  // Methods below are not essential for mock but kept for signature compatibility
  setBaseUrl(url: string): void { console.log(`[API_MOCK] Base URL set to: ${url} (no-op in mock)`); }
  setDefaultHeaders(headers: Record<string, string>): void { console.log(`[API_MOCK] Default headers set: ${JSON.stringify(headers)} (no-op in mock)`); }
  setDefaultTimeout(timeout: number): void { console.log(`[API_MOCK] Default timeout set to: ${timeout}ms (no-op in mock)`); }
}

export const apiService = new ApiService();
