import { Client, ClientChannel } from 'ssh2';
import { promisify } from 'util';

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

interface SshCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export class SshService {
  private client: Client | null = null;
  private connectionConfig: SshConnectionConfig | null = null;
  private readonly DEFAULT_RETRIES = 3;
  private readonly DEFAULT_RETRY_DELAY = 2000; // 2 seconds
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  private async attemptConnection(config: SshConnectionConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[SSH] Attempting to connect to ${config.username}@${config.host}:${config.port}`);
      const timeoutId = setTimeout(() => {
        if (this.client) {
          this.client.end();
        }
        reject(new Error(`Connection timeout after ${config.timeout || this.DEFAULT_TIMEOUT}ms`));
      }, config.timeout || this.DEFAULT_TIMEOUT);

      this.client = new Client();

      const authConfig: any = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: config.timeout || this.DEFAULT_TIMEOUT,
        algorithms: {
          serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ssh-ed25519']
        },
        hostVerifier: () => true
      };

      if (config.privateKey) {
        console.log('[SSH] Using private key authentication');
        authConfig.privateKey = config.privateKey;
      } else if (config.password) {
        console.log('[SSH] Using password authentication');
        authConfig.password = config.password;
      } else {
        clearTimeout(timeoutId);
        reject(new Error('Either password or privateKey must be provided'));
        return;
      }

      this.client
        .on('ready', () => {
          console.log('[SSH] Connection established successfully');
          clearTimeout(timeoutId);
          resolve();
        })
        .on('error', (err: Error) => {
          console.error('[SSH] Connection error:', err.message);
          clearTimeout(timeoutId);
          this.client = null;
          reject(err);
        })
        .connect(authConfig);
    });
  }

  async connect(config: SshConnectionConfig): Promise<void> {
    const retries = config.retries || this.DEFAULT_RETRIES;
    const retryDelay = config.retryDelay || this.DEFAULT_RETRY_DELAY;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.attemptConnection(config);
        this.connectionConfig = config;
        return;
      } catch (error: unknown) {
        if (attempt === retries) {
          throw new Error(`Failed to connect after ${retries} attempts: ${error instanceof Error ? error.message : String(error)}`);
        }
        console.warn(`Connection attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  async executeCommand(command: string): Promise<SshCommandResult> {
    if (!this.client) {
      throw new Error('SSH client not connected');
    }

    console.log(`[SSH] Executing command: ${command}`);
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Command execution timeout after ${this.connectionConfig?.timeout || this.DEFAULT_TIMEOUT}ms`));
      }, this.connectionConfig?.timeout || this.DEFAULT_TIMEOUT);

      this.client!.exec(command, (err: Error | undefined, stream: ClientChannel) => {
        if (err) {
          console.error('[SSH] Command execution error:', err.message);
          clearTimeout(timeoutId);
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';

        stream
          .on('data', (data: Buffer) => {
            stdout += data.toString();
          })
          .stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });

        stream.on('close', (code: number) => {
          console.log(`[SSH] Command completed with exit code: ${code}`);
          console.log('[SSH] stdout:', stdout);
          if (stderr) console.error('[SSH] stderr:', stderr);
          clearTimeout(timeoutId);
          resolve({ stdout, stderr, code });
        });

        stream.on('error', (err: Error) => {
          console.error('[SSH] Stream error:', err.message);
          clearTimeout(timeoutId);
          reject(err);
        });
      });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        console.log('[SSH] Disconnecting from server');
        this.client.end();
        this.client = null;
      }
      this.connectionConfig = null;
      resolve();
    });
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  getConnectionConfig(): SshConnectionConfig | null {
    return this.connectionConfig;
  }
}

// Create a singleton instance
export const sshService = new SshService(); 