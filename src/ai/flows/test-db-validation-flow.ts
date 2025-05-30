
// src/ai/flows/test-db-validation-flow.ts
'use server';
/**
 * @fileOverview An AI agent that simulates testing a Database connection,
 * an optional SSH preamble, and a sequence of validation steps (SQL queries or SSH commands).
 *
 * - testDbValidation - A function that simulates the DB validation process.
 * - TestDbValidationInput - The input type for the testDbValidation function.
 * - TestDbValidationOutput - The return type for the testDbValidation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// --- Input Schemas ---
const DbSshPreambleStepClientSchema = z.object({
  name: z.string().describe('User-defined name of the SSH preamble step.'),
  command: z.string().describe('The SSH command to simulate.'),
  isEnabled: z.boolean().describe('Whether this step should be executed.'),
  expectedOutputContains: z.string().optional().describe('Substring expected in simulated output for success.'),
});
export type DbSshPreambleStepClient = z.infer<typeof DbSshPreambleStepClientSchema>;

const DbValidationStepClientSchema = z.object({
  name: z.string().describe('User-defined name of the validation step.'),
  type: z.enum(['sql', 'ssh']).describe('Type of validation step.'),
  commandOrQuery: z.string().describe('The SQL query or SSH command to simulate.'),
  isEnabled: z.boolean().describe('Whether this step should be executed.'),
  isMandatory: z.boolean().optional().describe('If this step is mandatory (UI might prevent disabling).'),
  expectedOutputContains: z.string().optional().describe('Substring expected in simulated output/result for success.'),
});
export type DbValidationStepClient = z.infer<typeof DbValidationStepClientSchema>;

const TestDbValidationInputSchema = z.object({
  id: z.string().describe("ID of the DB configuration being tested."),
  dbType: z.enum(['mysql', 'postgresql', 'mssql', 'sqlite']).describe('Type of the database.'),
  dbHost: z.string().describe('Hostname or IP of the database server.'),
  dbPort: z.number().describe('Port of the database server.'),
  dbUsername: z.string().describe('Database username.'),
  dbPassword: z.string().optional().describe('Database password (for simulation).'),
  dbName: z.string().describe('Name of the database.'),
  sshPreambleSteps: z.array(DbSshPreambleStepClientSchema).optional().describe('Optional SSH commands to simulate before DB connection.'),
  validationSteps: z.array(DbValidationStepClientSchema).describe('Validation steps to simulate after DB connection.'),
});
export type TestDbValidationInput = z.infer<typeof TestDbValidationInputSchema>;


// --- Output Schemas ---
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


const TestDbValidationOutputSchema = z.object({
  overallStatus: z.enum(['success', 'partial_success', 'validation_failure', 'connection_failure', 'preamble_failure', 'testing'])
    .describe('Overall status of the DB validation test.'),
  preambleStepResults: z.array(StepResultSchema).optional().describe('Results of SSH preamble steps.'),
  dbConnectionStatus: z.enum(['success', 'failure', 'skipped']).describe('Status of the simulated DB connection attempt.'),
  dbConnectionError: z.string().optional().describe('Error message if DB connection failed.'),
  validationStepResults: z.array(StepResultSchema).optional().describe('Results of DB validation steps.'),
});
export type TestDbValidationOutput = z.infer<typeof TestDbValidationOutputSchema>;


// --- Helper Functions ---
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function interpolateDbCommand(command: string, dbInfo: Pick<TestDbValidationInput, 'dbHost' | 'dbUsername' | 'dbPort' | 'dbName' | 'dbType'>): string {
    let interpolated = command;
    interpolated = interpolated.replace(/\$\{dbHost\}/g, dbInfo.dbHost);
    interpolated = interpolated.replace(/\$\{dbUsername\}/g, dbInfo.dbUsername);
    interpolated = interpolated.replace(/\$\{dbPort\}/g, String(dbInfo.dbPort));
    interpolated = interpolated.replace(/\$\{dbName\}/g, dbInfo.dbName);
    interpolated = interpolated.replace(/\$\{dbType\}/g, dbInfo.dbType);
    return interpolated;
}

async function simulateSshStep(stepConfig: DbSshPreambleStepClient, dbInfo: Pick<TestDbValidationInput, 'dbHost' | 'dbUsername' | 'dbPort' | 'dbName' | 'dbType'>): Promise<StepResult> {
    const command = interpolateDbCommand(stepConfig.command, dbInfo);
    await simulateDelay(200 + Math.random() * 500);
    let simulatedOutput = `Simulated SSH output for: ${command}\n...`;
    let simulatedError;
    let isSuccess = Math.random() < 0.9; // 90% success rate for generic SSH

    if (command.toLowerCase().includes('ssh ')) {
        simulatedOutput = `Connected to mock host via SSH: ${command.split(' ')[1] || dbInfo.dbHost}`;
    } else {
        simulatedOutput = `Executed generic SSH command: ${command}\nOutput: Operation completed.`;
    }

    if (!isSuccess) {
        simulatedError = `Simulated SSH error for command: ${command}`;
        simulatedOutput = `Failed to execute SSH command: ${command}.`;
    }

    if (stepConfig.expectedOutputContains) {
        if (isSuccess && simulatedOutput.includes(stepConfig.expectedOutputContains)) {
            isSuccess = true;
        } else {
            isSuccess = false;
            if (!simulatedError) {
                simulatedError = `Expected output "${stepConfig.expectedOutputContains}" not found in SSH output.`;
                simulatedOutput += `\n[VALIDATION] Expected output check failed.`;
            }
        }
    }
    return { stepName: stepConfig.name, status: isSuccess ? 'success' : 'failure', output: simulatedOutput, error: simulatedError, command, type: 'ssh' };
}

async function simulateDbValidationStep(stepConfig: DbValidationStepClient, dbInfo: Pick<TestDbValidationInput, 'dbHost' | 'dbUsername' | 'dbPort' | 'dbName' | 'dbType'>): Promise<StepResult> {
    const commandOrQuery = interpolateDbCommand(stepConfig.commandOrQuery, dbInfo);
    await simulateDelay(150 + Math.random() * 400);
    let simulatedOutput = `Simulated output for ${stepConfig.type} step: ${commandOrQuery}\n...`;
    let simulatedError;
    let isSuccess = Math.random() < 0.85; // 85% success rate

    if (stepConfig.type === 'sql') {
        simulatedOutput = `Executed SQL query: ${commandOrQuery}\nMock Result: Query returned ${Math.floor(Math.random()*10)} rows. First row: {id: 1, name: 'Test Data'}`;
        if (commandOrQuery.toLowerCase().includes('error_test_query')) { // for testing failure
            isSuccess = false;
            simulatedError = 'Simulated SQL syntax error.';
            simulatedOutput = 'ERROR: syntax error at or near "error_test_query"';
        }
    } else { // ssh
        simulatedOutput = `Executed SSH command on DB host: ${commandOrQuery}\nMock Output: Script finished.`;
         if (commandOrQuery.toLowerCase().includes('fail_script')) { // for testing failure
            isSuccess = false;
            simulatedError = 'Simulated script execution failure.';
            simulatedOutput = 'Script returned non-zero exit code.';
        }
    }
    
    if (!isSuccess && !simulatedError) { // Generic failure if not specifically set
        simulatedError = `Simulated generic error for ${stepConfig.type} step.`;
    }

    if (stepConfig.expectedOutputContains) {
        if (isSuccess && simulatedOutput.includes(stepConfig.expectedOutputContains)) {
            isSuccess = true;
        } else {
            isSuccess = false;
            if (!simulatedError) {
                simulatedError = `Expected output "${stepConfig.expectedOutputContains}" not found in ${stepConfig.type} output.`;
                simulatedOutput += `\n[VALIDATION] Expected output check failed.`;
            }
        }
    }
    return { 
        stepName: stepConfig.name, 
        status: isSuccess ? 'success' : 'failure', 
        output: simulatedOutput, 
        error: simulatedError, 
        command: stepConfig.type === 'ssh' ? commandOrQuery : undefined,
        query: stepConfig.type === 'sql' ? commandOrQuery : undefined,
        type: stepConfig.type
    };
}


// --- Main Exported Flow Function ---
export async function testDbValidation(input: TestDbValidationInput): Promise<TestDbValidationOutput> {
  const output: TestDbValidationOutput = {
    overallStatus: 'testing',
    preambleStepResults: [],
    dbConnectionStatus: 'skipped',
    validationStepResults: [],
  };

  let haltPreamble = false;
  if (input.sshPreambleSteps && input.sshPreambleSteps.length > 0) {
    for (const stepConfig of input.sshPreambleSteps) {
      if (haltPreamble) {
        output.preambleStepResults?.push({ stepName: stepConfig.name, status: 'skipped', command: stepConfig.command, type: 'ssh', output: 'Skipped due to previous preamble failure.' });
        continue;
      }
      if (!stepConfig.isEnabled) {
        output.preambleStepResults?.push({ stepName: stepConfig.name, status: 'skipped', command: stepConfig.command, type: 'ssh', output: 'Step disabled by user.' });
        continue;
      }
      const result = await simulateSshStep(stepConfig, input);
      output.preambleStepResults?.push(result);
      if (result.status === 'failure') {
        haltPreamble = true;
      }
    }
  }

  if (haltPreamble) {
    output.overallStatus = 'preamble_failure';
    output.dbConnectionStatus = 'skipped'; // Skip DB connection if preamble failed
    return output;
  }

  // Simulate DB Connection
  await simulateDelay(300 + Math.random() * 700);
  const dbConnectSuccess = Math.random() < 0.9; // 90% success
  if (dbConnectSuccess) {
    output.dbConnectionStatus = 'success';
  } else {
    output.dbConnectionStatus = 'failure';
    output.dbConnectionError = `Simulated: Failed to connect to ${input.dbType} server ${input.dbHost}:${input.dbPort} as ${input.dbUsername}.`;
    output.overallStatus = 'connection_failure';
    return output;
  }

  let haltValidation = false;
  if (input.validationSteps && input.validationSteps.length > 0) {
    for (const stepConfig of input.validationSteps) {
      if (haltValidation) {
        output.validationStepResults?.push({ stepName: stepConfig.name, status: 'skipped', command: stepConfig.type === 'ssh' ? stepConfig.commandOrQuery : undefined, query: stepConfig.type === 'sql' ? stepConfig.commandOrQuery : undefined, type: stepConfig.type, output: 'Skipped due to previous validation failure.' });
        continue;
      }
      if (!stepConfig.isEnabled) {
        output.validationStepResults?.push({ stepName: stepConfig.name, status: 'skipped', command: stepConfig.type === 'ssh' ? stepConfig.commandOrQuery : undefined, query: stepConfig.type === 'sql' ? stepConfig.commandOrQuery : undefined, type: stepConfig.type, output: 'Step disabled by user.' });
        continue;
      }
      const result = await simulateDbValidationStep(stepConfig, input);
      output.validationStepResults?.push(result);
      if (result.status === 'failure') {
        haltValidation = true;
      }
    }
  }

  if (haltValidation) {
    output.overallStatus = 'validation_failure';
  } else if (output.preambleStepResults?.some(r => r.status === 'failure')) { // Should be caught by haltPreamble
    output.overallStatus = 'preamble_failure';
  } else if (output.dbConnectionStatus === 'failure') { // Should be caught earlier
    output.overallStatus = 'connection_failure';
  } else {
    // If we reached here, preamble (if any) and DB connection were successful, and no validation steps failed.
    // Check if any non-mandatory steps in preamble or validation had issues but didn't halt (not possible with current halt logic)
    // For simplicity, if no halts, consider it success for now.
    // A more nuanced 'partial_success' could be if all mandatory passed, but some optional failed (but current halt logic prevents this)
    const allValidationStepsWereSuccessfulOrSkippedByUser = output.validationStepResults?.filter(r => {
        const originalStep = input.validationSteps.find(s => s.name === r.stepName);
        return originalStep?.isEnabled;
    }).every(r => r.status === 'success' || r.status === 'skipped') ?? true; // true if no validation steps

    if (allValidationStepsWereSuccessfulOrSkippedByUser) {
         output.overallStatus = 'success';
    } else {
        // This state implies some enabled validation steps did not result in 'success' but didn't cause a halt.
        // With the current "halt on any failure" logic for enabled steps, this implies all enabled steps were user-disabled.
        output.overallStatus = 'partial_success'; 
    }
  }
  
  // Final check: if overallStatus is still 'testing' (e.g. no steps, no preamble, only DB connection)
  if (output.overallStatus === 'testing') {
      if (output.dbConnectionStatus === 'success' && (!input.validationSteps || input.validationSteps.filter(s=>s.isEnabled).length === 0)) {
          output.overallStatus = 'success'; // Connected, no validation to run or all disabled
      } else {
          output.overallStatus = 'partial_success'; // Default if not clearly defined
      }
  }

  return output;
}


// Internal Genkit flow definition
const testDbValidationInternalFlow = ai.defineFlow(
  {
    name: 'testDbValidationInternalFlow',
    inputSchema: TestDbValidationInputSchema,
    outputSchema: TestDbValidationOutputSchema,
  },
  async (input) => {
    return testDbValidation(input);
  }
);
// Schemas are defined above.
// Only types and the main async function `testDbValidation` are exported.

    