
// src/ai/flows/test-server-connection-flow.ts
'use server';
/**
 * @fileOverview An AI agent that simulates testing a RADIUS server connection and setup based on a customizable sequence of steps.
 *
 * - testServerConnection - A function that simulates testing the server connection.
 * - TestServerConnectionInput - The input type for the testServerConnection function.
 * - TestServerConnectionOutput - The return type for the testServerConnection function.
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
    
    // Special handling for serverType dependent commands
    if (interpolated.includes('${serverType === "freeradius" ? "freeradius" : "radiusd"}')) {
        const radiusdCmd = serverInfo.serverType === "freeradius" ? "freeradius" : "radiusd";
        interpolated = interpolated.replace(/\$\{serverType === "freeradius" \? "freeradius" : "radiusd"\}/g, radiusdCmd);
    } else { // General replacement for serverType if not in conditional
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
    let simulatedOutput = `Simulated output for command: ${interpolatedCommand}\n... success ...`;
    let simulatedError;

    // Determine success rate and output based on command
    if (cmdLower.includes('ssh ')) { // Added space to avoid matching 'sshUser' etc.
        successRate = 0.9;
        if (Math.random() < successRate) {
            simulatedOutput = `Successfully connected to ${serverInfo.host}:${serverInfo.sshPort} as ${serverInfo.sshUser}.`;
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
        if (Math.random() < successRate) {
            simulatedOutput = 'Configuration check passed. Ready to start.';
        } else {
            simulatedOutput = `Configuration check failed. Errors found:\nERROR: Invalid syntax in /etc/${serverInfo.serverType === 'freeradius' ? 'freeradius/3.0' : 'raddb'}/sites-enabled/default\n...`;
            simulatedError = 'Simulated RADIUS configuration errors.';
        }
    } else if (cmdLower.includes('systemctl status') || cmdLower.includes('service status')) {
        successRate = 0.9;
        const serviceName = interpolatedCommand.split(' ').pop() || (serverInfo.serverType === 'freeradius' ? 'freeradius' : 'radiusd');
        if (Math.random() < successRate) {
            simulatedOutput = `${serviceName} service is active (running).`;
        } else {
            simulatedOutput = `${serviceName} service is inactive (dead).`;
            simulatedError = `Simulated: ${serviceName} service not running.`;
        }
    } else { // Custom command
        simulatedOutput = `Simulating custom command: ${interpolatedCommand}\nCustom script output example... Operation completed.`;
        // For custom, we rely on the default successRate or specific error simulation
        if (Math.random() >= successRate) {
            simulatedError = `Simulated error for custom command: ${interpolatedCommand}`;
            simulatedOutput = `Simulated failure for custom command: ${interpolatedCommand}\nError: Something went wrong.`;
        }
    }
    
    const isSuccess = !simulatedError; // Success if no error was explicitly simulated

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
    if (criticalFailureEncountered) { 
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
  const hasMandatoryFailure = results.some((r, i) => r.status === 'failure' && input.stepsToExecute[i].isMandatory);
  
  if (hasMandatoryFailure) {
    overallStatus = 'failure';
  } else if (hasAnyFailure) {
    overallStatus = 'partial';
  } else if (results.every(r => r.status === 'success' || r.status === 'skipped')) {
     if (results.some(r => r.status === 'success')) {
        overallStatus = 'success';
     } else { // All skipped, no successes
        overallStatus = 'partial'; // Or a new status like 'all_skipped' if needed
     }
  } else {
    overallStatus = 'success'; // Should be covered by above, but as a fallback
  }
  
  // Override if the very first step (typically SSH) failed and was mandatory
  if (input.stepsToExecute.length > 0 && input.stepsToExecute[0].isMandatory && results.length > 0 && results[0].status === 'failure') {
      if (results[0].stepName.toLowerCase().includes('ssh')) {
          overallStatus = 'failure'; // SSH failure is critical
      }
  }


  return { overallStatus, steps: results };
}


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
// The actual `testServerConnection` async function is exported and used by the UI.
// Schemas (ClientTestStepSchema, etc.) are defined but not exported from this 'use server' file.
