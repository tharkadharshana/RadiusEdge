// src/app/api/test-ssh/route.ts
import { NextResponse } from 'next/server';
import { sshService, SshConnectionConfig } from '@/lib/services/ssh-service'; // Assumes sshService is RealSshService, Import SshConnectionConfig


export async function GET() {
    console.log('[API_TEST_SSH] Received request to test SSH connection.');

    // Use the imported SshConnectionConfig, but adjust for optional fields from env vars
    const config: Partial<SshConnectionConfig> & { authMethod?: 'password' | 'key' } = {
        host: process.env.TEST_SSH_HOST,
        port: process.env.TEST_SSH_PORT ? parseInt(process.env.TEST_SSH_PORT, 10) : undefined,
        username: process.env.TEST_SSH_USER,
        authMethod: process.env.TEST_SSH_AUTH_METHOD as 'password' | 'key' | undefined,
        password: process.env.TEST_SSH_PASSWORD, // Will be undefined if not set
        privateKey: process.env.TEST_SSH_KEY ? process.env.TEST_SSH_KEY.replace(/\\n/g, '\n') : undefined, // Allow escaped newlines
        timeout: process.env.TEST_SSH_TIMEOUT ? parseInt(process.env.TEST_SSH_TIMEOUT, 10) : 20000,
    };

    if (!config.host || !config.port || !config.username || !config.authMethod) {
        return NextResponse.json(
            { error: 'Missing required environment variables for SSH test (TEST_SSH_HOST, TEST_SSH_PORT, TEST_SSH_USER, TEST_SSH_AUTH_METHOD).' },
            { status: 500 }
        );
    }
     // Ensure all required fields for SshConnectionConfig are present before calling connect
     if (config.authMethod === 'password' && typeof config.password !== 'string') {
        return NextResponse.json(
           { error: 'Auth method is password, but TEST_SSH_PASSWORD is not set or invalid.' },
           { status: 500 }
       );
   }
   if (config.authMethod === 'key' && typeof config.privateKey !== 'string') {
        return NextResponse.json(
           { error: 'Auth method is key, but TEST_SSH_KEY is not set or invalid.' },
           { status: 500 }
       );
   }

    const results: Record<string, any> = {};

    try {
        console.log(`[API_TEST_SSH] Attempting to connect with config:`, { ...config, password: '***', privateKey: '***' });
        // Now config should align better with SshConnectionConfig, but ensure all required fields are definitely present.
        // The checks above help ensure this.
        await sshService.connect(config as SshConnectionConfig);
        results.connect = 'Successfully connected.';
        console.log('[API_TEST_SSH] Connection successful.');

        try {
            const command = 'whoami && ls -la';
            console.log(`[API_TEST_SSH] Executing command: "${command}"`);
            const execResult = await sshService.executeCommand(command);
            results.executeCommand = execResult;
            console.log('[API_TEST_SSH] Command execution successful.');
        } catch (execError: any) {
            console.error('[API_TEST_SSH] Command execution failed:', execError.message);
            results.executeCommandError = execError.message;
            results.executeCommandErrorStack = execError.stack;
        }

    } catch (connectError: any) {
        console.error('[API_TEST_SSH] Connection failed:', connectError.message);
        results.connectError = connectError.message;
        results.connectErrorStack = connectError.stack;
    } finally {
        try {
            console.log('[API_TEST_SSH] Attempting to disconnect.');
            await sshService.disconnect();
            results.disconnect = 'Successfully disconnected.';
            console.log('[API_TEST_SSH] Disconnection successful.');
        } catch (disconnectError: any) {
            console.error('[API_TEST_SSH] Disconnect failed:', disconnectError.message);
            results.disconnectError = disconnectError.message;
        }
    }

    if (results.connectError || results.executeCommandError) {
        return NextResponse.json({ status: 'Test completed with errors', results }, { status: 500 });
    }
    return NextResponse.json({ status: 'Test completed successfully', results }, { status: 200 });
}
