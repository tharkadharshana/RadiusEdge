
// src/ai/flows/test-server-connection-flow.ts
'use server';
/**
 * @fileOverview An AI agent that simulates testing a RADIUS server connection and setup based on a customizable sequence of steps.
 *
 * - testServerConnection - A function that simulates testing the server connection.
 * - TestServerConnectionInput - The input type for the testServerConnection function.
 * - TestServerConnectionOutput - The return type for the testServerConnection function.
 * - ClientTestStep - The type for individual client-provided steps.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schema for individual steps provided by the client
const ClientTestStepSchema = z.object({
  name: z.string().describe('The user-defined name of the test step.'),
  command: z.string().describe('The command to be (simulated) executed for this step.'),
  isEnabled: z.boolean().describe('Whether this step should be executed.'),
  isMandatory: z.boolean().optional().describe('Indicates if the step is considered mandatory by the client.'),
  type: z.enum(['default', 'custom']).optional().describe('The type of step, for client-side differentiation.'),
  expectedOutputContains: z.string().optional().describe('A substring that the simulated output must contain for the step to be considered successful.'),
});
export type ClientTestStep = z.infer<typeof ClientTestStepSchema>;


const TestServerConnectionInputSchema = z.object({
  id: z.string().describe("The ID of the server configuration being tested."),
  host: z.string().describe('The hostname or IP address of the server (for RADIUS client, SSH simulation might use this too).'),
  sshPort: z.number().describe('The SSH port for the server (for simulation).'),
  sshUser: z.string().describe('The SSH username (for simulation).'),
  authMethod: z.enum(['key', 'password']).describe('The SSH authentication method (for simulation).'),
  privateKey: z.string().optional().describe('The SSH private key, if authMethod is key (for simulation).'),
  password: z.string().optional().describe('The SSH password, if authMethod is password (for simulation).'),
  serverType: z.enum(['freeradius', 'custom', 'other']).describe('The type of RADIUS server software.'),
  stepsToExecute: z.array(ClientTestStepSchema).describe('An ordered list of test steps to execute.'),
});
export type TestServerConnectionInput = z.infer<typeof TestServerConnectionInputSchema>;

const TestServerConnectionStepResultSchema = z.object({
  stepName: z.string().describe('The name of the test step.'),
  status: z.enum(['success', 'failure', 'skipped', 'running', 'pending']).describe('The status of the step.'),
  output: z.string().optional().describe('The simulated output or logs from the step.'),
  error: z.string().optional().describe('Any simulated error message if the step failed.'),
  command: z.string().optional().describe('The (potentially interpolated) command simulated for this step.'),
});
export type TestServerConnectionStepResult = z.infer<typeof TestServerConnectionStepResultSchema>;

const TestServerConnectionOutputSchema = z.object({
  overallStatus: z.enum(['success', 'failure', 'partial', 'testing']).describe('The overall status of the connection test.'),
  steps: z.array(TestServerConnectionStepResultSchema).describe('A list of steps performed during the test and their outcomes.'),
});
export type TestServerConnectionOutput = z.infer<typeof TestServerConnectionOutputSchema>;

// Simulate a delay
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function interpolateCommand(command: string, serverInfo: Pick<TestServerConnectionInput, 'host' | 'sshUser' | 'sshPort' | 'serverType'>): string {
    let interpolated = command;
    interpolated = interpolated.replace(/\$\{host\}/g, serverInfo.host);
    interpolated = interpolated.replace(/\$\{sshUser\}/g, serverInfo.sshUser);
    interpolated = interpolated.replace(/\$\{sshPort\}/g, String(serverInfo.sshPort));
    
    if (interpolated.includes('${serverType === "freeradius" ? "freeradius" : "radiusd"}')) {
        const radiusdCmd = serverInfo.serverType === "freeradius" ? "freeradius" : "radiusd";
        interpolated = interpolated.replace(/\$\{serverType === "freeradius" \? "freeradius" : "radiusd"\}/g, radiusdCmd);
    } else { 
        interpolated = interpolated.replace(/\$\{serverType\}/g, serverInfo.serverType);
    }
    return interpolated;
}


async function simulateStepExecution(
    stepConfig: ClientTestStep,
    serverInfo: Pick<TestServerConnectionInput, 'id' | 'host' | 'sshPort' | 'sshUser' | 'authMethod' | 'privateKey' | 'password' | 'serverType'>
): Promise<TestServerConnectionStepResult> {
    
    const interpolatedCommand = interpolateCommand(stepConfig.command, serverInfo);

    if (!stepConfig.isEnabled) {
        return {
            stepName: stepConfig.name,
            status: 'skipped',
            command: interpolatedCommand,
            output: 'Step was disabled by user.',
        };
    }

    await simulateDelay(300 + Math.random() * 700); 

    const cmdLower = interpolatedCommand.toLowerCase();
    let successRate = 0.85; 
    let simulatedOutput = `Simulated output for command: ${interpolatedCommand}\n... processing ...`;
    let simulatedError;
    let isSuccess = false;

    // Determine success rate and output based on command
    if (cmdLower.includes('ssh ')) {
        successRate = 0.9;
        if (Math.random() < successRate) {
            simulatedOutput = `Successfully connected to ${serverInfo.host}:${serverInfo.sshPort} as ${serverInfo.sshUser}.\nSSH Connected`;
        } else {
            simulatedOutput = `Failed to connect to ${serverInfo.host}:${serverInfo.sshPort}. Check credentials or network.`;
            simulatedError = 'Simulated SSH connection failure.';
        }
    } else if (cmdLower.includes('which radclient')) {
        successRate = 0.95;
        if (Math.random() < successRate) {
            simulatedOutput = '/usr/bin/radclient';
        } else {
            simulatedOutput = 'radclient: not found';
            simulatedError = 'Simulated: radclient not found.';
        }
    } else if (cmdLower.includes('which radtest')) {
        successRate = 0.9;
         if (Math.random() < successRate) {
            simulatedOutput = '/usr/bin/radtest';
        } else {
            simulatedOutput = 'radtest: not found';
            simulatedError = 'Simulated: radtest not found.';
        }
    } else if (cmdLower.includes('-xc')) { // Config validation
        successRate = 0.85;
        const radiusdBinary = serverInfo.serverType === 'freeradius' ? 'freeradius' : 'radiusd';
        const configDir = serverInfo.serverType === 'freeradius' ? '/etc/freeradius/3.0' : '/etc/raddb';
        if (Math.random() < successRate) {
            simulatedOutput = `${radiusdBinary}: Configuration appears to be OK. Ready to start.`;
        } else {
            simulatedOutput = `${radiusdBinary}: Checking configuration files...\nERROR: Invalid syntax in ${configDir}/sites-enabled/default\n...`;
            simulatedError = 'Simulated RADIUS configuration errors.';
        }
    } else if (cmdLower.includes('systemctl status') || cmdLower.includes('service status')) {
        successRate = 0.9;
        const serviceName = interpolatedCommand.split(' ').pop() || (serverInfo.serverType === 'freeradius' ? 'freeradius' : 'radiusd');
        if (Math.random() < successRate) {
            simulatedOutput = `● ${serviceName}.service - FreeRADIUS multi-protocol policy server\n   Loaded: loaded (/lib/systemd/system/${serviceName}.service; enabled; vendor preset: enabled)\n   Active: active (running) since Mon 2024-01-01 12:00:00 UTC; 1 day ago`;
        } else {
            simulatedOutput = `● ${serviceName}.service - FreeRADIUS multi-protocol policy server\n   Loaded: loaded (/lib/systemd/system/${serviceName}.service; enabled; vendor preset: enabled)\n   Active: inactive (dead)`;
            simulatedError = `Simulated: ${serviceName} service not running.`;
        }
    } else { // Custom command or other default command not specifically handled above
        simulatedOutput = `Simulating custom command: ${interpolatedCommand}\nCustom script output example... Operation completed.`;
        // For custom, we rely on the default successRate or specific error simulation, then check expectedOutputContains
        if (Math.random() >= successRate) {
            simulatedError = `Simulated error for custom command: ${interpolatedCommand}`;
            simulatedOutput = `Simulated failure for custom command: ${interpolatedCommand}\nError: Something went wrong during execution.`;
        }
    }
    
    // Determine success based on expectedOutputContains if provided, otherwise by lack of simulatedError
    if (stepConfig.expectedOutputContains) {
        if (!simulatedError && simulatedOutput.includes(stepConfig.expectedOutputContains)) {
            isSuccess = true;
        } else {
            isSuccess = false;
            if (!simulatedError) { // If no explicit error was simulated but expected output is missing
                 simulatedError = `Expected output substring "${stepConfig.expectedOutputContains}" not found in simulated output.`;
                 simulatedOutput += `\n[INFO] Expected output check failed.`;
            }
        }
    } else { // Fallback to original logic if no expectedOutputContains is given
        isSuccess = !simulatedError;
    }

    return {
        stepName: stepConfig.name,
        status: isSuccess ? 'success' : 'failure',
        output: simulatedOutput,
        error: simulatedError,
        command: interpolatedCommand,
    };
}


export async function testServerConnection(input: TestServerConnectionInput): Promise<TestServerConnectionOutput> {
  const results: TestServerConnectionStepResult[] = [];
  let overallStatus: TestServerConnectionOutput['overallStatus'] = 'testing';
  let criticalFailureEncountered = false;

  for (const stepConfig of input.stepsToExecute) {
    if (criticalFailureEncountered && stepConfig.isMandatory) { 
        results.push({
            stepName: stepConfig.name,
            status: 'skipped',
            command: interpolateCommand(stepConfig.command, input),
            output: 'Skipped due to previous critical failure on a mandatory step.',
        });
        continue;
    }
    
    const stepResult = await simulateStepExecution(stepConfig, input);
    results.push(stepResult);

    if (stepResult.status === 'failure' && stepConfig.isMandatory) {
        criticalFailureEncountered = true;
    }
  }
  
  const hasAnyFailure = results.some(r => r.status === 'failure');
  const allEnabledStepsSucceededOrSkipped = results.filter(r => input.stepsToExecute.find(s => s.name === r.stepName)?.isEnabled)
                                               .every(r => r.status === 'success' || r.status === 'skipped');
  const hasMandatorySuccess = results.some((r,i) => r.status === 'success' && input.stepsToExecute[i].isMandatory);
  
  if (criticalFailureEncountered) {
    overallStatus = 'failure';
  } else if (hasAnyFailure) {
    overallStatus = 'partial'; // Some non-mandatory steps failed
  } else if (allEnabledStepsSucceededOrSkipped && hasMandatorySuccess) {
    overallStatus = 'success'; // All enabled steps (including mandatory ones) passed or were skipped (if not mandatory)
  } else if (results.every(r => r.status === 'skipped')) {
    overallStatus = 'partial'; // Or perhaps 'unknown' or 'not_tested' if all were skipped
  } else {
     overallStatus = 'success'; // Default if no failures and not all skipped
  }
  
  // Check if any actual work was done
  const successfulSteps = results.filter(r => r.status === 'success');
  if (successfulSteps.length === 0 && !results.some(r => r.status === 'failure')) {
      // All steps were skipped, or no steps were enabled.
      if(results.length > 0 && results.every(r => r.status === 'skipped')) {
         overallStatus = 'partial'; // All steps were skipped
      } else {
         // No steps or no enabled steps, perhaps mark differently if needed
         overallStatus = 'partial'; 
      }
  }


  return { overallStatus, steps: results };
}


// Internal flow definition - not exported
const testServerConnectionInternalFlow = ai.defineFlow(
  {
    name: 'testServerConnectionInternalFlow', 
    inputSchema: TestServerConnectionInputSchema,
    outputSchema: TestServerConnectionOutputSchema,
  },
  async (input) => {
    // Call the exported async function directly for simulation
    return testServerConnection(input);
  }
);
// The actual `testServerConnection` async function is exported and used by the UI.
// Schemas (ClientTestStepSchema, etc.) are defined but not directly exported from this 'use server' file.
// Only types (ClientTestStep, TestServerConnectionInput, TestServerConnectionOutput) are exported alongside the main function.

