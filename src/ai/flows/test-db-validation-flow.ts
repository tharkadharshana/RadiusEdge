
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
export const DbSshPreambleStepConfigClientSchema = z.object({
  id: z.string(),
  name: z.string().describe('User-defined name of the SSH preamble step.'),
  command: z.string().describe('The SSH command to execute.'),
  isEnabled: z.boolean().describe('Whether this step should be executed.'),
  expectedOutputContains: z.string().optional().describe('Substring expected in output for success.'),
});
export type DbSshPreambleStepConfigClient = z.infer<typeof DbSshPreambleStepConfigClientSchema>;


// Schema for individual validation steps provided by the client for direct DB testing.
export const DbValidationStepClientSchema = z.object({
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
  targetHostInfo: { host: string; port?: number; user?: string; privateKey?: string; password?: string; authMethod?: 'key' | 'password' },
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
    if (!sshService.isConnected() || sshService.getConnectionConfig()?.host !== targetHostInfo.host) {
        await sshService.connect({
            host: targetHostInfo.host,
            port: targetHostInfo.port || 22,
            username: targetHostInfo.user || 'root', // Default user if not provided
            privateKey: targetHostInfo.privateKey,
            password: targetHostInfo.password,
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
  let jumpPreambleSuccessful = true;

  try {
    if (input.jumpServerHost && input.jumpServerUser) {
      console.log(`[TEST_DB] Simulating SSH connection to Jump Server: ${input.jumpServerUser}@${input.jumpServerHost}:${input.jumpServerPort || 22}`);
      try {
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
        return output;
      }
    } else {
        console.log("[TEST_DB] No Jump Server configured, proceeding with direct/local preamble if any.");
    }

    if (input.directTestSshPreamble && input.directTestSshPreamble.length > 0) {
      const sshTargetHost = input.jumpServerHost || input.dbHost;
      const sshTargetPort = input.jumpServerHost ? input.jumpServerPort : 22;
      const sshTargetUser = input.jumpServerHost ? input.jumpServerUser : input.dbUsername;
      const sshTargetPrivateKey = input.jumpServerHost ? input.jumpServerPrivateKey : undefined;
      const sshTargetPassword = input.jumpServerHost ? input.jumpServerPassword : undefined;
      const sshTargetAuthMethod = input.jumpServerHost ? input.jumpServerAuthMethod : undefined;

      console.log(`[TEST_DB] Simulating SSH Preamble execution on ${sshTargetHost}...`);
      output.directTestSshPreambleResults = []; // Initialize array
      for (const preambleStep of input.directTestSshPreamble) {
        const result = await executeSshCommandStep(preambleStep, {
            host: sshTargetHost, port: sshTargetPort, user: sshTargetUser,
            privateKey: sshTargetPrivateKey, password: sshTargetPassword, authMethod: sshTargetAuthMethod
        }, 'ssh_preamble');
        output.directTestSshPreambleResults.push(result);
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
        return output;
      }
      console.log("[TEST_DB] SSH Preamble completed successfully (simulated).");
    } else {
        jumpPreambleSuccessful = true;
    }

    console.log(`[TEST_DB] Simulating connection to Target DB: ${input.dbType} at ${input.dbHost}:${input.dbPort} (database: ${input.dbName})`);
    await dbService.connect({
      type: input.dbType, host: input.dbHost, port: input.dbPort,
      username: input.dbUsername, password: input.dbPassword, database: input.dbName,
    });
    output.dbConnectionStatus = 'success';
    console.log("[TEST_DB] Target Database connection successful (simulated).");

    let haltValidation = false;
    if (input.validationSteps && input.validationSteps.length > 0) {
      console.log("[TEST_DB] Simulating target DB validation steps execution...");
      output.validationStepResults = []; // Initialize array
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
        } else {
            result = await executeSshCommandStep(stepConfig, { host: input.dbHost, user: input.dbUsername, password: input.dbPassword }, 'ssh_validation');
        }
        output.validationStepResults.push(result);
        if (result.status === 'failure') {
          haltValidation = true;
        }
      }
    }

    const hasValidationFailures = output.validationStepResults.some(r => r.status === 'failure');
    const hasValidationSuccess = output.validationStepResults.some(r => r.status === 'success');

    if (hasValidationFailures) {
      output.overallStatus = hasValidationSuccess ? 'partial_success' : 'validation_failure';
    } else {
      output.overallStatus = 'success';
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    output.dbConnectionStatus = 'failure';
    output.dbConnectionError = errorMessage;
    output.overallStatus = 'connection_failure';
    console.error("[TEST_DB] Target Database connection or flow error (simulated):", errorMessage);

    if (input.validationSteps && input.validationSteps.length > 0) {
        output.validationStepResults = output.validationStepResults || []; // Ensure array is initialized
        input.validationSteps.forEach(stepConfig => {
            if (stepConfig.isEnabled && !output.validationStepResults.find(r => r.stepName === stepConfig.name)) { // Avoid duplicates
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

// This object is NOT exported. It was previously a source of error.
const localFlowDefinitionHelper = {
  name: 'localTestDbValidationFlowDefinition',
  inputSchema: TestDbValidationInputSchema,
  outputSchema: TestDbValidationOutputSchema,
  execute: testDbValidation,
};

// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE
// Ensure no trailing characters or comments beyond this point.
    