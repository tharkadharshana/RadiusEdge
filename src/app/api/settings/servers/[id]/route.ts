
// src/app/api/settings/servers/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { ServerConfig, TestStepConfig, SshExecutionStep } from '@/app/settings/servers/page'; // Assuming types are exported

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
      sshPort: Number(configFromDb.sshPort),
      radiusAuthPort: Number(configFromDb.radiusAuthPort),
      radiusAcctPort: Number(configFromDb.radiusAcctPort),
    } as ServerConfig;

    return NextResponse.json(config);
  } catch (error) {
    console.error(`Failed to fetch server configuration ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to fetch server configuration ${params.id}`, error: (error as Error).message }, { status: 500 });
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
    };

    const result = await db.run(
      `UPDATE server_configs SET 
        name = ?, type = ?, host = ?, sshPort = ?, sshUser = ?, authMethod = ?, privateKey = ?, password = ?,
        radiusAuthPort = ?, radiusAcctPort = ?, defaultSecret = ?, nasSpecificSecrets = ?, status = ?,
        testSteps = ?, scenarioExecutionSshCommands = ?
      WHERE id = ?`,
      updatedConfigData.name,
      updatedConfigData.type,
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
      params.id
    );

    if (result.changes === 0) {
        return NextResponse.json({ message: 'Server configuration not found or no changes made' }, { status: 404 });
    }
    
    const updatedConfigFromDb = await db.get('SELECT * FROM server_configs WHERE id = ?', params.id);
     if (!updatedConfigFromDb) {
      return NextResponse.json({ message: 'Failed to retrieve updated server configuration' }, { status: 500 });
    }

    const configToReturn: ServerConfig = {
      ...updatedConfigFromDb,
      nasSpecificSecrets: parseJsonField(updatedConfigFromDb.nasSpecificSecrets, {}),
      testSteps: parseJsonField(updatedConfigFromDb.testSteps, []),
      scenarioExecutionSshCommands: parseJsonField(updatedConfigFromDb.scenarioExecutionSshCommands, []),
      sshPort: Number(updatedConfigFromDb.sshPort),
      radiusAuthPort: Number(updatedConfigFromDb.radiusAuthPort),
      radiusAcctPort: Number(updatedConfigFromDb.radiusAcctPort),
    } as ServerConfig;

    return NextResponse.json(configToReturn);
  } catch (error) {
    console.error(`Failed to update server configuration ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to update server configuration ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// DELETE a server configuration by ID
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM server_configs WHERE id = ?', params.id);

    if (result.changes === 0) {
      return NextResponse.json({ message: 'Server configuration not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Server configuration deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Failed to delete server configuration ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to delete server configuration ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}
