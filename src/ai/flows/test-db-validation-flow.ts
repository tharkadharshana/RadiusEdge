
// src/ai/flows/test-db-validation-flow.ts
'use server';
/**
 * @fileOverview An AI agent that simulates testing a Database connection
 * and a sequence of validation steps (SQL queries or SSH commands on the DB host).
 * It also simulates executing a direct test SSH preamble, potentially on a jump server, before connecting to the DB.
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
const DbSshPreambleStepConfigClientSchema = z.object({
  id: z.string(),
  name: z.string().describe('User-defined name of the SSH preamble step.'),
  command: z.string().describe('The SSH command to execute.'),
  isEnabled: z.boolean().describe('Whether this step should be executed.'),
  expectedOutputContains: z.string().optional().describe('Substring expected in output for success.'),
});
export type DbSshPreambleStepConfigClient = z.infer<typeof DbSshPreambleStepConfigClientSchema>;


// Schema for individual validation steps provided by the client for direct DB testing.
const DbValidationStepClientSchema = z.object({
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
    'jump_server_connection_failure', 'preamble_failure',
    'connection_failure',
    'validation_failure', 'testing'
  ]),
  jumpServerConnectionResult: StepResultSchema.optional(),
  directTestSshPreambleResults: z.array(StepResultSchema).optional(),
  dbConnectionStatus: z.enum(['success', 'failure', 'skipped']),
  dbConnectionError: z.string().optional(),
  validationStepResults: z.array(StepResultSchema),
});
export type TestDbValidationOutput = z.infer<typeof TestDbValidationOutputSchema>;


async function executeSshCommandStep(
  stepConfig: DbSshPreambleStepConfigClient | DbValidationStepClient,
  // Target host for *this specific step*. Could be jump server or DB host.
  targetHostInfo: { host: string; port?: number; user?: string; privateKey?: string; password?: string; /* authMethod?: 'key' | 'password'; */ },
  stepType: 'ssh_preamble' | 'ssh_validation'
): Promise<StepResult> {
  if (!stepConfig.isEnabled) {
    return {
      stepName: stepConfig.name, status: 'skipped', output: 'Step disabled by user.',
      type: stepType, command: 'command' in stepConfig ? stepConfig.command : stepConfig.commandOrQuery,
    };
  }
  console.log(`[TEST_DB_SSH] Simulating SSH step: ${stepConfig.name} on host ${targetHostInfo.host}`);
  try {
    // Connect if not already connected to this specific target, or if connection is to a different host.
    // The sshService itself should handle intelligent reuse if possible, or establish new.
    // For simulation, we ensure a "connection" to the current targetHostInfo.
    // In a real system, this needs careful management of multiple concurrent or sequential SSH sessions.
    
    // If not connected, OR connected to a different host, OR (connected to same host but different port/user)
    if (!sshService.isConnected() || 
        sshService.getConnectionConfig()?.host !== targetHostInfo.host ||
        (targetHostInfo.port && sshService.getConnectionConfig()?.port !== targetHostInfo.port) ||
        (targetHostInfo.user && sshService.getConnectionConfig()?.username !== targetHostInfo.user)
        ) {
        console.log(`[TEST_DB_SSH] Attempting new/different SSH connection for step "${stepConfig.name}" to ${targetHostInfo.host}`);
        if (sshService.isConnected()) { // Disconnect if connected to a different host/config
            await sshService.disconnect();
        }
        await sshService.connect({
            host: targetHostInfo.host,
            port: targetHostInfo.port || 22,
            username: targetHostInfo.user || 'root', 
            privateKey: targetHostInfo.privateKey,
            password: targetHostInfo.password,
            // authMethod: targetHostInfo.authMethod - sshService.connect infers from privateKey/password
        });
    } else {
        console.log(`[TEST_DB_SSH] Reusing existing SSH connection to ${targetHostInfo.host} for step "${stepConfig.name}"`);
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

async function executeSqlValidationStep(
  stepConfig: DbValidationStepClient,
): Promise<StepResult> {
  if (!stepConfig.isEnabled) {
    return {
      stepName: stepConfig.name, status: 'skipped', output: 'Step disabled by user.',
      type: 'sql_validation', query: stepConfig.commandOrQuery,
    };
  }
  try {
    // dbService.connect() should have been called prior to this based on Target DB Details
    if (!dbService.isConnected()) {
        throw new Error("Database service is not connected. Cannot execute SQL validation step.");
    }
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
    dbConnectionStatus: 'skipped',
    validationStepResults: [],
    directTestSshPreambleResults: [],
  };
  let preambleSuccessful = true; // Assume success if no preamble
  let jumpServerSshNeededForLaterSteps = false; // Flag if jump server SSH should remain open

  try {
    // 1. Connect to Jump Server (if configured)
    if (input.jumpServerHost && input.jumpServerUser) {
      jumpServerSshNeededForLaterSteps = true; // Assume it might be needed
      console.log(`[TEST_DB] Simulating SSH connection to Jump Server: ${input.jumpServerUser}@${input.jumpServerHost}:${input.jumpServerPort || 22}`);
      try {
        await sshService.connect({
            host: input.jumpServerHost,
            port: input.jumpServerPort || 22,
            username: input.jumpServerUser,
            privateKey: input.jumpServerPrivateKey,
            password: input.jumpServerPassword,
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
        return output; // Halt on jump server connection failure
      }
    } else {
        console.log("[TEST_DB] No Jump Server configured.");
    }

    // 2. Execute Direct Test SSH Preamble (on Jump Server or directly on DB host if no jump)
    if (input.directTestSshPreamble && input.directTestSshPreamble.length > 0) {
      const preambleTargetHost = input.jumpServerHost || input.dbHost; 
      const preambleTargetPort = input.jumpServerHost ? input.jumpServerPort : input.dbPort; // SSH port of preamble target
      const preambleTargetUser = input.jumpServerHost ? input.jumpServerUser : input.dbUsername; // User for preamble target
      const preambleTargetPrivateKey = input.jumpServerHost ? input.jumpServerPrivateKey : undefined; // Assuming DB host SSH uses different keys or methods
      const preambleTargetPassword = input.jumpServerHost ? input.jumpServerPassword : undefined;

      console.log(`[TEST_DB] Simulating Direct Test SSH Preamble execution on ${preambleTargetHost}...`);
      output.directTestSshPreambleResults = []; 
      preambleSuccessful = true; // Reset for this block
      for (const preambleStep of input.directTestSshPreamble) {
        // Ensure sshService is connected to the preambleTargetHost for these steps
        const result = await executeSshCommandStep(preambleStep, {
            host: preambleTargetHost, port: preambleTargetPort, user: preambleTargetUser,
            privateKey: preambleTargetPrivateKey, password: preambleTargetPassword,
        }, 'ssh_preamble');
        output.directTestSshPreambleResults.push(result);
        if (result.status === 'failure') {
          preambleSuccessful = false;
          console.log(`[TEST_DB] Direct Test SSH Preamble step "${preambleStep.name}" failed. Halting further execution.`);
          break;
        }
      }
       if (!preambleSuccessful) {
        output.overallStatus = 'preamble_failure';
        output.validationStepResults = []; 
        input.validationSteps.forEach(stepConfig => {
          if (stepConfig.isEnabled) {
            output.validationStepResults.push({
              stepName: stepConfig.name, status: 'skipped', output: 'Skipped due to SSH Preamble failure.',
              type: stepConfig.type === 'sql' ? 'sql_validation' : 'ssh_validation',
              ...(stepConfig.type === 'sql' ? { query: stepConfig.commandOrQuery } : { command: stepConfig.commandOrQuery }),
            });
          }
        });
        return output; // Halt on preamble failure
      }
      console.log("[TEST_DB] Direct Test SSH Preamble completed successfully (simulated).");
    }
    
    // 3. Connect to Target Database
    // This connection uses details from `input.dbHost`, `input.dbPort`, etc.
    // If a jump server was used and a tunnel is required, the user's actual dbService
    // or the preamble steps must have established it. The flow assumes `dbService.connect`
    // can now reach the target.
    console.log(`[TEST_DB] Simulating connection to Target DB: ${input.dbType} at ${input.dbHost}:${input.dbPort} (database: ${input.dbName})`);
    try {
        await dbService.connect({
          type: input.dbType, host: input.dbHost, port: input.dbPort,
          username: input.dbUsername, password: input.dbPassword, database: input.dbName,
        });
        output.dbConnectionStatus = 'success';
        console.log("[TEST_DB] Target Database connection successful (simulated).");
    } catch (dbConnectError: any) {
        output.dbConnectionStatus = 'failure';
        output.dbConnectionError = dbConnectError.message || 'Failed to connect to target database.';
        output.overallStatus = 'connection_failure';
        console.error("[TEST_DB] Target Database connection failed (simulated):", output.dbConnectionError);
        // Mark subsequent validation steps as skipped
        output.validationStepResults = [];
        input.validationSteps.forEach(stepConfig => {
            if (stepConfig.isEnabled) {
                output.validationStepResults.push({
                stepName: stepConfig.name, status: 'skipped', output: 'Skipped due to DB connection failure.',
                type: stepConfig.type === 'sql' ? 'sql_validation' : 'ssh_validation',
                ...(stepConfig.type === 'sql' ? { query: stepConfig.commandOrQuery } : { command: stepConfig.commandOrQuery }),
                });
            }
        });
        return output; // Halt on DB connection failure
    }


    // 4. Execute Validation Steps
    let haltValidation = false;
    if (input.validationSteps && input.validationSteps.length > 0) {
      console.log("[TEST_DB] Simulating target DB validation steps execution...");
      output.validationStepResults = []; 
      for (const stepConfig of input.validationSteps) {
        if (haltValidation && stepConfig.isMandatory) { // only halt for mandatory step failures
          output.validationStepResults.push({
            stepName: stepConfig.name, status: 'skipped', output: 'Skipped due to previous mandatory validation failure.',
            type: stepConfig.type === 'sql' ? 'sql_validation' : 'ssh_validation',
            ...(stepConfig.type === 'sql' ? { query: stepConfig.commandOrQuery } : { command: stepConfig.commandOrQuery }),
          });
          continue;
        }
         if (haltValidation && !stepConfig.isMandatory) {
            output.validationStepResults.push({
                stepName: stepConfig.name, status: 'skipped', output: 'Skipped (non-mandatory after failure).',
                 type: stepConfig.type === 'sql' ? 'sql_validation' : 'ssh_validation',
                ...(stepConfig.type === 'sql' ? { query: stepConfig.commandOrQuery } : { command: stepConfig.commandOrQuery }),
            });
            continue;
        }

        let result: StepResult;
        if (stepConfig.type === 'sql') {
            result = await executeSqlValidationStep(stepConfig);
        } else { // 'ssh' type, these commands run on the DB host itself
            // For SSH validation steps on the DB host, sshService needs to connect to input.dbHost.
            // If input.dbHost is 'localhost' (because preamble SSH'd into it), this needs careful handling
            // by the actual sshService to use the correct context or tunnel.
            // The simulation assumes sshService can connect to input.dbHost.
            result = await executeSshCommandStep(stepConfig, { 
                host: input.dbHost, 
                user: input.dbUsername, // Or a specific SSH user for the DB host if different
                password: input.dbPassword // Or a specific SSH password/key
            }, 'ssh_validation');
            // If jump server was used AND the DB host is not directly reachable,
            // the actual sshService might need to route this through the jump server session.
        }
        output.validationStepResults.push(result);
        if (result.status === 'failure' && stepConfig.isMandatory) {
          haltValidation = true;
        }
      }
    }

    // 5. Determine Overall Status
    const hasValidationFailures = output.validationStepResults.some(r => r.status === 'failure');
    const hasCriticalPreambleFailure = output.directTestSshPreambleResults && output.directTestSshPreambleResults.some(r => r.status === 'failure');
    
    if (output.overallStatus === 'testing') { // If not set by an earlier critical failure
        if (hasCriticalPreambleFailure) {
            output.overallStatus = 'preamble_failure';
        } else if (output.dbConnectionStatus === 'failure') {
            output.overallStatus = 'connection_failure';
        } else if (hasValidationFailures) {
            const hasValidationSuccess = output.validationStepResults.some(r => r.status === 'success');
            output.overallStatus = hasValidationSuccess ? 'partial_success' : 'validation_failure';
        } else {
            output.overallStatus = 'success';
        }
    }

  } catch (error: unknown) { // Catch errors from the main try block (e.g., unexpected issues)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during DB test flow';
    output.overallStatus = 'validation_failure'; // Generic failure for unexpected flow errors
    if (output.dbConnectionStatus === 'skipped' && !output.dbConnectionError) {
        output.dbConnectionStatus = 'failure';
        output.dbConnectionError = errorMessage;
    }
    // Ensure validation steps are marked skipped if not already processed
     output.validationStepResults = output.validationStepResults || [];
    if (input.validationSteps && input.validationSteps.length > output.validationStepResults.length) {
        input.validationSteps.forEach(stepConfig => {
            if (stepConfig.isEnabled && !output.validationStepResults.find(r => r.stepName === stepConfig.name)) {
                output.validationStepResults.push({
                stepName: stepConfig.name, status: 'skipped', output: `Skipped due to flow error: ${errorMessage}`,
                type: stepConfig.type === 'sql' ? 'sql_validation' : 'ssh_validation',
                ...(stepConfig.type === 'sql' ? { query: stepConfig.commandOrQuery } : { command: stepConfig.commandOrQuery }),
                });
            }
        });
    }
    console.error("[TEST_DB] Unexpected error in DB test flow (simulated):", errorMessage);
  } finally {
    // Always attempt to disconnect services at the end
    try {
      if(sshService.isConnected()) {
          console.log("[TEST_DB] Attempting to disconnect SSH service in finally block.");
          await sshService.disconnect();
          console.log("[TEST_DB] SSH service disconnected (simulated).");
      }
      if(dbService.isConnected()) {
          console.log("[TEST_DB] Attempting to disconnect DB service in finally block.");
          await dbService.disconnect();
          console.log("[TEST_DB] DB service disconnected (simulated).");
      }
    } catch (disconnectError) {
      console.error('[TEST_DB] Error disconnecting services in finally block (simulated):', disconnectError);
      // Optionally, update overallStatus or add to errors if disconnect failures are critical
    }
  }
  return output;
}
