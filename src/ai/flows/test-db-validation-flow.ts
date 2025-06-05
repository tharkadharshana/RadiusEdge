
// src/ai/flows/test-db-validation-flow.ts
'use server';
/**
 * @fileOverview An AI agent that simulates testing a Database connection
 * and a sequence of validation steps (SQL queries or SSH commands on the DB host).
 * It also simulates executing a direct test SSH preamble, potentially on a jump server, before connecting to the DB.
 * The SSH preamble for scenario execution (sshPreambleSteps) is defined with the DB config but NOT run by this specific test flow.
 * REAL_IMPLEMENTATION_NOTE: This entire flow is a SIMULATION. In a production system, this would be replaced by
 * a backend service that:
 * 1. If jump server details are provided, establishes an SSH connection to the jump server.
 * 2. Executes the 'directTestSshPreamble' steps on the jump server (or directly on DB host if no jump server).
 * 3. If preamble succeeds, establishes a real connection to the specified database (possibly via the jump server if tunneled).
 * 4. Executes the defined SQL queries against that database.
 * 5. Optionally, if SSH steps are involved for validation (e.g., checking logs on DB host),
 *    it would perform those SSH operations (possibly via the jump server).
 *
 * - testDbValidation - A function that simulates the DB validation process.
 * - TestDbValidationInput - The input type for the testDbValidation function.
 * - TestDbValidationOutput - The return type for the testDbValidation function.
 */

import { z } from 'genkit';
import { dbService, sshService } from '@/lib/services';


// --- Input Schemas ---
// Schema for individual SSH preamble steps for the direct test (run on Jump Server or directly on DB host)
export const DbSshPreambleStepConfigClientSchema = z.object({ // Exported for page.tsx
  id: z.string(),
  name: z.string().describe('User-defined name of the SSH preamble step.'),
  command: z.string().describe('The SSH command to execute.'),
  isEnabled: z.boolean().describe('Whether this step should be executed.'),
  expectedOutputContains: z.string().optional().describe('Substring expected in output for success.'),
});
export type DbSshPreambleStepConfigClient = z.infer<typeof DbSshPreambleStepConfigClientSchema>;


// Schema for individual validation steps provided by the client for direct DB testing.
export const DbValidationStepClientSchema = z.object({ // Exported for page.tsx
  name: z.string().describe('User-defined name of the validation step.'),
  type: z.enum(['sql', 'ssh']).describe('Type of validation step: SQL query or SSH command on DB host.'),
  commandOrQuery: z.string().describe('The SQL query or SSH command to execute.'),
  isEnabled: z.boolean().describe('Whether this step should be executed.'),
  isMandatory: z.boolean().optional().describe('If this step is mandatory (UI might prevent disabling).'),
  expectedOutputContains: z.string().optional().describe('Substring expected in output/result for success.'),
});
export type DbValidationStepClient = z.infer<typeof DbValidationStepClientSchema>;

// Input schema for the entire DB validation test flow.
const TestDbValidationInputSchema = z.object({
  id: z.string().describe("ID of the DB configuration being tested."),
  // Jump Server Details
  jumpServerHost: z.string().optional().describe('Hostname or IP of the jump server.'),
  jumpServerPort: z.number().optional().describe('SSH Port of the jump server.'),
  jumpServerUser: z.string().optional().describe('SSH username for the jump server.'),
  jumpServerAuthMethod: z.enum(['key', 'password']).optional().describe('Authentication method for jump server.'),
  jumpServerPrivateKey: z.string().optional().describe('SSH private key for jump server (if authMethod is key).'),
  jumpServerPassword: z.string().optional().describe('SSH password for jump server (if authMethod is password).'),
  // Target DB Details (accessed from jump server or directly)
  dbType: z.enum(['mysql', 'postgresql', 'mssql', 'sqlite']).describe('Type of the database.'),
  dbHost: z.string().describe('Hostname or IP of the database server (from perspective of jump server or client).'),
  dbPort: z.number().describe('Port of the database server.'),
  dbUsername: z.string().describe('Database username.'),
  dbPassword: z.string().optional().describe('Database password.'),
  dbName: z.string().describe('Name of the database.'),
  // Steps
  directTestSshPreamble: z.array(DbSshPreambleStepConfigClientSchema).optional().describe('SSH Preamble steps to execute (on jump server or DB host) before DB connection for this test.'),
  validationSteps: z.array(DbValidationStepClientSchema).describe('Validation steps to execute after DB connection.'),
});
export type TestDbValidationInput = z.infer<typeof TestDbValidationInputSchema>;


// --- Output Schemas ---
// Schema for the result of a single step (jump server conn, preamble, DB conn, or validation).
const StepResultSchema = z.object({
  stepName: z.string(),
  status: z.enum(['success', 'failure', 'skipped']),
  output: z.string().optional(),
  error: z.string().optional(),
  command: z.string().optional(), 
  query: z.string().optional(),   
  type: z.enum(['jump_server_connection', 'ssh_preamble', 'ssh_validation', 'sql_validation', 'db_connection']).optional(),
});
export type StepResult = z.infer<typeof StepResultSchema>;

// Output schema for the entire DB validation test flow.
const TestDbValidationOutputSchema = z.object({
  overallStatus: z.enum([
    'success', 'partial_success', 
    'jump_server_connection_failure', 'preamble_failure', // preamble_failure now refers to jump server preamble
    'connection_failure', // DB connection failure
    'validation_failure', 'testing'
  ]),
  jumpServerConnectionResult: StepResultSchema.optional(),
  directTestSshPreambleResults: z.array(StepResultSchema).optional(), // For commands run on Jump Server
  dbConnectionStatus: z.enum(['success', 'failure', 'skipped']), // Target DB connection status
  dbConnectionError: z.string().optional(),
  validationStepResults: z.array(StepResultSchema), // For SQL/SSH steps against target DB
});
export type TestDbValidationOutput = z.infer<typeof TestDbValidationOutputSchema>;


// REAL_IMPLEMENTATION_NOTE: This function would be part of a backend service.
// It would require SSH libraries (e.g., ssh2 for Node.js) and DB client libraries.
// For this simulation, it uses a mocked sshService and dbService.
async function executeSshCommandStep(
  stepConfig: DbSshPreambleStepConfigClient | DbValidationStepClient, // Can be preamble or SSH validation step
  targetHostInfo: { host: string; port?: number; user?: string; privateKey?: string; password?: string; authMethod?: 'key' | 'password' },
  stepType: 'ssh_preamble' | 'ssh_validation'
): Promise<StepResult> {
  if (!stepConfig.isEnabled) {
    return {
      stepName: stepConfig.name, status: 'skipped', output: 'Step disabled by user.',
      type: stepType, command: 'command' in stepConfig ? stepConfig.command : stepConfig.commandOrQuery,
    };
  }
  console.log(`[TEST_DB_SSH] Executing SSH step: ${stepConfig.name} on host ${targetHostInfo.host}`);
  try {
    // REAL_IMPLEMENTATION_NOTE: A real backend would connect to targetHostInfo.host for these commands.
    if (!sshService.isConnected() || sshService.getConnectionConfig()?.host !== targetHostInfo.host) {
        await sshService.connect({ 
            host: targetHostInfo.host, 
            port: targetHostInfo.port || 22, 
            username: targetHostInfo.user || 'root', 
            privateKey: targetHostInfo.privateKey,
            password: targetHostInfo.password,
            // authMethod implicitly handled by sshService if privateKey or password is set
        });
    }
    const commandToRun = 'command' in stepConfig ? stepConfig.command : stepConfig.commandOrQuery;
    const result = await sshService.executeCommand(commandToRun);
    const success = result.code === 0 &&
                   (!stepConfig.expectedOutputContains ||
                    result.stdout.includes(stepConfig.expectedOutputContains) ||
                    result.stderr.includes(stepConfig.expectedOutputContains));
    
    return {
      stepName: stepConfig.name, status: success ? 'success' : 'failure',
      output: `${result.stdout}${result.stderr ? `\nStderr: ${result.stderr}` : ''}`,
      error: success ? undefined : 'SSH command failed or output validation failed',
      type: stepType, command: commandToRun,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SSH error';
    return {
      stepName: stepConfig.name, status: 'failure', error: errorMessage,
      type: stepType, command: 'command' in stepConfig ? stepConfig.command : stepConfig.commandOrQuery,
    };
  }
}

// Simulates the execution of a single DB validation step (SQL only here, SSH validation uses executeSshCommandStep).
// REAL_IMPLEMENTATION_NOTE: This function would be replaced by actual backend logic.
async function executeSqlValidationStep(
  stepConfig: DbValidationStepClient, // Assumes type is 'sql'
): Promise<StepResult> {
  if (!stepConfig.isEnabled) {
    return {
      stepName: stepConfig.name, status: 'skipped', output: 'Step disabled by user.',
      type: 'sql_validation', query: stepConfig.commandOrQuery,
    };
  }
  // dbService.connect is called once before all SQL validation steps.
  try {
    const result = await dbService.executeQuery(stepConfig.commandOrQuery);
    const success = !result.error && 
                    (!stepConfig.expectedOutputContains || 
                    JSON.stringify(result.rows).includes(stepConfig.expectedOutputContains));

    return {
      stepName: stepConfig.name, status: success ? 'success' : 'failure',
      output: JSON.stringify(result.rows, null, 2), error: result.error?.message,
      query: stepConfig.commandOrQuery, type: 'sql_validation',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      stepName: stepConfig.name, status: 'failure', error: errorMessage,
      type: 'sql_validation', query: stepConfig.commandOrQuery,
    };
  }
}


export async function testDbValidation(input: TestDbValidationInput): Promise<TestDbValidationOutput> {
  const output: TestDbValidationOutput = {
    overallStatus: 'testing',
    dbConnectionStatus: 'skipped', // Target DB connection
    validationStepResults: [],
    directTestSshPreambleResults: [],
  };
  let jumpPreambleSuccessful = true;

  try {
    // 1. Simulate Connection to Jump Server (if configured)
    if (input.jumpServerHost && input.jumpServerUser) {
      console.log(`[TEST_DB] Simulating SSH connection to Jump Server: ${input.jumpServerUser}@${input.jumpServerHost}:${input.jumpServerPort || 22}`);
      try {
        // REAL_IMPLEMENTATION_NOTE: Actual SSH connection to jump server
        await sshService.connect({ 
            host: input.jumpServerHost, 
            port: input.jumpServerPort || 22, 
            username: input.jumpServerUser,
            authMethod: input.jumpServerAuthMethod, 
            privateKey: input.jumpServerPrivateKey, 
            password: input.jumpServerPassword 
        });
        output.jumpServerConnectionResult = { 
            stepName: 'Jump Server Connection', status: 'success', 
            output: `Successfully connected to jump server ${input.jumpServerHost}.`,
            type: 'jump_server_connection'
        };
        console.log("[TEST_DB] Jump Server connection successful (simulated).");
      } catch (jumpError: any) {
        output.jumpServerConnectionResult = { 
            stepName: 'Jump Server Connection', status: 'failure', 
            error: `Failed to connect to jump server: ${jumpError.message}`,
            type: 'jump_server_connection'
        };
        output.overallStatus = 'jump_server_connection_failure';
        console.error("[TEST_DB] Jump Server connection failed (simulated):", jumpError.message);
        return output; // Early exit
      }
    } else {
        console.log("[TEST_DB] No Jump Server configured, proceeding with direct/local preamble if any.");
    }

    // 2. Execute Direct Test SSH Preamble Steps (on Jump Server or directly on DB host if no jump server)
    if (input.directTestSshPreamble && input.directTestSshPreamble.length > 0) {
      const sshTargetHost = input.jumpServerHost || input.dbHost; // Preamble runs on jump server if specified, else on DB host
      const sshTargetPort = input.jumpServerHost ? input.jumpServerPort : 22; // Assuming DB host SSH is on 22 if no jump
      const sshTargetUser = input.jumpServerHost ? input.jumpServerUser : input.dbUsername; // Or a dedicated SSH user for DB host
      const sshTargetPrivateKey = input.jumpServerHost ? input.jumpServerPrivateKey : undefined; // Specific key for DB host SSH?
      const sshTargetPassword = input.jumpServerHost ? input.jumpServerPassword : undefined;
      const sshTargetAuthMethod = input.jumpServerHost ? input.jumpServerAuthMethod : undefined;


      console.log(`[TEST_DB] Starting SSH Preamble execution on ${sshTargetHost}...`);
      for (const preambleStep of input.directTestSshPreamble) {
        const result = await executeSshCommandStep(preambleStep, {
            host: sshTargetHost, port: sshTargetPort, user: sshTargetUser, 
            privateKey: sshTargetPrivateKey, password: sshTargetPassword, authMethod: sshTargetAuthMethod
        }, 'ssh_preamble');
        output.directTestSshPreambleResults!.push(result);
        if (result.status === 'failure') {
          jumpPreambleSuccessful = false;
          console.log(`[TEST_DB] SSH Preamble step "${preambleStep.name}" failed. Halting further execution.`);
          break;
        }
      }
       if (!jumpPreambleSuccessful) {
        output.overallStatus = 'preamble_failure';
        input.validationSteps.forEach(stepConfig => {
          if (stepConfig.isEnabled) {
            output.validationStepResults.push({
              stepName: stepConfig.name, status: 'skipped', output: 'Skipped due to SSH Preamble failure.',
              type: stepConfig.type === 'sql' ? 'sql_validation' : 'ssh_validation',
              ...(stepConfig.type === 'sql' ? { query: stepConfig.commandOrQuery } : { command: stepConfig.commandOrQuery }),
            });
          }
        });
        return output; // Early exit if preamble fails
      }
      console.log("[TEST_DB] SSH Preamble completed successfully.");
    } else {
        jumpPreambleSuccessful = true; // No preamble steps, so considered successful
    }


    // 3. Try to connect to the target database
    // REAL_IMPLEMENTATION_NOTE: A real backend service would handle this DB connection.
    // If a jump server was used, this connection happens *from* the jump server (e.g., via an SSH tunnel
    // established by preamble steps, or if the DB is directly reachable from jump server).
    console.log(`[TEST_DB] Simulating connection to Target DB: ${input.dbType} at ${input.dbHost}:${input.dbPort} (database: ${input.dbName})`);
    await dbService.connect({
      type: input.dbType, host: input.dbHost, port: input.dbPort,
      username: input.dbUsername, password: input.dbPassword, database: input.dbName,
    });
    output.dbConnectionStatus = 'success';
    console.log("[TEST_DB] Target Database connection successful (simulated).");

    // 4. Execute validation steps
    let haltValidation = false;
    if (input.validationSteps && input.validationSteps.length > 0) {
      console.log("[TEST_DB] Starting target DB validation steps execution...");
      for (const stepConfig of input.validationSteps) {
        if (haltValidation) {
          output.validationStepResults.push({
            stepName: stepConfig.name, status: 'skipped', output: 'Skipped due to previous validation failure.',
            type: stepConfig.type === 'sql' ? 'sql_validation' : 'ssh_validation',
            ...(stepConfig.type === 'sql' ? { query: stepConfig.commandOrQuery } : { command: stepConfig.commandOrQuery }),
          });
          continue;
        }
        let result: StepResult;
        if (stepConfig.type === 'sql') {
            result = await executeSqlValidationStep(stepConfig);
        } else { // 'ssh'
            // REAL_IMPLEMENTATION_NOTE: SSH validation steps target the DB host.
            // If jump server is used, this SSH connection must be routed through/from jump server.
            // For simulation, we'll connect directly to dbHost, assuming it's reachable.
            result = await executeSshCommandStep(stepConfig, { host: input.dbHost, user: input.dbUsername, password: input.dbPassword }, 'ssh_validation');
        }
        output.validationStepResults.push(result);
        if (result.status === 'failure') {
          haltValidation = true;
        }
      }
    }

    // 5. Determine overall status
    const hasValidationFailures = output.validationStepResults.some(r => r.status === 'failure');
    const hasValidationSuccess = output.validationStepResults.some(r => r.status === 'success');

    if (hasValidationFailures) {
      output.overallStatus = hasValidationSuccess ? 'partial_success' : 'validation_failure';
    } else {
      output.overallStatus = 'success';
    }

  } catch (error: unknown) { // This catch block is primarily for Target DB connection errors now
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    output.dbConnectionStatus = 'failure';
    output.dbConnectionError = errorMessage;
    output.overallStatus = 'connection_failure';
    console.error("[TEST_DB] Target Database connection or flow error (simulated):", errorMessage);

    // Skip validation steps if DB connection failed
    if (input.validationSteps && input.validationSteps.length > 0) {
      input.validationSteps.forEach(stepConfig => {
        if (stepConfig.isEnabled) {
          output.validationStepResults.push({
            stepName: stepConfig.name, status: 'skipped', output: 'Skipped due to DB connection failure.',
            type: stepConfig.type === 'sql' ? 'sql_validation' : 'ssh_validation',
            ...(stepConfig.type === 'sql' ? { query: stepConfig.commandOrQuery } : { command: stepConfig.commandOrQuery }),
          });
        }
      });
    }
  } finally {
    try {
      if(sshService.isConnected()) await sshService.disconnect();
      if(dbService.isConnected()) await dbService.disconnect();
      console.log("[TEST_DB] SSH and DB services disconnected (simulated).");
    } catch (disconnectError) {
      console.error('[TEST_DB] Error disconnecting services (simulated):', disconnectError);
    }
  }

  return output;
}

const testDbValidationInternalFlow = {
  name: 'testDbValidationInternalFlow',
  inputSchema: TestDbValidationInputSchema,
  outputSchema: TestDbValidationOutputSchema,
  execute: testDbValidation,
};
// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE

    