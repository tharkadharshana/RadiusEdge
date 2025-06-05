
// src/ai/flows/test-server-connection-flow.ts
"use server";
/**
 * @fileOverview An AI agent that simulates testing a RADIUS server connection and setup based on a customizable sequence of steps.
 * REAL_IMPLEMENTATION_NOTE: This entire flow is a SIMULATION. In a production system, this would be replaced by
 * a backend service that establishes a real SSH connection to the target server and executes the defined commands
 * (both preamble and main test steps).
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
  type: 'default' | 'custom' | 'preamble'; // Added 'preamble' type for clarity
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
  serverType: 'freeradius' | 'radiusd' | 'custom';
  customServerType?: string; // For when serverType is 'custom'
  connectionTestSshPreamble?: ClientTestStep[]; // New: Preamble steps for connection test
  stepsToExecute: ClientTestStep[]; // Main test steps
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
function interpolateCommand(
    command: string, 
    serverInfo: Pick<TestServerConnectionInput, 'host' | 'sshUser' | 'sshPort' | 'serverType' | 'customServerType'>
): string {
  let interpolated = command;
  
  // Handle serverType-dependent commands (e.g., for FreeRADIUS vs generic radiusd)
  if (command.includes('${serverType === "freeradius"')) {
    const isFreeRadius = serverInfo.serverType === "freeradius";
    // For 'custom' type, if customServerType is not 'freeradius', assume 'radiusd' behavior for these specific commands
    const effectiveTypeForCommand = (serverInfo.serverType === 'custom' && serverInfo.customServerType?.toLowerCase() === 'freeradius') ? 'freeradius' : 
                                   (serverInfo.serverType === 'freeradius' ? 'freeradius' : 'radiusd');

    if (command.includes("status")) {
      interpolated = `systemctl status ${effectiveTypeForCommand === "freeradius" ? "freeradius" : "radiusd"} 2>&1 || service ${effectiveTypeForCommand === "freeradius" ? "freeradius" : "radiusd"} status 2>&1`;
    } else if (command.includes("-XC")) {
      interpolated = `${effectiveTypeForCommand === "freeradius" ? "freeradius -XC 2>&1 || radiusd -XC 2>&1" : "radiusd -XC 2>&1"}`;
    }
  }

  // Regular variable substitutions
  interpolated = interpolated
    .replace(/\${host}/g, serverInfo.host)
    .replace(/\${sshUser}/g, serverInfo.sshUser)
    .replace(/\${sshPort}/g, String(serverInfo.sshPort))
    .replace(/\${serverType}/g, serverInfo.serverType)
    .replace(/\${customServerType}/g, serverInfo.customServerType || serverInfo.serverType);

  return interpolated;
}


async function executeStep(
  stepConfig: ClientTestStep,
  serverInfo: TestServerConnectionInput // Pass full input for interpolation and SSH config
): Promise<TestServerConnectionStepResult> {
  console.log(`[TEST_SRV] Executing step: ${stepConfig.name} (Type: ${stepConfig.type})`);
  
  if (!stepConfig.isEnabled) {
    console.log(`[TEST_SRV] Step "${stepConfig.name}" is disabled, skipping`);
    return {
      stepName: stepConfig.name,
      status: 'skipped',
      command: interpolateCommand(stepConfig.command, serverInfo),
      output: 'Step was disabled by user.',
    };
  }

  // REAL_IMPLEMENTATION_NOTE: In a live system, a backend service would establish a real SSH connection
  // using serverInfo (host, port, user, auth method, key/password) and execute the command.
  // The output would be the actual stdout/stderr from the server.
  // For this simulation, we continue to use the sshService mock.
  try {
    // Connect to SSH if not already connected or if connection details have changed
    // This logic ensures connection is established before command execution.
    if (!sshService.isConnected() || 
        sshService.getConnectionConfig()?.host !== serverInfo.host || 
        sshService.getConnectionConfig()?.port !== serverInfo.sshPort ||
        sshService.getConnectionConfig()?.username !== serverInfo.sshUser) { // Added username check
      console.log(`[TEST_SRV] Initiating SSH connection to ${serverInfo.sshUser}@${serverInfo.host}:${serverInfo.sshPort}`);
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

    // For the SSH Connection Attempt step (typically the first actual test step),
    // success is implied by reaching this point after the connect attempt.
    if (stepConfig.name === 'SSH Connection Attempt' && stepConfig.type !== 'preamble') {
      console.log('[TEST_SRV] SSH Connection test (as a main step) successful');
      return {
        stepName: stepConfig.name,
        status: 'success',
        command: 'SSH Connection Test',
        output: 'Successfully established SSH connection',
      };
    }

    const interpolatedCommand = interpolateCommand(stepConfig.command, serverInfo);
    console.log(`[TEST_SRV] Executing command: ${interpolatedCommand}`);
    const result = await sshService.executeCommand(interpolatedCommand); // Mocked execution

    const success = result.code === 0 && 
                   (!stepConfig.expectedOutputContains || 
                    result.stdout.includes(stepConfig.expectedOutputContains) ||
                    result.stderr.includes(stepConfig.expectedOutputContains)); // Check stderr too

    console.log(`[TEST_SRV] Step "${stepConfig.name}" ${success ? 'succeeded' : 'failed'}`);
    if (!success) {
      console.log('[TEST_SRV] Expected output not found or command failed.');
      console.log('[TEST_SRV] Expected:', stepConfig.expectedOutputContains);
      console.log('[TEST_SRV] Got stdout:', result.stdout);
      console.log('[TEST_SRV] Got stderr:', result.stderr);
    }

    return {
      stepName: stepConfig.name,
      status: success ? 'success' : 'failure',
      command: interpolatedCommand,
      output: `${result.stdout}${result.stderr ? `\nStderr: ${result.stderr}` : ''}`,
      error: success ? undefined : 'Command failed or output validation failed',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[TEST_SRV] Step "${stepConfig.name}" failed with error:`, errorMessage);
    return {
      stepName: stepConfig.name,
      status: 'failure',
      command: interpolateCommand(stepConfig.command, serverInfo),
      error: `Error during step execution: ${errorMessage}`,
    };
  }
}

// Main exported function
export async function testServerConnection(input: TestServerConnectionInput): Promise<TestServerConnectionOutput> {
  const results: TestServerConnectionStepResult[] = [];
  let executionShouldHalt = false;
  let overallStatus: TestServerConnectionOutput['overallStatus'] = 'testing';

  // REAL_IMPLEMENTATION_NOTE: For a live system, the backend would handle establishing one SSH session
  // (if Server SSH details are provided) and run all preamble and main test steps within it,
  // or manage sessions appropriately if preambles target different intermediary hosts.

  try {
    // 1. Execute Connection Test SSH Preamble Steps (if any)
    if (input.connectionTestSshPreamble && input.connectionTestSshPreamble.length > 0) {
      console.log("[TEST_SRV] Starting Connection Test SSH Preamble execution...");
      for (const preambleStepConfig of input.connectionTestSshPreamble) {
        if (executionShouldHalt) {
          results.push({
            stepName: preambleStepConfig.name + " (Preamble)",
            status: 'skipped',
            command: interpolateCommand(preambleStepConfig.command, input),
            output: 'Skipped due to previous preamble failure.',
          });
          continue;
        }
        const preambleStepResult = await executeStep({ ...preambleStepConfig, type: 'preamble' }, input);
        results.push(preambleStepResult);
        if (preambleStepResult.status === 'failure') {
          executionShouldHalt = true; 
          console.log(`[TEST_SRV] Connection Test SSH Preamble step "${preambleStepConfig.name}" failed. Halting further execution.`);
        }
      }
      if (executionShouldHalt) {
         console.log("[TEST_SRV] Connection Test SSH Preamble failed. Main test steps will be skipped.");
      } else {
         console.log("[TEST_SRV] Connection Test SSH Preamble completed successfully.");
      }
    }


    // 2. Execute Main Test Steps
    if (!executionShouldHalt) { // Only proceed if preamble (if any) was successful
      console.log("[TEST_SRV] Starting main test steps execution...");
      for (const stepConfig of input.stepsToExecute) {
        if (executionShouldHalt && stepConfig.isMandatory) { // This condition might be redundant if already halted
          // This case should be caught by the outer halt check, but for safety:
          results.push({
            stepName: stepConfig.name,
            status: 'skipped',
            command: interpolateCommand(stepConfig.command, input),
            output: 'Skipped due to previous critical failure.',
          });
          continue;
        }
        if (executionShouldHalt && !stepConfig.isMandatory) {
          results.push({
            stepName: stepConfig.name,
            status: 'skipped',
            command: interpolateCommand(stepConfig.command, input),
            output: 'Skipped due to previous non-critical failure in preamble or optional step.',
          });
          continue;
        }


        const stepResult = await executeStep(stepConfig, input);
        results.push(stepResult);

        if (stepResult.status === 'failure' && stepConfig.isMandatory) {
          executionShouldHalt = true;
          console.log(`[TEST_SRV] Mandatory test step "${stepConfig.name}" failed. Halting further critical execution.`);
        } else if (stepResult.status === 'failure' && !stepConfig.isMandatory) {
            // Non-mandatory failure, log it but continue for other non-mandatory or subsequent mandatory
            console.log(`[TEST_SRV] Non-mandatory test step "${stepConfig.name}" failed. Continuing.`);
        }
      }
    } else {
        // If preamble failed, mark all main steps as skipped
        input.stepsToExecute.forEach(stepConfig => {
            if (stepConfig.isEnabled) { // Only skip enabled steps
                results.push({
                    stepName: stepConfig.name,
                    status: 'skipped',
                    command: interpolateCommand(stepConfig.command, input),
                    output: 'Skipped due to SSH Preamble failure.',
                });
            }
        });
    }

    // Determine overall status
    const hasFailures = results.some(r => r.status === 'failure');
    const hasSuccess = results.some(r => r.status === 'success');

    if (hasFailures) {
      overallStatus = hasSuccess ? 'partial' : 'failure';
    } else if (results.every(r => r.status === 'skipped' || r.status === 'success') && hasSuccess) {
      overallStatus = 'success';
    } else if (results.every(r => r.status === 'skipped')) {
        overallStatus = 'failure'; // Or 'partial' if some preambles passed but main were skipped
    }


  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during test server connection flow';
    console.error("[TEST_SRV] Critical error in testServerConnection flow:", errorMessage);
    results.push({
      stepName: 'Flow Error',
      status: 'failure',
      error: errorMessage,
    });
    overallStatus = 'failure';
  } finally {
    try {
      await sshService.disconnect();
      console.log("[TEST_SRV] SSH disconnected after test sequence.");
    } catch (error) {
      console.error('[TEST_SRV] Error disconnecting SSH:', error);
    }
  }

  return {
    overallStatus,
    steps: results,
  };
}

// Server action for getting default test steps remains the same
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

    