
import { Client, ClientChannel } from 'ssh2';
// import { promisify } from 'util'; // Not used directly in this mock

interface SshConnectionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface SshCommandResult { // Exported for use in ExecutionConsolePage
  stdout: string;
  stderr: string;
  code: number;
}

export class SshService {
  private client: Client | null = null;
  private connectionConfig: SshConnectionConfig | null = null;
  private readonly DEFAULT_RETRIES = 1; // Reduce for faster simulation feedback
  private readonly DEFAULT_RETRY_DELAY = 500; 
  private readonly DEFAULT_TIMEOUT = 10000; 

  // SIMULATED: This is a mock connection. Real implementation would use ssh2 library to connect.
  private async attemptConnection(config: SshConnectionConfig): Promise<void> {
    console.log(`[SSH_MOCK] Simulating attempt to connect to ${config.username}@${config.host}:${config.port}`);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (config.host === 'fail_connection') {
          console.warn('[SSH_MOCK] Simulated connection failure.');
          reject(new Error('Simulated SSH connection failure.'));
        } else {
          console.log('[SSH_MOCK] Simulated SSH connection successful.');
          // In a real scenario, you'd set up this.client here.
          this.connectionConfig = config; // Store config on successful "mock" connection
          resolve();
        }
      }, 50 + Math.random() * 150);
    });
  }

  async connect(config: SshConnectionConfig): Promise<void> {
    // SIMULATED: Real implementation would use this.client.connect()
    const retries = config.retries || this.DEFAULT_RETRIES;
    const retryDelay = config.retryDelay || this.DEFAULT_RETRY_DELAY;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.attemptConnection(config);
        // this.client = new Client(); // In real code, client is setup in attemptConnection
        this.connectionConfig = config;
        return;
      } catch (error: unknown) {
        if (attempt === retries) {
          this.connectionConfig = null; // Explicitly set to null on final failure
          throw new Error(`Simulated: Failed to connect after ${retries} attempts: ${error instanceof Error ? error.message : String(error)}`);
        }
        console.warn(`Simulated: Connection attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  async executeCommand(command: string): Promise<SshCommandResult> {
    // SIMULATED: Real implementation would use this.client.exec()
    if (!this.isConnected()) { // Check based on connectionConfig for mock
      // Try to auto-connect if a config was previously set (e.g. by a successful preamble)
      if (this.connectionConfig) {
        console.warn("[SSH_MOCK] executeCommand called while disconnected, attempting auto-reconnect with stored config (simulated).");
        try {
            await this.connect(this.connectionConfig);
        } catch (connectError) {
             console.error("[SSH_MOCK] Auto-reconnect failed:", connectError);
             throw new Error('Simulated SSH client not connected and auto-reconnect failed.');
        }
      } else {
        throw new Error('Simulated SSH client not connected and no previous config to auto-connect.');
      }
    }

    console.log(`[SSH_MOCK] Simulating execution of command: ${command}`);
    return new Promise((resolve) => {
      setTimeout(() => {
        let stdout = `Simulated output for: ${command}\n`;
        let stderr = '';
        let code = 0;

        if (command.includes('error_command_example')) {
          stderr = 'Simulated error: Command failed.\nPermission denied (publickey,password).';
          code = 127;
          stdout += "No output due to error.\n";
        } else if (command.includes('ls -la')) {
          stdout += `drwxr-xr-x 2 user group 4096 May 30 10:00 .\n`;
          stdout += `drwxr-xr-x 5 user group 4096 May 29 15:00 ..\n`;
          stdout += `-rw-r--r-- 1 user group  123 May 30 09:00 some_file.txt\n`;
        } else if (command.includes('whoami')) {
          stdout += `${this.connectionConfig?.username || 'simulated_user'}\n`;
        } else if (command.includes('echo "SSH Connected"')) {
          stdout += `SSH Connected\n`;
        } else if (command.includes('radclient') || command.includes('radtest')) {
            stdout += `Simulating RADIUS client output for ${command}...\nSent Access-Request packet to ${this.connectionConfig?.host}\nReceived Access-Accept packet from ${this.connectionConfig?.host}\n`;
        } else {
          stdout += `... more simulated output ...\nCommand finished successfully.\n`;
        }
        
        // Include a timestamp in the mock output
        stdout += `\nMock execution completed at: ${new Date().toISOString()}\n`;

        console.log(`[SSH_MOCK] Simulated command completed. Code: ${code}, Stdout length: ${stdout.length}, Stderr length: ${stderr.length}`);
        resolve({ stdout, stderr, code });
      }, 100 + Math.random() * 300);
    });
  }

  async disconnect(): Promise<void> {
    // SIMULATED: Real implementation would use this.client.end()
    console.log('[SSH_MOCK] Simulating disconnect from server');
    // this.client = null; // In real code
    this.connectionConfig = null; // Clear config on disconnect for mock
    return Promise.resolve();
  }

  isConnected(): boolean {
    // SIMULATED: Real implementation would check this.client connection state
    return this.connectionConfig !== null; 
  }

  getConnectionConfig(): SshConnectionConfig | null {
    return this.connectionConfig;
  }
}

export const sshService = new SshService();
