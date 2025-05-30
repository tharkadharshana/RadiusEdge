
// src/lib/types.ts

// General Application Types

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SENT' | 'RECV' | 'SSH_CMD' | 'SSH_OUT' | 'SSH_FAIL';

export interface LogEntry {
  id: string;
  timestamp: string; // ISO string
  level: LogLevel;
  message: string;
  rawDetails?: string; // JSON string for packet data, command output etc.
}


// Server Configuration related types (from settings/servers/page.tsx)
export type ServerStatus = 'connected' | 'disconnected' | 'unknown' | 'testing' | 'error_ssh' | 'error_config' | 'error_service' | 'issues_found';

export interface TestStepConfig {
  id: string;
  name: string;
  command: string;
  isEnabled: boolean;
  isMandatory: boolean;
  type: 'default' | 'custom';
  expectedOutputContains?: string;
}

export interface SshExecutionStep {
  id: string;
  name: string;
  command: string;
  isEnabled: boolean;
  expectedOutputContains?: string;
}

export interface ServerConfig {
  id: string;
  name: string;
  type: 'freeradius' | 'custom' | 'other';
  host: string;
  sshPort: number;
  sshUser: string;
  authMethod: 'key' | 'password';
  privateKey?: string;
  password?: string;
  radiusAuthPort: number;
  radiusAcctPort: number;
  defaultSecret: string;
  nasSpecificSecrets: Record<string, string>;
  status: ServerStatus;
  testSteps: TestStepConfig[];
  scenarioExecutionSshCommands: SshExecutionStep[];
}

// For Execution Console Page (mock server config)
export interface ServerConfigForExec {
  id: string;
  name: string;
  scenarioExecutionSshCommands?: SshExecutionStep[];
}


// Database Validation Setup related types (from settings/database/page.tsx)
export type DbStatus = 'connected_validated' | 'connected_issues' | 'connection_error' | 'validation_error' | 'unknown' | 'testing';

export interface DbSshPreambleStepConfig {
  id: string;
  name: string;
  command: string;
  isEnabled: boolean;
  expectedOutputContains?: string;
}

export interface DbValidationStepConfig {
  id: string;
  name: string;
  type: 'sql' | 'ssh';
  commandOrQuery: string;
  isEnabled: boolean;
  isMandatory: boolean;
  expectedOutputContains?: string;
}

export interface DbConnectionConfig {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'mssql' | 'sqlite';
  host: string;
  port: number;
  username: string;
  password?: string;
  databaseName: string;
  status?: DbStatus;
  sshPreambleSteps: DbSshPreambleStepConfig[];
  validationSteps: DbValidationStepConfig[];
}


// Scenario Builder related types (from scenarios/page.tsx)
export type ScenarioStepType = 'radius' | 'sql' | 'delay' | 'loop_start' | 'loop_end' | 'conditional_start' | 'conditional_end' | 'api_call' | 'log_message';

export interface ExpectedReplyAttribute {
  id: string;
  name: string;
  value: string;
}

export interface ApiHeader {
  id: string;
  name: string;
  value: string;
}

export interface ScenarioStep {
  id: string;
  type: ScenarioStepType;
  name: string;
  details: Record<string, any> & {
    packet_id?: string;
    expectedAttributes?: ExpectedReplyAttribute[];
    timeout?: number;
    retries?: number;
    query?: string;
    expect_column?: string;
    expect_value?: string;
    connection?: string;
    duration_ms?: number;
    iterations?: number;
    condition?: string;
    url?: string;
    method?: 'GET' | 'POST';
    headers?: ApiHeader[];
    requestBody?: string;
    mockResponseBody?: string;
    message?: string;
  };
}

export interface ScenarioVariable {
  id: string;
  name: string;
  type: 'static' | 'random_string' | 'random_number' | 'list';
  value: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  variables: ScenarioVariable[];
  steps: ScenarioStep[];
  lastModified: string; // ISO string
  tags: string[];
}

// Packet Editor related types (from packets/page.tsx)
export interface RadiusAttribute {
  id: string;
  name: string;
  value: string;
}

export interface RadiusPacket {
  id: string;
  name: string;
  description: string;
  attributes: RadiusAttribute[];
  lastModified: string; // ISO string
  tags: string[];
}

// Dictionaries Manager related types (from dictionaries/page.tsx)
export interface Dictionary {
  id: string;
  name: string;
  source: string;
  attributes: number; // Mock count
  vendorCodes: number; // Mock count
  isActive: boolean;
  lastUpdated: string; // ISO string
}

// User Management related types (from settings/users/page.tsx)
export type UserRole = 'admin' | 'editor' | 'viewer' | 'operator';
export type UserStatus = 'active' | 'invited' | 'suspended';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  lastLogin: string; // ISO string
  status: UserStatus;
}

// Results Dashboard related types (from results/page.tsx)
export interface TestResult {
  id: string;
  scenarioName: string;
  status: 'Pass' | 'Fail' | 'Warning';
  timestamp: Date; // Kept as Date for frontend, but stored as ISO string in backend
  latencyMs: number;
  server: string;
  details?: any; // JSON string for packet exchange, SQL results etc.
}
