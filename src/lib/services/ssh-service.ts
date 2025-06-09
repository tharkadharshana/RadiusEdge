
// import type { Client, ConnectConfig as Ssh2ConnectConfig } from 'ssh2'; // Keep for RealSshService type hints (COMMENTED OUT FOR CLIENT BUILD)

// IMPORTANT: When populating SshConnectionConfig for use with RealSshService:
// - `password` and `privateKey` fields should be sourced from secure locations
//   such as environment variables or a secrets management system.
//   DO NOT hardcode credentials in application code.
// - `privateKey` should be the string content of the private key file.
// - `authMethod` must be specified as 'password' or 'key'.
export interface SshConnectionConfig {
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'key';
  password?: string;
  privateKey?: string; // Content of the key
  retries?: number;
  retryDelay?: number;
  timeout?: number; // Connection timeout in ms
}

export interface SshCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

// MockSshService for client-side simulation
class MockSshService {
  private mockConnectionConfig: SshConnectionConfig | null = null;
  private mockIsConnected: boolean = false;

  async connect(config: SshConnectionConfig): Promise<void> {
    console.log(`[SSH_MOCK] Simulating connection to ${config.host}:${config.port} with user ${config.username}`);
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    if (config.host === 'fail_ssh_connect') {
      this.mockIsConnected = false;
      this.mockConnectionConfig = null;
      console.warn('[SSH_MOCK] Simulated SSH connection failure.');
      throw new Error('Simulated SSH connection failure.');
    }
    this.mockConnectionConfig = config;
    this.mockIsConnected = true;
    console.log('[SSH_MOCK] Simulated SSH connection successful.');
  }

  async executeCommand(command: string): Promise<SshCommandResult> {
    if (!this.mockIsConnected) {
      // Attempt to auto-reconnect if config is available (mimics a more robust mock)
      if (this.mockConnectionConfig) {
        console.warn('[SSH_MOCK] executeCommand called while not connected. Attempting auto-reconnect with previous config.');
        try {
          await this.connect(this.mockConnectionConfig);
        } catch (e) {
          console.error('[SSH_MOCK] Auto-reconnect failed:', e);
          throw new Error('Simulated SSH client auto-reconnect failed.');
        }
      } else {
        throw new Error('Simulated SSH client not connected and no previous config to auto-connect.');
      }
    }
    
    // Ensure connectionConfig is available after potential auto-reconnect
    if (!this.mockConnectionConfig) {
        throw new Error('Simulated SSH client internal error: connection config missing after successful connect.')
    }

    console.log(`[SSH_MOCK] Simulating execution of command on ${this.mockConnectionConfig.host}: "${command}"`);
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    let stdout = `Simulated output for: ${command}\n`;
    let stderr = '';
    let code = 0;

    // Simulate more diverse outputs
    if (command.toLowerCase().includes('error_command_example')) {
      stdout = 'Something went partially right...\n';
      stderr = 'Simulated error: Specific command failed with a trace.\nError code: 123\nAt line: 42\n';
      code = 1;
    } else if (command.toLowerCase().includes('whoami')) {
      stdout += `${this.mockConnectionConfig.username}\n`;
    } else if (command.toLowerCase().includes('ls -la')) {
      stdout += 'total 12\n';
      stdout += 'drwxr-xr-x 2 user group 4096 Jun  9 07:00 .\n';
      stdout += 'drwxr-xr-x 5 user group 4096 Jun  9 06:00 ..\n';
      stdout += '-rw-r--r-- 1 user group  123 Jun  9 07:00 some_file.txt\n';
      stdout += '-rwxr-xr-x 1 user group  456 Jun  8 10:00 an_executable\n';
    } else if (command.toLowerCase().includes('ping -c 1 google.com')) {
      stdout += 'PING google.com (172.217.160.142) 56(84) bytes of data.\n';
      stdout += '64 bytes from lhr48s26-in-f14.1e100.net (172.217.160.142): icmp_seq=1 ttl=116 time=10.5 ms\n\n';
      stdout += '--- google.com ping statistics ---\n';
      stdout += '1 packets transmitted, 1 received, 0% packet loss, time 0ms\n';
      stdout += 'rtt min/avg/max/mdev = 10.517/10.517/10.517/0.000 ms\n';
    } else if (command.toLowerCase().includes('systemctl status freeradius') || command.toLowerCase().includes('service freeradius status') || command.toLowerCase().includes('systemctl status radiusd') || command.toLowerCase().includes('service radiusd status')) {
        stdout += '● radius_generic.service - RADIUS Service daemon\n';
        stdout += '   Loaded: loaded (/lib/systemd/system/radius_generic.service; enabled; vendor preset: enabled)\n';
        stdout += '   Active: active (running) since Mon 2023-10-09 10:00:00 UTC; 1 day ago\n';
        stdout += ' Main PID: 1234 (radiusd)\n';
    } else if (command.toLowerCase().includes('freeradius -xc') || command.toLowerCase().includes('radiusd -xc')) {
        stdout += 'radiusd: Info: Loaded virtual server <default>\n';
        stdout += 'radiusd: Info: Loaded virtual server <inner-tunnel>\n';
        stdout += 'radiusd: Info: Ready to process requests\n';
        stdout += 'Configuration appears to be OK.\n'; // Key success string
    } else if (command.toLowerCase().includes('radclient') || command.toLowerCase().includes('radtest')){
        stdout += 'Simulated radclient/radtest output...\n';
        stdout += 'Sending Access-Request to 127.0.0.1 port 1812\n';
        stdout += '    User-Name = "testuser"\n';
        stdout += 'Received Access-Accept from 127.0.0.1 port 1812\n';
        stdout += '    Framed-IP-Address = 192.168.1.100\n';
    }
    else {
      stdout += `Simulated output for an unrecognized command.\nOK.\nProcessed on ${new Date().toISOString()}\n`;
    }
    console.log(`[SSH_MOCK] Command "${command}" simulated with code ${code}.`);
    return { stdout, stderr, code };
  }

  async disconnect(): Promise<void> {
    if (this.mockIsConnected) {
      console.log(`[SSH_MOCK] Simulating disconnect from ${this.mockConnectionConfig?.host}`);
      this.mockIsConnected = false;
      this.mockConnectionConfig = null; // Clear config on disconnect
      await new Promise(resolve => setTimeout(resolve, 50));
    } else {
      console.log('[SSH_MOCK] No active mock connection to disconnect.');
    }
  }

  isConnected(): boolean {
    return this.mockIsConnected;
  }

  getConnectionConfig(): SshConnectionConfig | null {
    return this.mockConnectionConfig;
  }
}


// RealSshService provides methods to connect to and interact with an SSH server.
// It uses the 'ssh2' library for the underlying SSH communication.
// THIS IS FOR FUTURE BACKEND USE AND SHOULD NOT BE INSTANTIATED FOR CLIENT-SIDE PROTOTYPE.
/* COMMENTING OUT RealSshService for client-side prototype build
export class RealSshService {
  private client: Client | null = null;
  private connectionConfig: SshConnectionConfig | null = null;

  constructor() {}

  async connect(config: SshConnectionConfig): Promise<void> {
    // @ts-ignore: ssh2 types might not be perfectly aligned or available in this context
    const SshClient = (await import('ssh2')).Client as typeof Client;
    return new Promise((resolve, reject) => {
      if (this.client && this.client.readable) {
        console.warn('[REAL_SSH_SERVICE] Already connected or connecting. Disconnecting existing before new attempt.');
        this.client.end();
      }

      this.client = new SshClient();
      this.connectionConfig = config;

      const ssh2Config: Ssh2ConnectConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: config.timeout || 20000,
      };

      if (config.authMethod === 'password') {
        if (!config.password) {
          this.connectionConfig = null;
          return reject(new Error('Password authentication selected but no password provided.'));
        }
        ssh2Config.password = config.password;
      } else if (config.authMethod === 'key') {
        if (!config.privateKey) {
          this.connectionConfig = null;
          return reject(new Error('Key authentication selected but no privateKey provided.'));
        }
        ssh2Config.privateKey = config.privateKey;
      } else {
        this.connectionConfig = null;
        return reject(new Error('Invalid authMethod specified. Must be "password" or "key".'));
      }

      const onReady = () => {
        console.log(`[REAL_SSH_SERVICE] Connected to ${config.host}:${config.port}`);
        this.client?.removeListener('error', onError);
        this.client?.removeListener('close', onClose);
        resolve();
      };

      const onError = (err: Error) => {
        console.error(`[REAL_SSH_SERVICE] Connection error for ${config.host}:${config.port}:`, err.message);
        if (this.client?.writable) {
            this.client.end();
        }
        this.client = null;
        this.connectionConfig = null;
        this.client?.removeListener('ready', onReady);
        this.client?.removeListener('close', onClose);
        reject(err);
      };

      const onClose = () => {
        console.log(`[REAL_SSH_SERVICE] Connection closed for ${config.host}:${config.port}`);
        this.client?.removeListener('ready', onReady);
        this.client?.removeListener('error', onError);
      };

      this.client.on('ready', onReady);
      this.client.on('error', onError);
      this.client.on('close', onClose);

      console.log(`[REAL_SSH_SERVICE] Attempting to connect to ${config.host}:${config.port} with user ${config.username} using ${config.authMethod}.`);
      this.client.connect(ssh2Config);
    });
  }

  async executeCommand(command: string): Promise<SshCommandResult> {
    return new Promise((resolve, reject) => {
        if (!this.client || !this.client.readable) {
            return reject(new Error('SSH client not connected or not active.'));
        }

        let stdout = '';
        let stderr = '';
        let exitCode: number = -1;

        this.client.exec(command, (err, stream) => {
            if (err) {
                console.error(`[REAL_SSH_SERVICE] Error executing command "${command}":`, err);
                return reject(err);
            }

            stream.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            stream.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            stream.on('close', (code: number | null, signal?: string) => {
                exitCode = code === null ? -1 : code;
                if (signal) {
                    console.log(`[REAL_SSH_SERVICE] Command "${command}" terminated by signal: ${signal}. Exit code: ${exitCode}`);
                    if (!stderr && signal) stderr += `Command terminated by signal: ${signal}.`;
                } else {
                    console.log(`[REAL_SSH_SERVICE] Command "${command}" finished. Exit code: ${exitCode}`);
                }
                resolve({ stdout, stderr, code: exitCode });
            });

            stream.on('error', (streamErr: Error) => {
                console.error(`[REAL_SSH_SERVICE] Error on command stream for "${command}":`, streamErr);
                reject(streamErr);
            });
        });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
        if (this.client) {
            this.client.once('close', () => {
                console.log(`[REAL_SSH_SERVICE] Connection successfully closed for ${this.connectionConfig?.host}:${this.connectionConfig?.port}.`);
                this.client = null;
                this.connectionConfig = null;
                resolve();
            });

            this.client.once('error', (err) => {
                console.warn(`[REAL_SSH_SERVICE] Error during disconnect for ${this.connectionConfig?.host}:${this.connectionConfig?.port}:`, err.message);
                this.client = null;
                this.connectionConfig = null;
                resolve();
            });

            console.log(`[REAL_SSH_SERVICE] Disconnecting from ${this.connectionConfig?.host}:${this.connectionConfig?.port}...`);
            this.client.end();
        } else {
            console.log('[REAL_SSH_SERVICE] No active client to disconnect.');
            resolve();
        }
    });
  }

  isConnected(): boolean {
    return !!(this.client && this.client.readable);
  }

  getConnectionConfig(): SshConnectionConfig | null {
    return this.connectionConfig;
  }
}
*/

// Export the MockSshService instance for client-side use in the prototype
export const sshService = new MockSshService();

// Ensure this file does not directly import 'ssh2' at the top level if it's meant to be client-safe.
// The RealSshService, when uncommented, would typically be in a separate server-only file.
// For now, commenting out RealSshService and its 'ssh2' import to prevent client build errors.
// const SshClientModule = await import('ssh2');
// const Client = SshClientModule.Client; // This would still cause issues if top-level.
