
// src/ai/flows/test-db-validation-flow.ts
'use server';
/**
 * @fileOverview An AI agent that simulates testing a Database connection
 * and a sequence of validation steps (SQL queries or SSH commands on the DB host).
 * It also simulates executing a direct test SSH preamble before connecting to the DB.
 * The SSH preamble for scenario execution (sshPreambleSteps) is defined with the DB config but NOT run by this specific test flow.
 * REAL_IMPLEMENTATION_NOTE: This entire flow is a SIMULATION. In a production system, this would be replaced by
 * a backend service that:
 * 1. If directTestSshPreamble steps are defined, executes them via live SSH against the DB host (or relevant gateway).
 * 2. If preamble succeeds, establishes a real connection to the specified database.
 * 3. Executes the defined SQL queries against that database.
 * 4. Optionally, if SSH steps are involved for validation (e.g., checking logs on DB host),
 *    it would perform those SSH operations.
 *
 * - testDbValidation - A function that simulates the DB validation process.
 * - TestDbValidationInput - The input type for the testDbValidation function.
 * - TestDbValidationOutput - The return type for the testDbValidation function.
 */

import { z } from 'genkit';
import { dbService, sshService } from '@/lib/services';


// --- Input Schemas ---
// Schema for individual SSH preamble steps for the direct test
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
  dbType: z.enum(['mysql', 'postgresql', 'mssql', 'sqlite']).describe('Type of the database.'),
  dbHost: z.string().describe('Hostname or IP of the database server.'),
  dbPort: z.number().describe('Port of the database server.'),
  dbUsername: z.string().describe('Database username.'),
  dbPassword: z.string().optional().describe('Database password.'),
  dbName: z.string().describe('Name of the database.'),
  directTestSshPreamble: z.array(DbSshPreambleStepConfigClientSchema).optional().describe('SSH Preamble steps to execute before DB connection for this test.'),
  validationSteps: z.array(DbValidationStepClientSchema).describe('Validation steps to execute after DB connection.'),
});
export type TestDbValidationInput = z.infer<typeof TestDbValidationInputSchema>;


// --- Output Schemas ---
// Schema for the result of a single step (preamble, connection, or validation).
const StepResultSchema = z.object({
  stepName: z.string(),
  status: z.enum(['success', 'failure', 'skipped']),
  output: z.string().optional(),
  error: z.string().optional(),
  command: z.string().optional(), 
  query: z.string().optional(),   
  type: z.enum(['ssh_preamble', 'ssh_validation', 'sql_validation', 'connection']).optional(),
});
export type StepResult = z.infer<typeof StepResultSchema>;

// Output schema for the entire DB validation test flow.
const TestDbValidationOutputSchema = z.object({
  overallStatus: z.enum(['success', 'partial_success', 'connection_failure', 'validation_failure', 'preamble_failure', 'testing']),
  directTestSshPreambleResults: z.array(StepResultSchema).optional(),
  dbConnectionStatus: z.enum(['success', 'failure', 'skipped']),
  dbConnectionError: z.string().optional(),
  validationStepResults: z.array(StepResultSchema),
});
export type TestDbValidationOutput = z.infer<typeof TestDbValidationOutputSchema>;


// REAL_IMPLEMENTATION_NOTE: This function would be part of a backend service.
// It would require SSH libraries (e.g., ssh2 for Node.js) and DB client libraries.
// For this simulation, it uses a mocked sshService and dbService.
async function executeSshPreambleStep(
  stepConfig: DbSshPreambleStepConfigClient,
  dbInfo: Pick<TestDbValidationInput, 'dbHost' | 'dbPort' | 'dbUsername' | 'dbPassword'> // For SSH target
): Promise<StepResult> {
  if (!stepConfig.isEnabled) {
    return {
      stepName: stepConfig.name, status: 'skipped', output: 'Step disabled by user.',
      type: 'ssh_preamble', command: stepConfig.command,
    };
  }
  console.log(`[TEST_DB_PREAMBLE] Executing SSH Preamble step: ${stepConfig.name}`);
  try {
    // REAL_IMPLEMENTATION_NOTE: A real backend would connect to dbInfo.dbHost for these commands.
    // Ensure sshService is connected to the correct host if it's different from a previous connection.
    // The current mock sshService connects to one host at a time specified in its own connect method.
    // Here, we assume the preamble targets the DB host.
    if (!sshService.isConnected() || sshService.getConnectionConfig()?.host !== dbInfo.dbHost) {
        await sshService.connect({ host: dbInfo.dbHost, port: 22, username: dbInfo.dbUsername, password: dbInfo.dbPassword });
    }

    const result = await sshService.executeCommand(stepConfig.command);
    const success = result.code === 0 &&
                   (!stepConfig.expectedOutputContains ||
                    result.stdout.includes(stepConfig.expectedOutputContains) ||
                    result.stderr.includes(stepConfig.expectedOutputContains));
    
    return {
      stepName: stepConfig.name, status: success ? 'success' : 'failure',
      output: `${result.stdout}${result.stderr ? `\nStderr: ${result.stderr}` : ''}`,
      error: success ? undefined : 'SSH Preamble command failed or output validation failed',
      type: 'ssh_preamble', command: stepConfig.command,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SSH Preamble error';
    return {
      stepName: stepConfig.name, status: 'failure', error: errorMessage,
      type: 'ssh_preamble', command: stepConfig.command,
    };
  }
}

// Simulates the execution of a single DB validation step (either SQL or SSH).
// REAL_IMPLEMENTATION_NOTE: This function would be replaced by actual backend logic.
async function executeValidationStep(
  stepConfig: DbValidationStepClient,
  dbInfo: Pick<TestDbValidationInput, 'dbHost' | 'dbUsername' | 'dbPort' | 'dbName' | 'dbType' | 'dbPassword'>
): Promise<StepResult> {
  if (!stepConfig.isEnabled) {
    return {
      stepName: stepConfig.name, status: 'skipped', output: 'Step disabled by user.',
      type: stepConfig.type === 'sql' ? 'sql_validation' : 'ssh_validation',
      ...(stepConfig.type === 'sql' ? { query: stepConfig.commandOrQuery } : { command: stepConfig.commandOrQuery }),
    };
  }

  try {
    if (stepConfig.type === 'sql') {
      // dbService.connect is called once before all validation steps.
      const result = await dbService.executeQuery(stepConfig.commandOrQuery);
      const success = !result.error && 
                     (!stepConfig.expectedOutputContains || 
                      JSON.stringify(result.rows).includes(stepConfig.expectedOutputContains));

      return {
        stepName: stepConfig.name, status: success ? 'success' : 'failure',
        output: JSON.stringify(result.rows, null, 2), error: result.error?.message,
        query: stepConfig.commandOrQuery, type: 'sql_validation',
      };
    } else { // ssh validation step
      // REAL_IMPLEMENTATION_NOTE: This assumes SSH target is the DB host.
      // Ensure sshService is connected to the correct host (dbInfo.dbHost).
       if (!sshService.isConnected() || sshService.getConnectionConfig()?.host !== dbInfo.dbHost) {
        await sshService.connect({ host: dbInfo.dbHost, port: 22, username: dbInfo.dbUsername, password: dbInfo.dbPassword });
      }
      const result = await sshService.executeCommand(stepConfig.commandOrQuery);
      const success = result.code === 0 && 
                     (!stepConfig.expectedOutputContains || 
                      result.stdout.includes(stepConfig.expectedOutputContains) ||
                      result.stderr.includes(stepConfig.expectedOutputContains));

      return {
        stepName: stepConfig.name, status: success ? 'success' : 'failure',
        output: `${result.stdout}${result.stderr ? `\nStderr: ${result.stderr}` : ''}`,
        error: success ? undefined : 'SSH validation command failed or output validation failed',
        command: stepConfig.commandOrQuery, type: 'ssh_validation',
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      stepName: stepConfig.name, status: 'failure', error: errorMessage,
      type: stepConfig.type === 'sql' ? 'sql_validation' : 'ssh_validation',
      ...(stepConfig.type === 'sql' ? { query: stepConfig.commandOrQuery } : { command: stepConfig.commandOrQuery }),
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
  let preambleSuccessful = true;

  try {
    // 1. Execute Direct Test SSH Preamble Steps
    if (input.directTestSshPreamble && input.directTestSshPreamble.length > 0) {
      console.log("[TEST_DB] Starting Direct Test SSH Preamble execution...");
      for (const preambleStep of input.directTestSshPreamble) {
        const result = await executeSshPreambleStep(preambleStep, input);
        output.directTestSshPreambleResults!.push(result);
        if (result.status === 'failure') {
          preambleSuccessful = false;
          console.log(`[TEST_DB] Direct Test SSH Preamble step "${preambleStep.name}" failed. Halting further execution.`);
          break;
        }
      }
       if (!preambleSuccessful) {
        output.overallStatus = 'preamble_failure';
        // Skip DB connection and validation steps
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
      console.log("[TEST_DB] Direct Test SSH Preamble completed successfully.");
    }


    // 2. Try to connect to the database
    // REAL_IMPLEMENTATION_NOTE: A real backend service would handle this DB connection.
    await dbService.connect({
      type: input.dbType, host: input.dbHost, port: input.dbPort,
      username: input.dbUsername, password: input.dbPassword, database: input.dbName,
    });
    output.dbConnectionStatus = 'success';
    console.log("[TEST_DB] Database connection successful.");

    // 3. Execute validation steps
    let haltValidation = false;
    if (input.validationSteps && input.validationSteps.length > 0) {
      console.log("[TEST_DB] Starting validation steps execution...");
      for (const stepConfig of input.validationSteps) {
        if (haltValidation) {
          output.validationStepResults.push({
            stepName: stepConfig.name, status: 'skipped', output: 'Skipped due to previous validation failure.',
            type: stepConfig.type === 'sql' ? 'sql_validation' : 'ssh_validation',
            ...(stepConfig.type === 'sql' ? { query: stepConfig.commandOrQuery } : { command: stepConfig.commandOrQuery }),
          });
          continue;
        }
        const result = await executeValidationStep(stepConfig, input);
        output.validationStepResults.push(result);
        if (result.status === 'failure') {
          haltValidation = true;
        }
      }
    }

    // 4. Determine overall status
    const hasValidationFailures = output.validationStepResults.some(r => r.status === 'failure');
    const hasValidationSuccess = output.validationStepResults.some(r => r.status === 'success');

    if (hasValidationFailures) {
      output.overallStatus = hasValidationSuccess ? 'partial_success' : 'validation_failure';
    } else {
      output.overallStatus = 'success';
    }

  } catch (error: unknown) { // This catch block is primarily for DB connection errors now
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    output.dbConnectionStatus = 'failure';
    output.dbConnectionError = errorMessage;
    output.overallStatus = 'connection_failure';
    console.error("[TEST_DB] Database connection or flow error:", errorMessage);

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
      console.log("[TEST_DB] SSH and DB services disconnected.");
    } catch (disconnectError) {
      console.error('[TEST_DB] Error disconnecting services:', disconnectError);
    }
  }

  return output;
}

// Internal flow definition - NOT EXPORTED to fix Next.js error
const testDbValidationInternalFlow = {
  name: 'testDbValidationInternalFlow',
  inputSchema: TestDbValidationInputSchema,
  outputSchema: TestDbValidationOutputSchema,
  execute: testDbValidation,
};
// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE

    