
// src/ai/flows/test-server-connection-flow.ts
'use server';
/**
 * @fileOverview An AI agent that simulates testing a RADIUS server connection and setup.
 *
 * - testServerConnection - A function that simulates testing the server connection.
 * - TestServerConnectionInput - The input type for the testServerConnection function.
 * - TestServerConnectionOutput - The return type for the testServerConnection function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TestServerConnectionInputSchema = z.object({
  id: z.string().describe("The ID of the server configuration being tested."),
  host: z.string().describe('The hostname or IP address of the server.'),
  sshPort: z.number().describe('The SSH port for the server.'),
  sshUser: z.string().describe('The SSH username.'),
  authMethod: z.enum(['key', 'password']).describe('The SSH authentication method.'),
  privateKey: z.string().optional().describe('The SSH private key, if authMethod is key.'),
  password: z.string().optional().describe('The SSH password, if authMethod is password.'),
  serverType: z.enum(['freeradius', 'custom', 'other']).describe('The type of RADIUS server software.'),
});
export type TestServerConnectionInput = z.infer<typeof TestServerConnectionInputSchema>;

const TestServerConnectionStepSchema = z.object({
  stepName: z.string().describe('The name of the test step.'),
  status: z.enum(['success', 'failure', 'skipped', 'running', 'pending']).describe('The status of the step.'),
  output: z.string().optional().describe('The output or logs from the step.'),
  error: z.string().optional().describe('Any error message if the step failed.'),
  command: z.string().optional().describe('The simulated command executed for this step.'),
});
export type TestServerConnectionStep = z.infer<typeof TestServerConnectionStepSchema>;

const TestServerConnectionOutputSchema = z.object({
  overallStatus: z.enum(['success', 'failure', 'partial', 'testing']).describe('The overall status of the connection test.'),
  steps: z.array(TestServerConnectionStepSchema).describe('A list of steps performed during the test and their outcomes.'),
});
export type TestServerConnectionOutput = z.infer<typeof TestServerConnectionOutputSchema>;

// Simulate a delay
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function testServerConnection(input: TestServerConnectionInput): Promise<TestServerConnectionOutput> {
  // This flow simulates the connection test. In a real scenario,
  // this would involve actual SSH connections and command execution.
  const steps: TestServerConnectionStep[] = [];
  let overallStatus: TestServerConnectionOutput['overallStatus'] = 'success';

  // 1. Simulate SSH Connection
  await simulateDelay(500);
  const sshSuccess = Math.random() > 0.1; // 90% success rate for SSH
  steps.push({
    stepName: 'SSH Connection',
    status: sshSuccess ? 'success' : 'failure',
    output: sshSuccess ? `Successfully connected to ${input.host}:${input.sshPort} as ${input.sshUser}.` : `Failed to connect to ${input.host}:${input.sshPort}. Check credentials or network.`,
    error: sshSuccess ? undefined : 'Simulated SSH connection failure.',
    command: `ssh ${input.sshUser}@${input.host} -p ${input.sshPort}`
  });
  if (!sshSuccess) {
    return { overallStatus: 'failure', steps };
  }

  // 2. Simulate Checking for radclient
  await simulateDelay(300);
  const radclientFound = Math.random() > 0.05; // 95% found
  steps.push({
    stepName: 'Check for radclient',
    status: radclientFound ? 'success' : 'failure',
    output: radclientFound ? 'radclient found: /usr/bin/radclient' : 'radclient not found in common paths.',
    error: radclientFound ? undefined : 'Simulated: radclient executable not found.',
    command: 'which radclient'
  });
  if (!radclientFound) overallStatus = 'partial';


  // 3. Simulate Checking for radtest
  await simulateDelay(300);
  const radtestFound = Math.random() > 0.1; // 90% found
  steps.push({
    stepName: 'Check for radtest',
    status: radtestFound ? 'success' : 'failure',
    output: radtestFound ? 'radtest found: /usr/bin/radtest' : 'radtest not found in common paths. This is often part of FreeRADIUS utilities.',
    error: radtestFound ? undefined : 'Simulated: radtest executable not found.',
    command: 'which radtest'
  });
  if (!radtestFound && overallStatus !== 'failure') overallStatus = 'partial';

  // 4. Simulate Validating RADIUS Configuration
  await simulateDelay(700);
  const radiusConfigValid = Math.random() > 0.15; // 85% valid
  let radiusConfigCmd = 'radiusd -XC'; // Default for generic
  if (input.serverType === 'freeradius') {
      radiusConfigCmd = 'freeradius -XC';
  }
  steps.push({
    stepName: `Validate RADIUS Configuration (${input.serverType})`,
    status: radiusConfigValid ? 'success' : 'failure',
    output: radiusConfigValid ? 'Configuration check passed. Ready to start.' : 'Configuration check failed. Errors found:\nERROR: Invalid syntax in /etc/freeradius/3.0/sites-enabled/default\n...',
    error: radiusConfigValid ? undefined : 'Simulated RADIUS configuration errors.',
    command: radiusConfigCmd
  });
  if (!radiusConfigValid) overallStatus = 'failure'; // Config failure is critical

  // 5. Simulate Checking RADIUS Service Status
  await simulateDelay(400);
  const radiusServiceRunning = radiusConfigValid ? Math.random() > 0.1 : false; // Only running if config was ok (90% of time)
  let radiusServiceCmd = 'systemctl status radiusd';
  if (input.serverType === 'freeradius') {
      radiusServiceCmd = 'systemctl status freeradius';
  }
  steps.push({
    stepName: `Check RADIUS Service Status (${input.serverType})`,
    status: radiusServiceRunning ? 'success' : (radiusConfigValid ? 'failure' : 'skipped'),
    output: radiusServiceRunning ? `${input.serverType} service is active (running).` : (radiusConfigValid ? `${input.serverType} service is inactive (dead).` : 'Skipped due to configuration errors.'),
    error: radiusServiceRunning || !radiusConfigValid ? undefined : `Simulated: ${input.serverType} service not running.`,
    command: radiusServiceCmd
  });
  if (!radiusServiceRunning && radiusConfigValid) {
    if (overallStatus !== 'failure') overallStatus = 'partial';
  }
  
  // Determine final overall status if not already a failure
  if (overallStatus !== 'failure') {
      const hasAnyFailure = steps.slice(1).some(s => s.status === 'failure'); // Exclude SSH for partial
      if (hasAnyFailure) {
          overallStatus = 'partial';
      } else {
          overallStatus = 'success';
      }
  }

  return { overallStatus, steps };
}

const testServerConnectionFlow = ai.defineFlow(
  {
    name: 'testServerConnectionFlow',
    inputSchema: TestServerConnectionInputSchema,
    outputSchema: TestServerConnectionOutputSchema,
  },
  async (input) => {
    return testServerConnection(input);
  }
);
