
// src/app/api/settings/servers/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { ServerConfig, TestStepConfig, SshExecutionStep } from '@/app/settings/servers/page'; // Assuming types are exported
import { v4 as uuidv4 } from 'uuid';

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


// GET all server configurations
export async function GET() {
  try {
    const db = await getDb();
    const configsFromDb = await db.all('SELECT * FROM server_configs ORDER BY name ASC');
    
    const configs: ServerConfig[] = configsFromDb.map(c => ({
      ...c,
      nasSpecificSecrets: parseJsonField(c.nasSpecificSecrets, {}),
      testSteps: parseJsonField(c.testSteps, []),
      scenarioExecutionSshCommands: parseJsonField(c.scenarioExecutionSshCommands, []),
      // Ensure numeric fields are numbers
      sshPort: Number(c.sshPort),
      radiusAuthPort: Number(c.radiusAuthPort),
      radiusAcctPort: Number(c.radiusAcctPort),
    })) as ServerConfig[];

    return NextResponse.json(configs);
  } catch (error) {
    console.error('Failed to fetch server configurations:', error);
    return NextResponse.json({ message: 'Failed to fetch server configurations', error: (error as Error).message }, { status: 500 });
  }
}

// POST a new server configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Omit<ServerConfig, 'id'>; // Assuming status will be set by client or flow later

    if (!body.name || !body.host) {
      return NextResponse.json({ message: 'Server name and host are required' }, { status: 400 });
    }

    const db = await getDb();
    const newConfig: ServerConfig = {
      id: uuidv4(),
      name: body.name,
      type: body.type || 'freeradius',
      host: body.host,
      sshPort: Number(body.sshPort) || 22,
      sshUser: body.sshUser || 'root',
      authMethod: body.authMethod || 'key',
      privateKey: body.privateKey || '',
      password: body.password || '',
      radiusAuthPort: Number(body.radiusAuthPort) || 1812,
      radiusAcctPort: Number(body.radiusAcctPort) || 1813,
      defaultSecret: body.defaultSecret || '',
      nasSpecificSecrets: body.nasSpecificSecrets || {},
      status: body.status || 'unknown', // Default status
      testSteps: body.testSteps || [],
      scenarioExecutionSshCommands: body.scenarioExecutionSshCommands || [],
    };

    await db.run(
      `INSERT INTO server_configs (
        id, name, type, host, sshPort, sshUser, authMethod, privateKey, password,
        radiusAuthPort, radiusAcctPort, defaultSecret, nasSpecificSecrets, status,
        testSteps, scenarioExecutionSshCommands
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newConfig.id,
      newConfig.name,
      newConfig.type,
      newConfig.host,
      newConfig.sshPort,
      newConfig.sshUser,
      newConfig.authMethod,
      newConfig.privateKey,
      newConfig.password,
      newConfig.radiusAuthPort,
      newConfig.radiusAcctPort,
      newConfig.defaultSecret,
      JSON.stringify(newConfig.nasSpecificSecrets),
      newConfig.status,
      JSON.stringify(newConfig.testSteps),
      JSON.stringify(newConfig.scenarioExecutionSshCommands)
    );

    return NextResponse.json(newConfig, { status: 201 });
  } catch (error) {
    console.error('Failed to create server configuration:', error);
    return NextResponse.json({ message: 'Failed to create server configuration', error: (error as Error).message }, { status: 500 });
  }
}
