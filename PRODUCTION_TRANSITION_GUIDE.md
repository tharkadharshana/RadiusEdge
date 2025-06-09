
# RadiusEdge: From Prototype to Production - A Comprehensive Guide

This document provides a comprehensive guide for transitioning the RadiusEdge application from its current prototype state (with simulated backend operations) to a fully functional, production-ready system capable of live RADIUS testing and scenario execution.

## I. Introduction

**Current State:** RadiusEdge prototype features a Next.js frontend, UI for managing scenarios, packets, and configurations, and Genkit for AI assistance. Core execution logic (SSH, RADIUS, SQL, API calls within scenarios) is currently **simulated** by mock services in `src/lib/services/`. Data is persistently stored in a local SQLite database.

**Goal:** Replace mock services with real backend implementations and build a robust scenario execution engine.

## II. High-Level Architecture (Target Production System)

1.  **Frontend (Existing):** Next.js (App Router), React, ShadCN UI, Tailwind CSS. Interacts with API routes.
2.  **API Routes (Existing & To Be Enhanced):** Next.js API routes in `src/app/api/`. Currently handle CRUD for configurations and data. Will need new endpoints for triggering live scenario execution and fetching real-time logs.
3.  **Backend Execution Engine (To Be Built):** This is the core component for live operations. It could be:
    *   **Enhanced Next.js API Routes:** For simpler deployments, logic can be built into specific API routes. Care must be taken for long-running processes.
    *   **Separate Node.js Service:** A dedicated Node.js application (e.g., Express.js) deployed alongside the Next.js app, offering more flexibility for managing connections and background tasks.
    *   **Serverless Functions:** For scalable, event-driven execution of individual tasks or steps.
    *   *Recommendation:* Start with enhanced Next.js API routes for initial live functionality, and consider a separate service if complexity or scalability demands grow.
4.  **Live Services (To Be Built - replacing mocks in `src/lib/services/`):**
    *   Real SSH Service
    *   Real RADIUS Service
    *   Real Database Validation Service
    *   Real API Call Service (for scenario steps)
5.  **Database (Existing):** SQLite (`radiusedge.db`). Handles persistent storage of scenarios, packets, configurations, users, test results, execution logs, and AI interactions.
6.  **AI Flows (Existing):** Genkit with Google AI (Gemini models) for AI-assisted tasks. Largely functional, requires secure API key management.

## III. Frontend Components & Data Flow (Brief Review)

The current frontend components in `src/app/` for:
*   AI Assistant
*   Scenario Builder (`scenarios/page.tsx`)
*   Packet Editor (`packets/page.tsx`)
*   Dictionaries Manager (`dictionaries/page.tsx`)
*   Settings (Servers, Database, Users)
*   Results Dashboard (`results/page.tsx`)

...correctly interact with their respective API routes in `src/app/api/` for Create, Read, Update, and Delete (CRUD) operations. This data is stored in the SQLite database via these API routes. This part of the system is foundational and mostly sound. The primary change for the frontend will be in the **Execution Console**, which will need to interact with new backend endpoints for live execution.

## IV. Core Application Features - Intended Live Functionality

This section details what each feature should do in a production environment.

### 1. Dashboard (`src/app/page.tsx`)
*   **Live Data:** "Quick Start a Scenario" and "Execute Tests" should reflect real, recently used scenarios and configured servers from the database.
*   **Recent Activity:** Should fetch and display *actual* recent test results, AI interactions, and major configuration changes from the database.
*   **System Status:** Should reflect the actual connectivity status of configured primary servers or critical backend services (requires a health-check mechanism).

### 2. AI Assistant (`src/app/ai-assistant/page.tsx`)
*   This feature uses Genkit flows (`generate-radius-packet.ts`, `explain-radius-attribute.ts`, etc.).
*   **Live Functionality:** Largely operational as is.
*   **Production Needs:** Secure management of Google AI API keys (via environment variables, secrets manager). Potential rate limiting or cost monitoring for AI calls.

### 3. Scenario Builder (`src/app/scenarios/page.tsx`)
*   **Live Functionality:** UI for creating/editing scenarios (name, description, tags, variables, steps) and saving them to the database via `/api/scenarios` is functional.
*   **Step Details:** The details captured for each step type (RADIUS, SQL, API, Delay, Log, Conditional, Loop) are crucial inputs for the backend execution engine.
    *   **Variable Substitution:** The backend engine must resolve `${variable_name}` placeholders using the scenario's defined variables before executing each step.

### 4. Packet Editor (`src/app/packets/page.tsx`)
*   **Live Functionality:** UI for creating/editing RADIUS packets (name, description, tags, attributes, `executionTool`, `toolOptions`) and saving them to the database via `/api/packets` is functional.
*   **Attribute Suggestions:** Fetches from active dictionaries via `/api/dictionaries/attributes/search`.
*   **"Run Packet" Action:** Navigates to the Execution Console to run the single selected packet against a chosen server. The Execution Console will need to be adapted to handle this specific flow with the live backend.

### 5. Dictionaries Manager (`src/app/dictionaries/page.tsx`)
*   **Live Functionality:** UI for importing/managing dictionary metadata and example attributes (via manual entry, paste, or file upload with AI parsing) and saving to the database via `/api/dictionaries` is functional.
*   **AI Parsing:** Uses `parseDictionaryFileContent` Genkit flow. Ensure AI model availability and API key security.
*   **Active Status:** Correctly toggles dictionary active status for use in features like attribute suggestions.

### 6. Execution Console (`src/app/execute/page.tsx`)
*   **Current State:** Simulates execution by iterating through scenario steps client-side and calling mock services. Logs are transient unless explicitly saved by new API calls.
*   **Live Functionality (Requires Major Backend Work):**
    1.  **Initiate Execution:** User selects a scenario/packet and a server. Clicking "Start Execution" should send a request to a new backend API endpoint (e.g., `POST /api/execute-scenario`).
    2.  **Backend Processing:** The backend scenario execution engine (detailed in Section V) takes over.
    3.  **Real-time Logging:** The frontend should fetch logs from the `execution_logs` table (e.g., via polling `GET /api/logs/[testExecutionId]` or using WebSockets for true real-time updates) as they are generated by the backend engine.
    4.  **Controls:**
        *   **Abort:** Sends a request to the backend to signal the execution engine to stop the current scenario (requires backend implementation to handle interruption).
        *   **Save PCAP (Future):** If live RADIUS interception is implemented on the backend, this would trigger a download of a captured PCAP file.
        *   **Export Logs:** Fetches all logs for the current execution ID from the database and prepares them for download (largely functional, but source of logs changes).

### 7. Results Dashboard (`src/app/results/page.tsx`)
*   **Live Functionality:** Fetches test result summaries from the `test_results` table via `/api/results`.
*   **Data Source:** The `test_results` table will be populated by the backend scenario execution engine after each live scenario run.
*   **Result Details:** Clicking a result should still show details, including fetching associated logs from `execution_logs` using the `executionId` often stored in `TestResult.details`.

### 8. Settings (`src/app/settings/*`)
*   **Server Configuration (`servers/page.tsx`):**
    *   UI and API for saving server details (host, SSH, RADIUS ports, secrets, preambles) are functional.
    *   **"Test Connection":** Currently calls an AI flow for simulation. This needs to be replaced by a backend call that uses the real SSH service to execute the defined `connectionTestSshPreamble` and `testSteps` on the actual server. The `status` field should be updated based on this live test.
*   **Database Validation Setup (`database/page.tsx`):**
    *   UI and API for saving external DB connection details (host, credentials, type, preambles, validation sequences) are functional.
    *   **"Test Connection & Validation":** Currently calls an AI flow. This needs to be replaced by a backend call that uses the real SSH service (for preambles, if any) and the real DB Validation service to connect to the external DB and run the `validationSteps`.
*   **User Management (`users/page.tsx`):**
    *   UI and API for basic user record management (CRUD) are functional.
    *   **Live Functionality:** For a production system, this would need integration with a real authentication/authorization system (e.g., Firebase Auth, NextAuth.js, custom solution). The current implementation is for record-keeping only.

## V. Backend Execution Engine - Transitioning from Simulation to Production

This is the most significant part of the transition. You will replace the mock services in `src/lib/services/` with actual implementations that perform live operations.

### A. Overview & Location

The backend execution engine will be responsible for:
1.  Receiving a request to execute a scenario (or single packet).
2.  Fetching all necessary data (scenario steps, server config, packet details).
3.  Orchestrating the execution of steps using real services.
4.  Logging all actions and outcomes.
5.  Storing final results.

This engine's logic will primarily reside on the server-side.

### B. Real SSH Service (Replacing mock `src/lib/services/ssh-service.ts`)

*   **Technology:** Use a robust Node.js SSH library like `ssh2`.
*   **Core Functions:**
    *   `connect(config: SshConnectionConfig): Promise<void>`:
        *   Establishes a persistent SSH connection to the specified host.
        *   Handles authentication via password or private key.
        *   Manages retries and timeouts.
        *   **Security:** Private keys and passwords must be stored and handled securely (e.g., environment variables, secrets manager, encrypted storage). **Never hardcode credentials.**
    *   `executeCommand(command: string): Promise<SshCommandResult>`:
        *   Executes a command on the established SSH connection.
        *   Captures `stdout`, `stderr`, and the `exit code`.
        *   Handles command timeouts.
    *   `disconnect(): Promise<void>`: Closes the SSH connection.
    *   `isConnected(): boolean`: Checks the current connection status.
*   **Preamble Execution:** The scenario engine will use this service to execute multi-step SSH preambles defined in server or DB configurations. Each step's success should be validated (based on exit code and `expectedOutputContains`).
*   **Error Handling:** Robust error handling for connection failures, command execution errors, and timeouts.

```typescript
// Example structure for a real ssh-service.ts using ssh2
// 'use server'; // If used within Next.js API routes directly

// import { Client } from 'ssh2';
// import fs from 'fs/promises'; // For reading private keys

// export interface SshConnectionConfig { /* ... as defined in types.ts ... */ }
// export interface SshCommandResult { /* ... as defined in types.ts ... */ }

// export class RealSshService {
//   private client: Client | null = null;
//   private connectionConfig: SshConnectionConfig | null = null;

//   async connect(config: SshConnectionConfig): Promise<void> {
//     // SIMULATED: Real SSH connection logic using 'ssh2' library
//     // this.client = new Client();
//     // this.client.on('ready', () => { /* resolve promise */ });
//     // this.client.on('error', (err) => { /* reject promise */ });
//     // const connectionParams: any = { host: config.host, port: config.port, username: config.username };
//     // if (config.authMethod === 'password' && config.password) {
//     //   connectionParams.password = config.password;
//     // } else if (config.authMethod === 'key' && config.privateKey) {
//     //   // Ensure privateKey is read from a secure location or passed securely
//     //   connectionParams.privateKey = config.privateKey; // Or: await fs.readFile(config.privateKeyPath);
//     // }
//     // this.client.connect(connectionParams);
//     console.log(`[REAL_SSH_SERVICE] Attempting to connect to ${config.host}`);
//     // For this guide, we'll just simulate success after a delay
//     return new Promise(resolve => setTimeout(() => {
//         this.connectionConfig = config;
//         this.client = {} as Client; // Mock client object
//         console.log(`[REAL_SSH_SERVICE] Connected to ${config.host}`);
//         resolve();
//     }, 100));
//   }

//   async executeCommand(command: string): Promise<SshCommandResult> {
//     // SIMULATED: Real command execution
//     // if (!this.client) throw new Error("Not connected");
//     // return new Promise((resolve, reject) => {
//     //   this.client.exec(command, (err, stream) => {
//     //     if (err) return reject(err);
//     //     let stdout = '';
//     //     let stderr = '';
//     //     let exitCode = 0;
//     //     stream.on('data', (data: Buffer) => stdout += data.toString());
//     //     stream.stderr.on('data', (data: Buffer) => stderr += data.toString());
//     //     stream.on('close', (code: number) => {
//     //       exitCode = code;
//     //       resolve({ stdout, stderr, code: exitCode });
//     //     });
//     //   });
//     // });
//     console.log(`[REAL_SSH_SERVICE] Executing command on ${this.connectionConfig?.host}: ${command}`);
//     // Simulate output
//     return Promise.resolve({
//       stdout: `Output for: ${command}\nDone.`,
//       stderr: command.includes("error") ? "Simulated error in command" : "",
//       code: command.includes("error") ? 1 : 0,
//     });
//   }

//   async disconnect(): Promise<void> {
//     // SIMULATED: Real disconnect
//     // if (this.client) {
//     //   this.client.end();
//     //   this.client = null;
//     // }
//     console.log(`[REAL_SSH_SERVICE] Disconnected from ${this.connectionConfig?.host}`);
//     this.client = null;
//     this.connectionConfig = null;
//     return Promise.resolve();
//   }

//   isConnected(): boolean {
//     return !!this.client && !!this.connectionConfig; // Simplified for mock
//   }
//    getConnectionConfig(): SshConnectionConfig | null {
//      return this.connectionConfig;
//    }
// }
// export const sshService = new RealSshService(); // Replace mock instance
```

### C. Real RADIUS Service (Replacing mock `src/lib/services/radius-service.ts`)

*   **Option 1: Using `radclient` / `radtest` CLI Tools (Recommended for initial implementation):**
    *   **Technology:** Node.js `child_process.spawn`.
    *   **Core Function (`simulateExecuteTool` replacement):**
        *   Dynamically construct the `radclient` or `radtest` command-line arguments based on:
            *   `RadiusPacket` data (attributes, `executionTool`, `toolOptions`).
            *   `ServerConfig` (host, port, secret).
            *   Resolved scenario variables.
        *   Spawn the tool as a child process.
        *   Capture `stdout` and `stderr` from the process.
        *   Parse the output to:
            *   Identify sent packet data (often echoed by the tools).
            *   Identify received packet data.
            *   Determine success/failure (e.g., based on exit code or specific output strings like "Access-Accept", "Access-Reject", "radclient: Server said: OK").
        *   Return a structured result including sent/received packet representations (as strings), full tool output, and status code.
    *   **Security:** Be extremely careful if any part of the command or its arguments are derived from user input that isn't strictly controlled (e.g., packet attributes). Sanitize inputs to prevent command injection.
    *   **Dependencies:** Ensure `radclient` and `radtest` are installed on the server where this backend engine runs.

*   **Option 2: Using a Node.js RADIUS Library:**
    *   **Technology:** Libraries like `radius` or `node-radius-client`.
    *   **Core Function:**
        *   Programmatically create RADIUS packet objects based on `RadiusPacket` data.
        *   Encode and send the packet to the target server.
        *   Receive and decode the response packet.
        *   Handle timeouts and retries.
    *   **Pros:** More control, potentially better performance for high-volume testing.
    *   **Cons:** More complex to implement attribute encoding/decoding for all VSA types; might not perfectly replicate `radclient`/`radtest` behavior if that's a requirement.

```typescript
// Example structure for a real radius-service.ts using radclient (conceptual)
// 'use server'; // If used within Next.js API routes directly

// import { spawn } from 'child_process';
// import type { RadiusPacket as FullRadiusPacket, ScenarioVariable, ServerConfig as FullServerConfig, SimulatedRadiusToolResult } from '@/lib/types';

// export class RealRadiusService {
//   private resolveVariable(value: string, scenarioVariables?: ScenarioVariable[]): string { /* ... same as mock ... */ return value; }

//   async executeRadclient(
//     packetData: FullRadiusPacket,
//     serverConfig: FullServerConfig,
//     scenarioVariables?: ScenarioVariable[]
//   ): Promise<SimulatedRadiusToolResult> {
//     // SIMULATED: Real radclient execution
//     const toolOptions = packetData.toolOptions as RadClientOptions || {};
//     const targetHost = this.resolveVariable(toolOptions.server || serverConfig.host, scenarioVariables);
//     const targetPort = serverConfig.radiusAuthPort; // Simplified
//     const secret = this.resolveVariable(toolOptions.secret || serverConfig.defaultSecret, scenarioVariables);
//     const type = toolOptions.type || 'auth';

//     const args: string[] = [`${targetHost}:${targetPort}`, type, secret];
//     // Add attributes from packetData.attributes
//     // Add other toolOptions as arguments (e.g., -x for debug, -r for retries, -t for timeout)

//     // return new Promise((resolve) => {
//     //   const radclient = spawn('radclient', args);
//     //   let stdout = '';
//     //   let stderr = '';
//     //   radclient.stdout.on('data', (data) => stdout += data.toString());
//     //   radclient.stderr.on('data', (data) => stderr += data.toString());
//     //   radclient.on('close', (code) => {
//     //     // Parse stdout/stderr to extract sent/received packets and determine overall success
//     //     const sentPacket = "Extracted sent packet from stdout...";
//     //     const receivedPacket = "Extracted received packet from stdout...";
//     //     resolve({ simulatedFullOutput: stdout + stderr, simulatedSentPacket: sentPacket, simulatedReceivedPacket: receivedPacket, code: code ?? 1, error: stderr || undefined });
//     //   });
//     //   radclient.on('error', (err) => resolve({ /* ... error structure ... */ }));
//     // });
//     const cmdString = `radclient ${args.join(" ")} ...attributes...`;
//     console.log(`[REAL_RADIUS_SERVICE] Would execute: ${cmdString.replace(secret, '********')}`);
//     return Promise.resolve({
//         simulatedFullOutput: `Simulated output for ${cmdString.replace(secret, '********')}\nSent packet...\nReceived packet...\nOK`,
//         simulatedSentPacket: "Code: Access-Request ... User-Name = test",
//         simulatedReceivedPacket: "Code: Access-Accept ... Framed-IP-Address = 1.2.3.4",
//         code: 0,
//     });
//   }

//   async executeRadtest(
//     packetData: FullRadiusPacket,
//     serverConfig: FullServerConfig,
//     scenarioVariables?: ScenarioVariable[]
//   ): Promise<SimulatedRadiusToolResult> {
//     // SIMULATED: Real radtest execution
//     // Similar to executeRadclient, construct args for 'radtest' and spawn
//     console.log(`[REAL_RADIUS_SERVICE] Would execute radtest for user: ${(packetData.toolOptions as RadTestOptions)?.user || 'testuser'}`);
//     return Promise.resolve({
//         simulatedFullOutput: "Simulated radtest output...\nOK",
//         simulatedSentPacket: "Sent via radtest...",
//         simulatedReceivedPacket: "Received via radtest...",
//         code: 0,
//     });
//   }

//   async simulateExecuteTool( // This method might be renamed or adapted
//     packetData: FullRadiusPacket,
//     serverConfig: FullServerConfig,
//     scenarioVariables?: ScenarioVariable[]
//   ): Promise<SimulatedRadiusToolResult> {
//     if (packetData.executionTool === 'radtest') {
//       return this.executeRadtest(packetData, serverConfig, scenarioVariables);
//     }
//     return this.executeRadclient(packetData, serverConfig, scenarioVariables);
//   }
// }
// export const radiusService = new RealRadiusService(); // Replace mock instance
```

### D. Real Database Validation Service (Replacing mock `src/lib/services/db-service.ts`)

*   **Technology:** Node.js database drivers:
    *   MySQL: `mysql2/promise`
    *   PostgreSQL: `pg`
    *   MS SQL Server: `mssql`
    *   (SQLite is already handled by the main `src/lib/db.ts` for RadiusEdge's own data, this service is for *external* DBs defined in settings).
*   **Core Functions:**
    *   `connect(config: DbConnectionConfig): Promise<void>`:
        *   Connects to the specified external database based on `config.type`.
        *   Handles connection pooling if appropriate for the driver.
        *   **SSH Tunneling:** If the `DbConnectionConfig` involves a jump server (defined in its settings or if the scenario requires it via `sshPreambleSteps`), this service must coordinate with the **Real SSH Service** to establish a tunnel *before* attempting the DB connection. The DB connection would then target `localhost` on a local port forwarded by the SSH tunnel.
    *   `executeQuery(query: string): Promise<QueryResult>`:
        *   Executes the SQL query on the connected external database.
        *   Returns rows, affected row count, or errors.
    *   `disconnect(): Promise<void>`: Closes the connection to the external database.
*   **Security:** Securely manage database credentials.

### E. Real API Call Service (for scenario steps - replacing mock `src/lib/services/api-service.ts`)

*   **Technology:** `axios` (recommended for its feature set) or Node.js built-in `fetch` (available in newer Node versions).
*   **Core Function (`makeRequest` replacement):**
    *   Takes `ApiRequestConfig` (URL, method, headers, body, timeout).
    *   Makes the actual HTTP/S request.
    *   Handles different HTTP methods.
    *   Manages request and response bodies (e.g., JSON parsing/stringifying).
    *   Returns `ApiResponse` with actual status, headers, and data.

### F. Backend Scenario Orchestration Engine

This is new logic that needs to be built, likely within a new API route (e.g., `POST /api/execution/start`) or a separate backend service.

*   **Input:**
    *   `scenarioId`: ID of the scenario to execute.
    *   `targetServerId`: ID of the `ServerConfig` to run against.
    *   Optionally: `packetId` if it's a single packet run (Execution Console can construct a minimal scenario).
*   **Workflow:**
    1.  **Create Execution Record:** Insert a new record into the `test_executions` table with status 'Running'. Get the `newTestExecutionId`.
    2.  **Fetch Data:**
        *   Load `Scenario` from database using `scenarioId`.
        *   Load `ServerConfig` (target server) from database using `targetServerId`.
        *   If RADIUS steps use `packet_id`, pre-fetch those `RadiusPacket` details.
    3.  **Initialize Services:** Prepare instances of your real SSH, RADIUS, DB, API services.
    4.  **Resolve Scenario Variables:** Process `scenario.variables`.
    5.  **Execute Server SSH Preamble:**
        *   If `serverConfig.scenarioExecutionSshCommands` exist and are enabled:
            *   Connect using the Real SSH Service to `serverConfig.host`.
            *   Execute each preamble command.
            *   Log command, stdout, stderr, status to `execution_logs` (associated with `newTestExecutionId`).
            *   If a preamble step fails and is critical, stop execution and mark `test_executions` record as 'Failed'.
    6.  **Iterate Through Scenario Steps (`scenario.steps`):**
        *   For each `step`:
            *   Log step start to `execution_logs`.
            *   Substitute variables in `step.details`.
            *   **Switch on `step.type`:**
                *   **`radius`:**
                    *   Get packet details (fetched or from step definition).
                    *   Construct command-line arguments for `radclient`/`radtest` (or prepare packet for library).
                    *   Log the intended command.
                    *   Call Real RADIUS Service's `executeRadclient/executeRadtest` function.
                    *   Log sent packet, received packet, full tool output, and status to `execution_logs`.
                    *   Validate response against `step.details.expectedAttributes`. Mark step success/failure.
                *   **`sql`:**
                    *   Fetch `DbConnectionConfig` using `step.details.connection_id`.
                    *   If this DB connection has its own SSH preamble (`sshPreambleSteps`), execute it now (connect to jump, run commands, potentially set up tunnel).
                    *   Connect to the external DB using Real DB Service.
                    *   Log the SQL query.
                    *   Execute query.
                    *   Log results/error to `execution_logs`.
                    *   Validate against `step.details.expect_column/expect_value`. Mark step success/failure.
                    *   Disconnect from external DB. Close SSH tunnel if opened for this step.
                *   **`api_call`:**
                    *   Log request details.
                    *   Call Real API Service.
                    *   Log response status and body to `execution_logs`.
                    *   (Implement response validation if needed). Mark step success/failure.
                *   **`delay`:** Implement `await new Promise(resolve => setTimeout(resolve, duration_ms));`. Log delay.
                *   **`log_message`:** Write `step.details.message` to `execution_logs`.
                *   **`conditional_start`/`loop_start`:**
                    *   Evaluate `step.details.condition` based on previous step results or scenario variables.
                    *   For loops, manage iteration count.
                    *   This requires careful state management and control flow (e.g., tracking nested blocks, jump to corresponding `_end` step if condition false).
                *   **`conditional_end`/`loop_end`:** Mark end of block. For loops, jump back to `loop_start` if iterations remain and condition (if any) is met.
            *   Log step end (success/failure) to `execution_logs`.
            *   If step fails and is critical, break loop and mark overall execution 'Failed'.
    7.  **Finalize Execution:**
        *   Update `test_executions` record with `endTime` and final `status` ('Completed', 'Failed', 'Aborted').
        *   Create a summary `test_results` record and link it via `resultId` in `test_executions`.
        *   Disconnect any persistent SSH connections.
*   **Logging:** Every significant action, command, output, error, and decision by the engine should be logged to the `execution_logs` table with a timestamp, level, and message. This is crucial for debugging and for the frontend Execution Console to display progress.
*   **Asynchronous Operations:** The entire execution will be asynchronous. Consider how the frontend will get updates (polling `GET /api/logs/...` or WebSockets).

## VI. Data Persistence (SQLite - Review)

The existing SQLite schema (`src/lib/db.ts`) generally supports these live operations:
*   `scenarios`, `packets`, `server_configs`, `db_configs`, `users`, `dictionaries`: Store user-defined configurations.
*   `ai_interactions`: Stores AI flow history.
*   `test_executions`: A new record is created here by the backend engine *before* a scenario starts. It's updated with `endTime` and `status` upon completion.
*   `execution_logs`: The backend engine will write detailed, timestamped logs for *every* action performed during a live execution (SSH command, RADIUS send/recv, SQL query, API call, variable resolution, conditional decisions, errors). Each log entry is linked to a `testExecutionId`.
*   `test_results`: A summary record (Pass/Fail/Warning, latency, etc.) created by the backend engine after an execution concludes. Linked to `test_executions`.

Ensure API routes for `POST /api/logs` (batch insert) and `GET /api/logs/[testExecutionId]` are robust for the frontend to use.

## VII. AI Flows (Genkit - Review)

*   Genkit flows for packet generation, attribute explanation, and dictionary parsing are mostly independent of the live execution engine.
*   **Production:** Ensure Google AI API keys are securely configured as environment variables. Monitor usage and costs.

## VIII. Production Considerations

*   **Security:**
    *   **Secrets Management:** SSH private keys, server/DB passwords, API keys (for AI, external APIs in scenarios) MUST NOT be hardcoded. Use environment variables injected at build/runtime, or a dedicated secrets management service (e.g., HashiCorp Vault, cloud provider's secret manager).
    *   **Input Sanitization:** For any fields where users define commands (SSH steps, SQL queries in validation steps), treat this input with extreme caution. If possible, avoid direct execution of raw user strings. If necessary, implement strict validation and sanitization to prevent injection attacks. Consider using parameterized queries for SQL. For SSH, ensure commands are not constructed in a way that allows malicious input to alter them.
    *   **Network Security:** Ensure the server running the backend engine has appropriate firewall rules to reach target RADIUS servers, SSH hosts, and external databases/APIs, and that it's protected from unauthorized access.
    *   **Least Privilege:** The backend engine should operate with the minimum necessary permissions.
*   **Error Handling & Resilience:**
    *   The backend engine needs comprehensive error handling for each service call (SSH, RADIUS, DB, API).
    *   Implement retries for transient network issues where appropriate.
    *   Gracefully handle unexpected errors and log them thoroughly.
*   **Scalability & Performance:**
    *   **SQLite:** For a small number of users or infrequent tests, SQLite might suffice. For higher concurrency or large log volumes, SQLite can become a bottleneck (`SQLITE_BUSY` errors). Consider migrating to PostgreSQL or MySQL if scalability is a concern.
    *   **Long-Running Executions:** HTTP requests for triggering scenarios might time out if executions are very long. For robust handling of long tasks:
        *   **Background Jobs/Task Queues:** Use a system like BullMQ, Celery (if Python backend), or cloud-native queues (e.g., Google Cloud Tasks, AWS SQS) to offload scenario execution to background workers. The API endpoint would just enqueue the job.
        *   The frontend would then poll for status/logs or use WebSockets.
    *   **Connection Management:** Efficiently manage (and pool, if applicable) SSH and database connections.
*   **Configuration Management:**
    *   Easy way to update API keys, service endpoints, etc., without code changes (environment variables are good for this).

## IX. Step-by-Step Transition Plan (High-Level)

1.  **Choose Backend Engine Location:** Decide if enhancing Next.js API routes or building a separate service is preferred.
2.  **Implement Real SSH Service:**
    *   Replace mock `ssh-service.ts` with `ssh2` implementation.
    *   Focus on secure connection and command execution.
    *   Test thoroughly.
3.  **Implement Real RADIUS Service:**
    *   Replace mock `radius-service.ts`.
    *   Start with `radclient`/`radtest` CLI wrapper via `child_process.spawn`.
    *   Implement robust output parsing.
4.  **Implement Real DB Validation & API Call Services:**
    *   Replace mocks for `db-service.ts` (for external DBs) and `api-service.ts`.
5.  **Build Backend Scenario Orchestration Engine:**
    *   Create the new API endpoint (e.g., `POST /api/execution/start`).
    *   Implement the logic to fetch data, resolve variables, and call the real services for each step type.
    *   Implement comprehensive logging to `execution_logs` and result recording to `test_results` and `test_executions`.
6.  **Update Frontend Execution Console:**
    *   Modify `src/app/execute/page.tsx` to:
        *   Call the new `POST /api/execution/start` endpoint.
        *   Fetch and display logs in real-time (polling or WebSockets) from `GET /api/logs/[testExecutionId]`.
        *   Implement the "Abort" button to call a backend endpoint that signals the engine to stop.
7.  **Refactor Settings Page "Test Connection" Buttons:**
    *   Update the "Test Connection" buttons in Server Configuration and Database Validation Setup to call backend APIs that use the real SSH and DB services, instead of the current AI simulation flows.
8.  **Security Hardening & Production Deployment:**
    *   Implement secrets management.
    *   Review all input handling for security.
    *   Set up production hosting environment, database, and monitoring.

This guide provides a detailed blueprint. Transitioning each service and the execution engine will be an iterative process. Test each component thoroughly as you build it. Good luck!
