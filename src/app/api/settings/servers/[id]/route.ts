
// src/app/api/settings/servers/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { ServerConfig } from '@/app/settings/servers/page'; 

interface Params {
  id: string;
}

// Helper to parse JSON fields safely
const parseJsonField = (jsonString: string | null | undefined, defaultValue: any) => {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse JSON field:', e);
    return defaultValue;
  }
};

// GET a single server configuration by ID
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const configFromDb = await db.get('SELECT * FROM server_configs WHERE id = ?', params.id);

    if (!configFromDb) {
      return NextResponse.json({ message: 'Server configuration not found' }, { status: 404 });
    }
    
    const config: ServerConfig = {
      ...configFromDb,
      nasSpecificSecrets: parseJsonField(configFromDb.nasSpecificSecrets, {}),
      testSteps: parseJsonField(configFromDb.testSteps, []),
      scenarioExecutionSshCommands: parseJsonField(configFromDb.scenarioExecutionSshCommands, []),
      connectionTestSshPreamble: parseJsonField(configFromDb.connectionTestSshPreamble, []),
      sshPort: Number(configFromDb.sshPort),
      radiusAuthPort: Number(configFromDb.radiusAuthPort),
      radiusAcctPort: Number(configFromDb.radiusAcctPort),
    } as ServerConfig;

    return NextResponse.json(config);
  } catch (error) {
    console.error(`Failed to fetch server configuration ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to fetch server configuration ${params.id}`, errorDetail: (error as Error).message }, { status: 500 });
  }
}

// PUT (update) a server configuration by ID
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const body = await request.json() as Partial<Omit<ServerConfig, 'id'>>;

    const db = await getDb();
    const existingConfig = await db.get('SELECT * FROM server_configs WHERE id = ?', params.id);
    if (!existingConfig) {
      return NextResponse.json({ message: 'Server configuration not found' }, { status: 404 });
    }

    const updatedConfigData = {
      name: body.name || existingConfig.name,
      type: body.type || existingConfig.type,
      customServerType: body.customServerType !== undefined ? body.customServerType : existingConfig.customServerType,
      host: body.host || existingConfig.host,
      sshPort: body.sshPort !== undefined ? Number(body.sshPort) : Number(existingConfig.sshPort),
      sshUser: body.sshUser || existingConfig.sshUser,
      authMethod: body.authMethod || existingConfig.authMethod,
      privateKey: body.privateKey !== undefined ? body.privateKey : existingConfig.privateKey,
      password: body.password !== undefined ? body.password : existingConfig.password,
      radiusAuthPort: body.radiusAuthPort !== undefined ? Number(body.radiusAuthPort) : Number(existingConfig.radiusAuthPort),
      radiusAcctPort: body.radiusAcctPort !== undefined ? Number(body.radiusAcctPort) : Number(existingConfig.radiusAcctPort),
      defaultSecret: body.defaultSecret !== undefined ? body.defaultSecret : existingConfig.defaultSecret,
      nasSpecificSecrets: body.nasSpecificSecrets !== undefined ? JSON.stringify(body.nasSpecificSecrets) : existingConfig.nasSpecificSecrets,
      status: body.status !== undefined ? body.status : existingConfig.status,
      testSteps: body.testSteps !== undefined ? JSON.stringify(body.testSteps) : existingConfig.testSteps,
      scenarioExecutionSshCommands: body.scenarioExecutionSshCommands !== undefined ? JSON.stringify(body.scenarioExecutionSshCommands) : existingConfig.scenarioExecutionSshCommands,
      connectionTestSshPreamble: body.connectionTestSshPreamble !== undefined ? JSON.stringify(body.connectionTestSshPreamble) : existingConfig.connectionTestSshPreamble,
    };

    await db.run(
      `UPDATE server_configs SET 
        name = ?, type = ?, customServerType = ?, host = ?, sshPort = ?, sshUser = ?, authMethod = ?, privateKey = ?, password = ?,
        radiusAuthPort = ?, radiusAcctPort = ?, defaultSecret = ?, nasSpecificSecrets = ?, status = ?,
        testSteps = ?, scenarioExecutionSshCommands = ?, connectionTestSshPreamble = ?
      WHERE id = ?`,
      updatedConfigData.name,
      updatedConfigData.type,
      updatedConfigData.customServerType,
      updatedConfigData.host,
      updatedConfigData.sshPort,
      updatedConfigData.sshUser,
      updatedConfigData.authMethod,
      updatedConfigData.privateKey,
      updatedConfigData.password,
      updatedConfigData.radiusAuthPort,
      updatedConfigData.radiusAcctPort,
      updatedConfigData.defaultSecret,
      updatedConfigData.nasSpecificSecrets,
      updatedConfigData.status,
      updatedConfigData.testSteps,
      updatedConfigData.scenarioExecutionSshCommands,
      updatedConfigData.connectionTestSshPreamble,
      params.id
    );
    
    const updatedConfigFromDb = await db.get('SELECT * FROM server_configs WHERE id = ?', params.id);
     if (!updatedConfigFromDb) {
      return NextResponse.json({ message: 'Failed to retrieve updated server configuration after update' }, { status: 500 });
    }

    const configToReturn: ServerConfig = {
      ...updatedConfigFromDb,
      nasSpecificSecrets: parseJsonField(updatedConfigFromDb.nasSpecificSecrets, {}),
      testSteps: parseJsonField(updatedConfigFromDb.testSteps, []),
      scenarioExecutionSshCommands: parseJsonField(updatedConfigFromDb.scenarioExecutionSshCommands, []),
      connectionTestSshPreamble: parseJsonField(updatedConfigFromDb.connectionTestSshPreamble, []),
      sshPort: Number(updatedConfigFromDb.sshPort),
      radiusAuthPort: Number(updatedConfigFromDb.radiusAuthPort),
      radiusAcctPort: Number(updatedConfigFromDb.radiusAcctPort),
    } as ServerConfig;

    return NextResponse.json(configToReturn);
  } catch (error: any) {
    console.error(`API_ERROR: Failed to update server configuration ${params.id}:`, error.message, error.stack);
    let status = 500;
    let message = `Failed to update server configuration for ID ${params.id}. Please check server logs.`;
    let errorDetail = error.message || 'An unknown error occurred on the server.';

    if (error.message && error.message.toUpperCase().includes('SQLITE_READONLY')) {
      // It's better to use a more specific error code if available, e.g., from error.errno or error.code
      // For SQLite, SQLITE_READONLY is error code 8.
      // status = 503; // Service Unavailable (database is not writable)
      // Alternatively, 403 Forbidden if it's a persistent permission issue not a temporary state.
      // For simplicity, sticking to 500 but providing very specific message.
      message = 'Database is in read-only mode. Cannot save changes.';
      errorDetail = 'The database file or its directory does not have write permissions, or the filesystem is mounted read-only. Please check server/filesystem permissions for the application process.';
    }

    return NextResponse.json({
      message: message,
      errorDetail: errorDetail
    }, { status: status });
  }
}

// DELETE a server configuration by ID
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    await db.run('DELETE FROM server_configs WHERE id = ?', params.id); // Removed result variable as it's not checked before returning 404
    // Assuming if no error, it was successful or ID didn't exist (which is fine for DELETE idempotency)
    return NextResponse.json({ message: 'Server configuration deleted successfully or did not exist.' }, { status: 200 });
  } catch (error: any) {
    console.error(`Failed to delete server configuration ${params.id}:`, error);
    let message = `Failed to delete server configuration ${params.id}.`;
    let errorDetail = error.message || 'An unknown error occurred.';
    if (error.message && error.message.toUpperCase().includes('SQLITE_READONLY')) {
      message = 'Database is in read-only mode. Cannot delete configuration.';
      errorDetail = 'The database file or its directory does not have write permissions, or the filesystem is mounted read-only.';
    }
    return NextResponse.json({ message, errorDetail }, { status: 500 });
  }
}

    
