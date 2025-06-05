// src/ai/flows/test-db-validation-flow.ts
'use server';
/**
 * @fileOverview An AI agent that simulates testing a Database connection
 * and a sequence of validation steps (SQL queries or SSH commands on the DB host).
 * The SSH preamble for scenario execution is defined with the DB config but NOT run by this specific test flow.
 * REAL_IMPLEMENTATION_NOTE: This entire flow is a SIMULATION. In a production system, this would be replaced by
 * a backend service that:
 * 1. Establishes a real connection to the specified database (MySQL, PostgreSQL, etc.).
 * 2. Executes the defined SQL queries against that database.
 * 3. Optionally, if SSH steps are involved for validation (e.g., checking logs on DB host),
 *    it would perform those SSH operations.
 *
 * - testDbValidation - A function that simulates the DB validation process.
 * - TestDbValidationInput - The input type for the testDbValidation function.
 * - TestDbValidationOutput - The return type for the testDbValidation function.
 */

import { z } from 'genkit';
import { dbService, sshService } from '@/lib/services';

// --- Input Schemas ---
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
  validationSteps: z.array(DbValidationStepClientSchema).describe('Validation steps to execute after DB connection.'),
});
export type TestDbValidationInput = z.infer<typeof TestDbValidationInputSchema>;


// --- Output Schemas ---
// Schema for the result of a single validation step.
const StepResultSchema = z.object({
  stepName: z.string(),
  status: z.enum(['success', 'failure', 'skipped']),
  output: z.string().optional(),
  error: z.string().optional(),
  command: z.string().optional(), // For SSH steps
  query: z.string().optional(),   // For SQL steps
  type: z.enum(['ssh', 'sql', 'connection']).optional(),
});
export type StepResult = z.infer<typeof StepResultSchema>;

// Output schema for the entire DB validation test flow.
const TestDbValidationOutputSchema = z.object({
  overallStatus: z.enum(['success', 'partial_success', 'connection_failure', 'validation_failure', 'testing']),
  dbConnectionStatus: z.enum(['success', 'failure', 'skipped']),
  dbConnectionError: z.string().optional(),
  validationStepResults: z.array(StepResultSchema),
});
export type TestDbValidationOutput = z.infer<typeof TestDbValidationOutputSchema>;


// --- Helper Functions ---
// Simulate a delay
// REAL_IMPLEMENTATION_NOTE: In a real system, actual operation times will vary.
// This delay is purely for making the simulation feel somewhat realistic.
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Interpolate command strings with DB information.
// REAL_IMPLEMENTATION_NOTE: This helper can be useful for constructing actual commands/queries
// if your backend system uses templated commands.
function interpolateDbCommand(command: string, dbInfo: Pick<TestDbValidationInput, 'dbHost' | 'dbUsername' | 'dbPort' | 'dbName' | 'dbType'>): string {
    let interpolated = command;
    interpolated = interpolated.replace(/\$\{dbHost\}/g, dbInfo.dbHost);
    interpolated = interpolated.replace(/\$\{dbUsername\}/g, dbInfo.dbUsername);
    interpolated = interpolated.replace(/\$\{dbPort\}/g, String(dbInfo.dbPort));
    interpolated = interpolated.replace(/\$\{dbName\}/g, dbInfo.dbName);
    interpolated = interpolated.replace(/\$\{dbType\}/g, dbInfo.dbType);
    return interpolated;
}

// Simulates the execution of a single DB validation step (either SQL or SSH).
// REAL_IMPLEMENTATION_NOTE: This function would be replaced by actual backend logic.
// If stepConfig.type === 'sql':
//   1. Use a database client library for the specified `dbType` (e.g., 'mysql2', 'pg', 'tedious', 'sqlite3').
//   2. Execute the `interpolatedQuery` against the connected database.
//   3. Capture results (e.g., rows, affected count, errors).
//   4. Convert results to a string format for `simulatedOutput`.
//   5. Compare results against `stepConfig.expectedOutputContains` if provided.
// If stepConfig.type === 'ssh':
//   1. Establish an SSH connection to the DB host (or relevant server, needs SSH config for DB host).
//   2. Execute the `interpolatedCommand`.
//   3. Capture stdout, stderr, exit code.
//   4. Compare output against `stepConfig.expectedOutputContains` if provided.
async function executeValidationStep(
  stepConfig: DbValidationStepClient,
  dbInfo: Pick<TestDbValidationInput, 'dbHost' | 'dbUsername' | 'dbPort' | 'dbName' | 'dbType'>
): Promise<StepResult> {
  if (!stepConfig.isEnabled) {
    return {
      stepName: stepConfig.name,
      status: 'skipped',
      output: 'Step disabled by user.',
      type: stepConfig.type,
    };
  }

  try {
    if (stepConfig.type === 'sql') {
      const result = await dbService.executeQuery(stepConfig.commandOrQuery);
      const success = !result.error && 
                     (!stepConfig.expectedOutputContains || 
                      JSON.stringify(result.rows).includes(stepConfig.expectedOutputContains));

      return {
        stepName: stepConfig.name,
        status: success ? 'success' : 'failure',
        output: JSON.stringify(result.rows, null, 2),
        error: result.error?.message,
        query: stepConfig.commandOrQuery,
        type: 'sql',
      };
    } else { // ssh
      const result = await sshService.executeCommand(stepConfig.commandOrQuery);
      const success = result.code === 0 && 
                     (!stepConfig.expectedOutputContains || 
                      result.stdout.includes(stepConfig.expectedOutputContains));

      return {
        stepName: stepConfig.name,
        status: success ? 'success' : 'failure',
        output: `${result.stdout}${result.stderr ? `\nError: ${result.stderr}` : ''}`,
        error: success ? undefined : 'SSH command failed or output validation failed',
        command: stepConfig.commandOrQuery,
        type: 'ssh',
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      stepName: stepConfig.name,
      status: 'failure',
      error: errorMessage,
      type: stepConfig.type,
      ...(stepConfig.type === 'sql' ? { query: stepConfig.commandOrQuery } : { command: stepConfig.commandOrQuery }),
    };
  }
}

// Main exported function for testing DB connection and validation sequence.
// REAL_IMPLEMENTATION_NOTE: This function would orchestrate calls to a backend service
// that handles actual DB connections, SQL executions, and SSH commands on DB hosts.
// The backend would require appropriate database client libraries and SSH libraries.
export async function testDbValidation(input: TestDbValidationInput): Promise<TestDbValidationOutput> {
  const output: TestDbValidationOutput = {
    overallStatus: 'testing',
    dbConnectionStatus: 'skipped',
    validationStepResults: [],
  };

  try {
    // Try to connect to the database
    await dbService.connect({
      type: input.dbType,
      host: input.dbHost,
      port: input.dbPort,
      username: input.dbUsername,
      password: input.dbPassword,
      database: input.dbName,
    });

    output.dbConnectionStatus = 'success';

    // Execute validation steps
    let haltValidation = false;
    if (input.validationSteps && input.validationSteps.length > 0) {
      for (const stepConfig of input.validationSteps) {
        if (haltValidation) {
          output.validationStepResults.push({
            stepName: stepConfig.name,
            status: 'skipped',
            output: 'Skipped due to previous validation failure.',
            type: stepConfig.type,
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

    // Determine overall status
    const hasFailures = output.validationStepResults.some(r => r.status === 'failure');
    const hasSkipped = output.validationStepResults.some(r => r.status === 'skipped');
    const hasSuccess = output.validationStepResults.some(r => r.status === 'success');

    if (hasFailures) {
      output.overallStatus = hasSuccess ? 'partial_success' : 'validation_failure';
    } else {
      output.overallStatus = 'success';
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    output.dbConnectionStatus = 'failure';
    output.dbConnectionError = errorMessage;
    output.overallStatus = 'connection_failure';

    // Skip validation steps if DB connection failed
    if (input.validationSteps && input.validationSteps.length > 0) {
      input.validationSteps.forEach(stepConfig => {
        if (stepConfig.isEnabled) {
          output.validationStepResults.push({
            stepName: stepConfig.name,
            status: 'skipped',
            output: 'Skipped due to DB connection failure.',
            type: stepConfig.type,
            ...(stepConfig.type === 'sql' ? { query: stepConfig.commandOrQuery } : { command: stepConfig.commandOrQuery }),
          });
        }
      });
    }
  } finally {
    // Always try to disconnect from the database
    try {
      await dbService.disconnect();
    } catch (error) {
      console.error('Error disconnecting from database:', error);
    }
  }

  return output;
}

// Internal flow definition - not exported
export const testDbValidationInternalFlow = {
  name: 'testDbValidationInternalFlow',
  inputSchema: TestDbValidationInputSchema,
  outputSchema: TestDbValidationOutputSchema,
  execute: testDbValidation,
};
// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE
