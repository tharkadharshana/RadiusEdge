// src/ai/flows/test-server-connection-flow.ts
"use server";
/**
 * @fileOverview An AI agent that simulates testing a RADIUS server connection and setup based on a customizable sequence of steps.
 * REAL_IMPLEMENTATION_NOTE: This entire flow is a SIMULATION. In a production system, this would be replaced by
 * a backend service that establishes a real SSH connection to the target server and executes the defined commands.
 *
 * - testServerConnection - A function that simulates testing the server connection.
 * - TestServerConnectionInput - The input type for the testServerConnection function.
 * - TestServerConnectionOutput - The return type for the testServerConnection function.
 * - ClientTestStep - The type for individual client-provided steps.
 */

import { sshService } from '@/lib/services';

// Types
export type ClientTestStep = {
  name: string;
  command: string;
  isEnabled: boolean;
  isMandatory?: boolean;
  type: 'default' | 'custom';
  expectedOutputContains?: string;
};

export type TestServerConnectionInput = {
  id: string;
  host: string;
  sshPort: number;
  sshUser: string;
  authMethod: 'key' | 'password';
  privateKey?: string;
  password?: string;
  serverType: 'freeradius' | 'custom' | 'other';
  stepsToExecute: ClientTestStep[];
};

export type TestServerConnectionStepResult = {
  stepName: string;
  status: 'success' | 'failure' | 'skipped';
  command?: string;
  output?: string;
  error?: string;
};

export type TestServerConnectionOutput = {
  overallStatus: 'success' | 'failure' | 'partial' | 'testing';
  steps: TestServerConnectionStepResult[];
};

// Helper functions
function interpolateCommand(command: string, serverInfo: Pick<TestServerConnectionInput, 'host' | 'sshUser' | 'sshPort' | 'serverType'>): string {
  // First handle our special case commands that need JavaScript evaluation
  if (command.includes('${serverType === "freeradius"')) {
    // Handle RADIUS commands specifically
    const isFreeRadius = serverInfo.serverType === "freeradius";
    if (command.includes("status")) {
      // Handle status check command
      return `systemctl status ${isFreeRadius ? "freeradius" : "radiusd"} 2>&1 || service ${isFreeRadius ? "freeradius" : "radiusd"} status 2>&1`;
    } else if (command.includes("-XC")) {
      // Handle config check command
      return isFreeRadius ? "freeradius -XC 2>&1 || radiusd -XC 2>&1" : "radiusd -XC 2>&1";
    }
  }

  // Then handle regular variable substitutions
  return command
    .replace(/\${host}/g, serverInfo.host)
    .replace(/\${sshUser}/g, serverInfo.sshUser)
    .replace(/\${sshPort}/g, String(serverInfo.sshPort))
    .replace(/\${serverType}/g, serverInfo.serverType);
}

async function executeStep(
  stepConfig: ClientTestStep,
  serverInfo: Pick<TestServerConnectionInput, 'id' | 'host' | 'sshPort' | 'sshUser' | 'authMethod' | 'privateKey' | 'password' | 'serverType'>
): Promise<TestServerConnectionStepResult> {
  console.log(`[TEST] Executing step: ${stepConfig.name}`);
  
  if (!stepConfig.isEnabled) {
    console.log(`[TEST] Step "${stepConfig.name}" is disabled, skipping`);
    return {
      stepName: stepConfig.name,
      status: 'skipped',
      command: interpolateCommand(stepConfig.command, serverInfo),
      output: 'Step was disabled by user.',
    };
  }

  try {
    // Connect to SSH if not already connected or if connection details have changed
    if (!sshService.isConnected() || 
        sshService.getConnectionConfig()?.host !== serverInfo.host || 
        sshService.getConnectionConfig()?.port !== serverInfo.sshPort) {
      console.log(`[TEST] Initiating SSH connection to ${serverInfo.host}:${serverInfo.sshPort}`);
      await sshService.connect({
        host: serverInfo.host,
        port: serverInfo.sshPort,
        username: serverInfo.sshUser,
        password: serverInfo.password,
        privateKey: serverInfo.privateKey,
        retries: 3,
        retryDelay: 2000,
        timeout: 30000
      });
    }

    // For the SSH Connection Attempt step, we don't need to execute any command
    if (stepConfig.name === 'SSH Connection Attempt') {
      console.log('[TEST] SSH Connection test successful');
      return {
        stepName: stepConfig.name,
        status: 'success',
        command: 'SSH Connection Test',
        output: 'Successfully established SSH connection',
      };
    }

    // Execute the command
    const interpolatedCommand = interpolateCommand(stepConfig.command, serverInfo);
    console.log(`[TEST] Executing command: ${interpolatedCommand}`);
    const result = await sshService.executeCommand(interpolatedCommand);

    // Check for success based on exit code and expected output
    const success = result.code === 0 && 
                   (!stepConfig.expectedOutputContains || 
                    result.stdout.includes(stepConfig.expectedOutputContains));

    console.log(`[TEST] Step "${stepConfig.name}" ${success ? 'succeeded' : 'failed'}`);
    if (!success) {
      console.log('[TEST] Expected output not found or command failed');
      console.log('[TEST] Expected:', stepConfig.expectedOutputContains);
      console.log('[TEST] Got stdout:', result.stdout);
      console.log('[TEST] Got stderr:', result.stderr);
    }

    return {
      stepName: stepConfig.name,
      status: success ? 'success' : 'failure',
      command: interpolatedCommand,
      output: `${result.stdout}${result.stderr ? `\nError: ${result.stderr}` : ''}`,
      error: success ? undefined : 'Command failed or output validation failed',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[TEST] Step "${stepConfig.name}" failed with error:`, errorMessage);
    return {
      stepName: stepConfig.name,
      status: 'failure',
      command: interpolateCommand(stepConfig.command, serverInfo),
      error: `SSH Error: ${errorMessage}`,
    };
  }
}

// Main exported function
export async function testServerConnection(input: TestServerConnectionInput): Promise<TestServerConnectionOutput> {
  const results: TestServerConnectionStepResult[] = [];
  let executionShouldHalt = false;
  let overallStatus: TestServerConnectionOutput['overallStatus'] = 'testing';

  try {
    for (const stepConfig of input.stepsToExecute) {
      if (executionShouldHalt) {
        results.push({
          stepName: stepConfig.name,
          status: 'skipped',
          command: interpolateCommand(stepConfig.command, input),
          output: 'Skipped due to previous critical failure.',
        });
        continue;
      }

      const stepResult = await executeStep(stepConfig, input);
      results.push(stepResult);

      if (stepResult.status === 'failure') {
        executionShouldHalt = true;
      }
    }

    // Determine overall status
    const hasFailures = results.some(r => r.status === 'failure');
    const hasSkipped = results.some(r => r.status === 'skipped');
    const hasSuccess = results.some(r => r.status === 'success');

    if (hasFailures) {
      overallStatus = hasSuccess ? 'partial' : 'failure';
    } else {
      overallStatus = 'success';
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    results.push({
      stepName: 'Error',
      status: 'failure',
      error: errorMessage,
    });
    overallStatus = 'failure';
  } finally {
    // Always try to disconnect SSH when done
    try {
      await sshService.disconnect();
    } catch (error) {
      console.error('Error disconnecting SSH:', error);
    }
  }

  return {
    overallStatus,
    steps: results,
  };
}

// Server action for getting test steps
export async function getDefaultTestSteps(): Promise<ClientTestStep[]> {
  return [
    { 
      name: 'SSH Connection Attempt', 
      command: 'echo "SSH Connected"', 
      isEnabled: true, 
      isMandatory: true, 
      type: 'default', 
      expectedOutputContains: "SSH Connected" 
    },
    { 
      name: 'Check for radclient', 
      command: 'command -v radclient || which radclient', 
      isEnabled: true, 
      isMandatory: false, 
      type: 'default', 
      expectedOutputContains: "radclient" 
    },
    { 
      name: 'Check for radtest', 
      command: 'command -v radtest || which radtest', 
      isEnabled: true, 
      isMandatory: false, 
      type: 'default', 
      expectedOutputContains: "radtest" 
    },
    { 
      name: 'Validate RADIUS Config', 
      command: '${serverType === "freeradius" ? "freeradius -XC 2>&1 || radiusd -XC 2>&1" : "radiusd -XC 2>&1"}', 
      isEnabled: true, 
      isMandatory: true, 
      type: 'default', 
      expectedOutputContains: "appears to be OK" 
    },
    { 
      name: 'Check RADIUS Service Status', 
      command: '${serverType === "freeradius" ? "systemctl status freeradius 2>&1 || service freeradius status 2>&1" : "systemctl status radiusd 2>&1 || service radiusd status 2>&1"}', 
      isEnabled: true, 
      isMandatory: true, 
      type: 'default', 
      expectedOutputContains: "active" 
    }
  ];
}
