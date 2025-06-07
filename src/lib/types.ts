
// src/lib/types.ts

// General Application Types

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SENT' | 'RECV' | 'SSH_CMD' | 'SSH_OUT' | 'SSH_FAIL';

export interface LogEntry {
  id: string;
  timestamp: string; // ISO string
  level: LogLevel;
  message: string;
  rawDetails?: string | object; // Can be string for raw text, or object for structured data
}


// Server Configuration related types (from settings/servers/page.tsx)
export type ServerStatus = 'connected' | 'disconnected' | 'unknown' | 'testing' | 'error_ssh' | 'error_config' | 'error_service' | 'issues_found' | 'jump_server_connection_failure' | 'preamble_failure';


export interface TestStepConfig {
  id: string;
  name: string;
  command: string;
  isEnabled: boolean;
  isMandatory: boolean;
  type: 'default' | 'custom';
  expectedOutputContains?: string;
}

export interface SshExecutionStep { // Used for both scenario and connection test preambles
  id: string;
  name: string;
  command: string;
  isEnabled: boolean;
  expectedOutputContains?: string;
}

export interface ServerConfig { // This is the FullServerConfig
  id: string;
  name: string;
  type: 'freeradius' | 'radiusd' | 'custom';
  customServerType?: string;
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
  testSteps: TestStepConfig[]; // For "Test Connection"
  scenarioExecutionSshCommands: SshExecutionStep[]; // For scenarios targeting this server
  connectionTestSshPreamble?: SshExecutionStep[]; // For "Test Connection", runs before testSteps
}

// For Execution Console Page (mock server config - this might be redundant if FullServerConfig is always fetched)
export interface ServerConfigForExec {
  id: string;
  name: string;
  scenarioExecutionSshCommands?: SshExecutionStep[];
}


// Database Validation Setup related types (from settings/database/page.tsx)
export type DbStatus = 'connected_validated' | 'connected_issues' | 'connection_error' | 'validation_error' | 'unknown' | 'testing' | 'jump_server_connection_failure' | 'preamble_failure';


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
  // Jump Server
  jumpServerHost?: string;
  jumpServerPort?: number;
  jumpServerUser?: string;
  jumpServerAuthMethod?: 'key' | 'password';
  jumpServerPrivateKey?: string;
  jumpServerPassword?: string;
  // Target DB
  host: string;
  port: number;
  username: string;
  password?: string; 
  databaseName: string;
  status?: DbStatus;
  sshPreambleSteps: DbSshPreambleStepConfig[]; 
  directTestSshPreamble?: DbSshPreambleStepConfig[]; 
  validationSteps: DbValidationStepConfig[]; 
}


// Scenario Builder related types (from scenarios/page.tsx)
export type ScenarioStepType = 'radius' | 'sql' | 'delay' | 'loop_start' | 'loop_end' | 'conditional_start' | 'conditional_end' | 'api_call' | 'log_message';

export interface ExpectedReplyAttribute { // Used in RADIUS step details
  id: string;
  name: string;
  value: string;
}

export interface ApiHeader { // Used in API_CALL step details
  id: string;
  name: string;
  value: string;
}

export interface ScenarioStep {
  id: string;
  type: ScenarioStepType;
  name: string;
  details: { // Made details non-optional and typed more specifically per step
    // RADIUS
    packet_id?: string; // ID of a packet from Packet Editor
    // OR, if no packet_id, attributes can be defined directly (less common, but for flexibility)
    // attributes?: { name: string; value: string }[]; // Not currently used if packet_id is primary
    expectedAttributes?: ExpectedReplyAttribute[];
    timeout?: number; // ms
    retries?: number;
    // SQL
    query?: string;
    expect_column?: string;
    expect_value?: string;
    connection_id?: string; // ID of a DB connection from settings
    // Delay
    duration_ms?: number;
    // Loop / Conditional
    iterations?: number; // For loop_start
    condition?: string; // For loop_start, conditional_start
    // API Call
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; // Expanded methods
    headers?: ApiHeader[];
    requestBody?: string; // JSON string usually
    mockResponseBody?: string; // For simulation
    // Log Message
    message?: string;
    // Generic catch-all, though specific props above are preferred
    [key: string]: any; 
  };
}

export interface ScenarioVariable {
  id: string;
  name: string;
  type: 'static' | 'random_string' | 'random_number' | 'list';
  value: string; // For static/list (CSV). For random, this might be pattern/length.
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

export interface RadClientOptions {
  server?: string; 
  type?: 'auth' | 'acct' | 'status' | 'coa' | 'disconnect' | 'auto';
  secret?: string;
  useIPv4?: boolean;
  useIPv6?: boolean;
  blastChecks?: boolean;
  count?: number;
  raddbDirectory?: string;
  dictionaryDirectory?: string;
  inputFile?: string; 
  printFileName?: boolean; 
  requestId?: number; 
  requestsPerSecond?: number; 
  parallelRequests?: number; 
  protocol?: 'tcp' | 'udp'; 
  quietMode?: boolean; 
  retries?: number; 
  summaries?: boolean; 
  sharedSecretFile?: string; 
  timeout?: number; // seconds
  debug?: boolean; 
}

export interface RadTestOptions {
  user?: string;
  password?: string;
  radiusServer?: string; 
  nasPortNumber?: number;
  secret?: string;
  ppphint?: boolean; 
  nasname?: string;
  raddbDirectory?: string; 
  protocol?: 'tcp' | 'udp'; 
  authType?: 'pap' | 'chap' | 'mschap' | 'eap-md5'; 
  debug?: boolean; 
  useIPv4?: boolean; 
  useIPv6?: boolean; 
}

export type ExecutionTool = 'radclient' | 'radtest';

export interface RadiusPacket { // This is the FullRadiusPacket
  id: string;
  name: string;
  description: string;
  attributes: RadiusAttribute[];
  lastModified: string; // ISO string
  tags: string[];
  executionTool?: ExecutionTool;
  toolOptions?: RadClientOptions | RadTestOptions;
}

// Dictionaries Manager related types (from dictionaries/page.tsx)
// Re-using AiParsedAttribute and AiParsedEnum from AI flow as the canonical 'Attribute' structure
export type { ParsedAttribute as DictionaryAttributeContent, ParsedEnum as DictionaryEnumContent } from '@/ai/flows/parse-dictionary-file-content';

export interface Dictionary {
  id: string;
  name: string;
  source: string;
  attributes: number; // Count of exampleAttributes
  vendorCodes: number; // Conceptual, not fully implemented from parsing
  isActive: boolean;
  lastModified: string; // ISO string
  exampleAttributes?: import('@/ai/flows/parse-dictionary-file-content').ParsedAttribute[]; // Use the AI parsed type
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
  timestamp: Date; 
  latencyMs: number;
  server: string;
  details?: {
    executionId?: string;
    simulatedLogCount?: number;
    [key: string]: any; 
  };
}
