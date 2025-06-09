import { Client, ConnectConfig as Ssh2ConnectConfig } from 'ssh2';

// IMPORTANT: When populating SshConnectionConfig for use with RealSshService:
// - `password` and `privateKey` fields should be sourced from secure locations
//   such as environment variables or a secrets management system.
//   DO NOT hardcode credentials in application code.
// - `privateKey` should be the string content of the private key file.
// - `authMethod` must be specified as 'password' or 'key'.
export interface SshConnectionConfig { // Added export
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'key'; // Added authMethod
  password?: string;
  privateKey?: string; // Content of the key
  retries?: number; // For future use or higher-level orchestration
  retryDelay?: number; // For future use
  timeout?: number; // Connection timeout in ms (e.g., for ssh2's readyTimeout)
}

export interface SshCommandResult { // Exported for use in ExecutionConsolePage
  stdout: string;
  stderr: string;
  code: number;
}

// MockSshService class removed

// RealSshService provides methods to connect to and interact with an SSH server.
// It uses the 'ssh2' library for the underlying SSH communication.
//
// Security Considerations:
// - Credential Management: Ensure SshConnectionConfig is populated securely.
// - Host Key Verification: The 'ssh2' library by default will use known_hosts files
//   (~/.ssh/known_hosts and /etc/ssh/ssh_known_hosts) for host key verification.
//   For server environments, ensure appropriate known_hosts management or configure
//   custom host key verification if needed (not implemented in this basic service).
//
// Error Handling:
// - Methods like `connect` and `executeCommand` return Promises that will reject
//   on errors (e.g., connection failures, authentication issues, command errors).
//
// Timeouts:
// - The `connect` method uses the `readyTimeout` from SshConnectionConfig.timeout.
// - The `executeCommand` method currently does not implement a specific per-command
//   timeout; long-running commands will run until completion or channel closure.
//   Consider adding command-specific timeouts if required for your use cases.
//
// Limitations:
// - Does not explicitly handle SSH agent forwarding.
// - Advanced proxy configurations (e.g., SOCKS5 through SSH) are not directly supported.
// - Assumes standard SSH server behavior.
export class RealSshService {
  private client: Client | null = null;
  private connectionConfig: SshConnectionConfig | null = null;

  constructor() {}

  async connect(config: SshConnectionConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.client && this.client.readable) {
        console.warn('[REAL_SSH_SERVICE] Already connected or connecting. Disconnecting existing before new attempt.');
        this.client.end();
        // Consider waiting for 'close' event before creating a new client for robustness
      }

      this.client = new Client();
      this.connectionConfig = config; // Store the config for current attempt

      const ssh2Config: Ssh2ConnectConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: config.timeout || 20000, // Default to 20s
      };

      if (config.authMethod === 'password') {
        if (!config.password) {
          this.connectionConfig = null; // Clear config as this attempt is invalid
          return reject(new Error('Password authentication selected but no password provided.'));
        }
        ssh2Config.password = config.password;
      } else if (config.authMethod === 'key') {
        if (!config.privateKey) {
          this.connectionConfig = null; // Clear config
          return reject(new Error('Key authentication selected but no privateKey provided.'));
        }
        ssh2Config.privateKey = config.privateKey;
      } else {
        this.connectionConfig = null; // Clear config
        // Typechecking should prevent this, but runtime check is good.
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
        // this.client?.end(); // end() might trigger 'close' again, ensure handlers are idempotent or removed
        if (this.client?.writable) { // Check if client is in a state that allows end()
            this.client.end();
        }
        this.client = null;
        this.connectionConfig = null;
        this.client?.removeListener('ready', onReady);
        this.client?.removeListener('close', onClose); // Ensure close listener is also removed
        reject(err);
      };

      const onClose = () => {
        console.log(`[REAL_SSH_SERVICE] Connection closed for ${config.host}:${config.port}`);
        // If this 'close' is unexpected (not part of a failed connect or explicit disconnect)
        // then we should probably nullify client and connectionConfig.
        // For now, error handler and disconnect() primarily manage state nullification.
        // This handler might be more relevant for monitoring unexpected drops.
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

  async executeCommand(command: string): Promise<SshCommandResult> { // SshCommandResult is already defined in the file
    return new Promise((resolve, reject) => {
        if (!this.client || !this.client.readable) { // Check if client is connected and active
            return reject(new Error('SSH client not connected or not active.'));
        }

        let stdout = '';
        let stderr = '';
        let exitCode: number = -1; // Default to a value indicating it hasn't been set

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
                // code can be null if the command was killed by a signal without an exit code
                exitCode = code === null ? -1 : code;
                if (signal) {
                    console.log(`[REAL_SSH_SERVICE] Command "${command}" terminated by signal: ${signal}. Exit code: ${exitCode}`);
                    // stderr might already contain info, or we can add a generic message
                    if (!stderr && signal) stderr += `Command terminated by signal: ${signal}.`;
                } else {
                    console.log(`[REAL_SSH_SERVICE] Command "${command}" finished. Exit code: ${exitCode}`);
                }
                resolve({ stdout, stderr, code: exitCode });
            });

            stream.on('error', (streamErr: Error) => { // Added explicit error handling for the stream itself
                console.error(`[REAL_SSH_SERVICE] Error on command stream for "${command}":`, streamErr);
                // This might be redundant if 'close' with an error code also fires,
                // but good for catching stream-specific issues.
                reject(streamErr);
            });
        });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
        if (this.client) {
            // Add a one-time listener for the 'close' event to resolve the promise.
            this.client.once('close', () => {
                console.log(`[REAL_SSH_SERVICE] Connection successfully closed for ${this.connectionConfig?.host}:${this.connectionConfig?.port}.`);
                this.client = null;
                this.connectionConfig = null;
                resolve();
            });

            // Add a one-time listener for 'error' during disconnect process, though less common.
            this.client.once('error', (err) => {
                console.warn(`[REAL_SSH_SERVICE] Error during disconnect for ${this.connectionConfig?.host}:${this.connectionConfig?.port}:`, err.message);
                // Still attempt to nullify client and config
                this.client = null;
                this.connectionConfig = null;
                resolve(); // Resolve anyway as the goal is to be disconnected
            });

            console.log(`[REAL_SSH_SERVICE] Disconnecting from ${this.connectionConfig?.host}:${this.connectionConfig?.port}...`);
            this.client.end();
        } else {
            console.log('[REAL_SSH_SERVICE] No active client to disconnect.');
            resolve(); // No client, so already "disconnected"
        }
    });
  }

  isConnected(): boolean {
    // Check if client exists and is in a state that implies connectivity.
    // For ssh2, 'readable' is a good indicator that the connection is active.
    // 'writable' could also be checked, but 'readable' often suffices.
    return !!(this.client && this.client.readable);
  }

  getConnectionConfig(): SshConnectionConfig | null {
    return this.connectionConfig;
  }
}

export const sshService = new RealSshService();
