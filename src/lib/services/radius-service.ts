
// import { spawn } from 'child_process'; // Not used in client-side simulation
// import radius from 'radius'; // Not used in client-side simulation
// import { promisify } from 'util'; // Not used in client-side simulation
import type { RadiusPacket as FullRadiusPacket, ScenarioVariable, ServerConfig as FullServerConfig } from '@/lib/types'; // Use full types

export interface RadiusAttribute { // Simplified for this mock
  name: string;
  value: string | number | Buffer;
}

export interface RadiusPacket { // Simplified for this mock
  code: 'Access-Request' | 'Access-Accept' | 'Access-Reject' | 'Access-Challenge' | 'Accounting-Request' | 'Accounting-Response' | string; // Allow string for flexibility
  identifier?: number;
  attributes: RadiusAttribute[];
}

interface RadiusServerConfig {
  host: string;
  port: number;
  secret: string;
  timeout?: number;
  retries?: number;
}

export interface SimulatedRadiusToolResult { // Export for ExecutionConsolePage
  simulatedFullOutput: string;
  simulatedSentPacket?: string;
  simulatedReceivedPacket?: string;
  code: number; // 0 for success, non-zero for error
  error?: string; // Error message if tool "failed"
}

export class RadiusService {
  constructor() {
    // No initialization needed for mock
  }

  private resolveVariable(value: string, scenarioVariables?: ScenarioVariable[]): string {
    if (typeof value !== 'string' || !scenarioVariables) return String(value);
    return value.replace(/\${(.*?)}/g, (match, varName) => {
      const variable = scenarioVariables.find(v => v.name === varName);
      if (variable) {
        if (variable.type === 'random_string') return `rand_str_${Math.random().toString(36).substring(2, 8)}`;
        if (variable.type === 'random_number') return String(Math.floor(Math.random() * 10000));
        return variable.value;
      }
      return match; 
    });
  }
  
  // SIMULATED: This method simulates the execution of radclient or radtest.
  // In a real backend, this would involve spawning the actual tool or using a RADIUS library.
  async simulateExecuteTool(
    packetData: FullRadiusPacket,
    serverConfig: FullServerConfig,
    scenarioVariables?: ScenarioVariable[]
  ): Promise<SimulatedRadiusToolResult> {
    const tool = packetData.executionTool || 'radclient';
    const toolOptions = packetData.toolOptions || {};
    const targetHost = this.resolveVariable(serverConfig.host, scenarioVariables);
    const targetPort = serverConfig.radiusAuthPort; // Assuming auth port for now
    let resolvedSecretValue = serverConfig.defaultSecret || (toolOptions as any).secret;
    if (!resolvedSecretValue) {
      console.warn(`[RADIUS_MOCK] No secret found in serverConfig.defaultSecret or toolOptions.secret for host ${targetHost}. Defaulting to an empty secret for simulation. Ensure a secret is configured if expected.`);
      resolvedSecretValue = ''; // Default to empty string
    }
    const secret = this.resolveVariable(resolvedSecretValue, scenarioVariables);

    let commandOutput = `Simulating ${tool} execution...\n`;
    commandOutput += `Target: ${targetHost}:${targetPort}\n`;
    commandOutput += `Secret: ${'*'.repeat(secret.length)}\n`;

    let simulatedSentPacket = `Sending ${tool === 'radclient' ? (toolOptions as any).type || 'Access-Request' : 'Access-Request'} to ${targetHost} port ${targetPort}\n`;
    simulatedSentPacket += `  Code: ${tool === 'radclient' ? (toolOptions as any).type || 'Access-Request' : 'Access-Request'}\n`;
    simulatedSentPacket += `  Identifier: ${Math.floor(Math.random() * 256)}\n`;

    packetData.attributes.forEach(attr => {
      const resolvedName = this.resolveVariable(attr.name, scenarioVariables);
      const resolvedValue = this.resolveVariable(attr.value, scenarioVariables);
      simulatedSentPacket += `  ${resolvedName} = "${resolvedValue}"\n`;
      commandOutput += `  Attribute: ${resolvedName} = "${resolvedValue}"\n`;
    });
    
    // Simulate some tool-specific options logging
    if (tool === 'radclient') {
        if ((toolOptions as any).count) commandOutput += `  Count: ${(toolOptions as any).count}\n`;
        if ((toolOptions as any).retries) commandOutput += `  Retries: ${(toolOptions as any).retries}\n`;
        if ((toolOptions as any).debug) commandOutput += `  Debug Mode: Enabled\n`;
    } else if (tool === 'radtest') {
        commandOutput += `  User: ${this.resolveVariable((toolOptions as any).user || 'testuser', scenarioVariables)}\n`;
        commandOutput += `  Auth Type: ${(toolOptions as any).authType || 'pap'}\n`;
    }


    commandOutput += `\nWaiting for response...\n`;

    // Simulate response
    const success = Math.random() > 0.15; // 85% chance of success
    let simulatedReceivedPacket = '';
    let code = 0;
    let error = undefined;

    if (success) {
      commandOutput += `Received response from ${targetHost} port ${targetPort}\n`;
      const responseType = tool === 'radclient' && (toolOptions as any).type === 'acct' ? 'Accounting-Response' : 'Access-Accept';
      simulatedReceivedPacket = `Received ${responseType} from ${targetHost} port ${targetPort}\n`;
      simulatedReceivedPacket += `  Code: ${responseType}\n`;
      simulatedReceivedPacket += `  Identifier: (matches request)\n`;
      simulatedReceivedPacket += `  Framed-IP-Address = 192.168.1.101\n`;
      simulatedReceivedPacket += `  Session-Timeout = 3600\n`;
      commandOutput += `  Framed-IP-Address = 192.168.1.101\n`;
      commandOutput += `  Session-Timeout = 3600\n`;
      commandOutput += `\nradclient: Server said: OK\n`;
    } else {
      commandOutput += `Received response from ${targetHost} port ${targetPort} (or timeout)\n`;
      const responseType = tool === 'radclient' && (toolOptions as any).type === 'acct' ? 'Accounting-Response' : 'Access-Reject'; // Or timeout
      simulatedReceivedPacket = `Received ${responseType} from ${targetHost} port ${targetPort}\n`;
      simulatedReceivedPacket += `  Code: ${responseType}\n`;
      simulatedReceivedPacket += `  Identifier: (matches request)\n`;
      simulatedReceivedPacket += `  Reply-Message = "Authentication Failed"\n`;
      commandOutput += `  Reply-Message = "Authentication Failed"\n`;
      commandOutput += `\nradclient: Server said: Authentication failed\n`;
      code = 1; // Simulate tool failure
      error = "Simulated: Server rejected request or timeout.";
    }
    
    commandOutput += `\n${tool} execution finished at ${new Date().toISOString()}.\n`;

    return { simulatedFullOutput: commandOutput, simulatedSentPacket, simulatedReceivedPacket, code, error };
  }
}

export const radiusService = new RadiusService();
