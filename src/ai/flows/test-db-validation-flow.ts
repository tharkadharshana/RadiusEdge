
// src/ai/flows/test-db-validation-flow.ts
'use server';
/**
 * @fileOverview An AI agent that simulates testing a Database connection
 * and a sequence of validation steps (SQL queries or SSH commands on the DB host).
 * The SSH preamble for scenario execution is defined with the DB config but not run by this specific test flow.
 *
 * - testDbValidation - A function that simulates the DB validation process.
 * - TestDbValidationInput - The input type for the testDbValidation function.
 * - TestDbValidationOutput - The return type for the testDbValidation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// --- Input Schemas ---
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
  overallStatus: z.enum(['success', 'partial_success', 'validation_failure', 'connection_failure', 'testing'])
    .describe('Overall status of the DB validation test.'),
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
    dbConnectionStatus: 'skipped',
    validationStepResults: [],
  };

  // Simulate DB Connection
  await simulateDelay(300 + Math.random() * 700);
  // Simulate a connection failure ~10% of the time for demo purposes.
  // Specific conditions for failure (e.g. bad host, wrong port) can be added here for more deterministic simulation if needed.
  let dbConnectSuccess = Math.random() < 0.9; 
  if (input.dbHost.includes("failconnect")) {
    dbConnectSuccess = false;
  }


  if (dbConnectSuccess) {
    output.dbConnectionStatus = 'success';
  } else {
    output.dbConnectionStatus = 'failure';
    output.dbConnectionError = `Simulated: Failed to connect to ${input.dbType} server ${input.dbHost}:${input.dbPort} as ${input.dbUsername}. Check connection details.`;
    output.overallStatus = 'connection_failure';
    // Also skip validation steps if DB connection failed
    if (input.validationSteps && input.validationSteps.length > 0) {
        input.validationSteps.forEach(stepConfig => {
            output.validationStepResults?.push({ 
                stepName: stepConfig.name, 
                status: 'skipped', 
                command: stepConfig.type === 'ssh' ? stepConfig.commandOrQuery : undefined, 
                query: stepConfig.type === 'sql' ? stepConfig.commandOrQuery : undefined, 
                type: stepConfig.type, 
                output: 'Skipped due to DB connection failure.' 
            });
        });
    }
    return output;
  }

  let haltValidation = false;
  if (input.validationSteps && input.validationSteps.length > 0) {
    for (const stepConfig of input.validationSteps) {
      if (haltValidation) {
        output.validationStepResults?.push({ 
            stepName: stepConfig.name, 
            status: 'skipped', 
            command: stepConfig.type === 'ssh' ? stepConfig.commandOrQuery : undefined, 
            query: stepConfig.type === 'sql' ? stepConfig.commandOrQuery : undefined, 
            type: stepConfig.type, 
            output: 'Skipped due to previous validation failure.' 
        });
        continue;
      }
      if (!stepConfig.isEnabled) {
        output.validationStepResults?.push({ 
            stepName: stepConfig.name, 
            status: 'skipped', 
            command: stepConfig.type === 'ssh' ? stepConfig.commandOrQuery : undefined, 
            query: stepConfig.type === 'sql' ? stepConfig.commandOrQuery : undefined, 
            type: stepConfig.type, 
            output: 'Step disabled by user.' 
        });
        continue;
      }
      const result = await simulateDbValidationStep(stepConfig, input);
      output.validationStepResults?.push(result);
      if (result.status === 'failure') {
        haltValidation = true; // Stop further validation steps if one fails
      }
    }
  }

  // Determine overall status based on collected results
  if (output.dbConnectionStatus === 'failure') {
      output.overallStatus = 'connection_failure';
  } else if (output.validationStepResults?.some(r => r.status === 'failure')) {
      output.overallStatus = 'validation_failure';
  } else {
      // Check if there were any actual enabled validation steps to run
      const anyEnabledValidation = input.validationSteps?.some(s => s.isEnabled) ?? false;

      if (!anyEnabledValidation && output.dbConnectionStatus === 'success') {
           // Connected, but no validation steps were enabled to run
          output.overallStatus = 'success'; // Consider success if only DB connection was tested and it passed
      } else if (anyEnabledValidation && output.validationStepResults?.filter(r => {
          const originalStep = input.validationSteps.find(s => s.name === r.stepName);
          return originalStep?.isEnabled; // Check against original step's enabled status
      }).every(r => r.status === 'success' || r.status === 'skipped' /* skipped due to user disabling is fine */)) {
          output.overallStatus = 'success';
      } else if (output.overallStatus === 'testing') { // If still testing, it means no failures and db connection was successful
          output.overallStatus = 'success';
      } else {
          // This case might be hit if some steps were skipped (not due to failure or user disabling)
          // or if no enabled steps led to an overall success determination.
          // For instance, if all steps were disabled by user.
          output.overallStatus = 'partial_success'; 
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
    // This internal flow directly calls the exported async function.
    return testDbValidation(input);
  }
);
// Schemas are defined above.
// Only types and the main async function `testDbValidation` are exported.
