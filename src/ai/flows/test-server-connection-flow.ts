
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
  isMandatory: z.boolean().optional().describe('Indicates if the step is considered mandatory by the client (UI may prevent disabling/deleting).'),
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
    let isSuccess = false; // Default to false, prove success

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
        if (Math.random() >= successRate) { // Generic random failure for unhandled/custom commands
            simulatedError = `Simulated error for custom command: ${interpolatedCommand}`;
            simulatedOutput = `Simulated failure for custom command: ${interpolatedCommand}\nError: Something went wrong during execution.`;
        }
    }
    
    // Determine success based on expectedOutputContains if provided
    if (stepConfig.expectedOutputContains) {
        if (!simulatedError && simulatedOutput.includes(stepConfig.expectedOutputContains)) {
            isSuccess = true;
        } else {
            isSuccess = false; // Remains false or set explicitly
            if (!simulatedError) { // If no explicit error was simulated but expected output is missing
                 simulatedError = `Expected output substring "${stepConfig.expectedOutputContains}" not found in simulated output.`;
                 simulatedOutput += `\n[VALIDATION] Expected output check failed.`;
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
  let executionShouldHalt = false; 
  let overallStatus: TestServerConnectionOutput['overallStatus'] = 'testing';

  for (const stepConfig of input.stepsToExecute) {
    if (executionShouldHalt) {
      results.push({
        stepName: stepConfig.name,
        status: 'skipped',
        command: interpolateCommand(stepConfig.command, input), // Interpolate even for skipped for consistency in display
        output: 'Skipped due to previous critical failure.',
      });
      continue;
    }

    if (!stepConfig.isEnabled) {
        results.push({
            stepName: stepConfig.name,
            status: 'skipped',
            command: interpolateCommand(stepConfig.command, input),
            output: 'Step was disabled by user.',
        });
        continue;
    }
    
    const stepResult = await simulateStepExecution(stepConfig, input);
    results.push(stepResult);

    if (stepResult.status === 'failure') {
      // Check if this step was mandatory or if any failure should halt
      // For now, any failure on an enabled step halts execution.
      executionShouldHalt = true; 
    }
  }
  
  // Determine overallStatus based on results
  if (executionShouldHalt) {
    overallStatus = 'failure';
  } else {
    // If execution didn't halt, check if any enabled steps were actually run
    const enabledStepConfigs = input.stepsToExecute.filter(s => s.isEnabled);
    if (enabledStepConfigs.length === 0) {
      // No steps were enabled to run. Could be considered 'partial' or 'success' if that's desired.
      // For now, let's say 'partial' to indicate nothing substantial was tested.
      overallStatus = 'partial'; 
    } else {
      // All enabled steps were attempted (none were skipped due to halt)
      // and all of them must have succeeded (or were user-disabled and thus skipped, which is fine)
      const relevantResults = results.filter(r => {
          const originalStep = input.stepsToExecute.find(s => s.name === r.stepName);
          return originalStep?.isEnabled; // Only consider results for steps that were enabled
      });

      if (relevantResults.length > 0 && relevantResults.every(r => r.status === 'success')) {
        overallStatus = 'success';
      } else {
        // This case implies some enabled steps didn't succeed, or no enabled steps ran to completion.
        // Given the halt logic, if we get here and it's not 'success', it's likely 'partial'
        // (e.g., all steps were disabled by user but no failures occurred).
        overallStatus = 'partial'; 
      }
    }
  }

  // Final check if overallStatus is still 'testing' (e.g., no steps in input at all)
  if (overallStatus === 'testing') {
      if (input.stepsToExecute.length === 0) {
          overallStatus = 'partial'; // No steps to execute.
      } else {
          // If all steps were disabled, it would already be 'partial'.
          // This path might not be hit often with current logic.
          overallStatus = 'partial'; // Default if not clearly success or failure
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
    return testServerConnection(input);
  }
);
// Schemas are defined above but not exported from this file to comply with 'use server' requirements.
// Only types (ClientTestStep, etc.) and the main async function 'testServerConnection' are exported.
