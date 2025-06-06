
// src/app/api/settings/database/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { DbConnectionConfig } from '@/app/settings/database/page'; 
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

// GET all database configurations
export async function GET() {
  try {
    const db = await getDb();
    const configsFromDb = await db.all('SELECT * FROM db_configs ORDER BY name ASC');
    
    const configs: DbConnectionConfig[] = configsFromDb.map(c => ({
      ...c,
      sshPreambleSteps: parseJsonField(c.sshPreambleSteps, []),
      directTestSshPreamble: parseJsonField(c.directTestSshPreamble, []),
      validationSteps: parseJsonField(c.validationSteps, []),
      port: Number(c.port),
      jumpServerPort: c.jumpServerPort ? Number(c.jumpServerPort) : undefined,
    })) as DbConnectionConfig[];

    return NextResponse.json(configs);
  } catch (error) {
    console.error('Failed to fetch database configurations:', error);
    return NextResponse.json({ message: 'Failed to fetch database configurations', error: (error as Error).message }, { status: 500 });
  }
}

// POST a new database configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Omit<DbConnectionConfig, 'id'>;

    if (!body.name || !body.host || !body.databaseName) {
      return NextResponse.json({ message: 'Connection name, target DB host, and target database name are required' }, { status: 400 });
    }

    const db = await getDb();
    const newConfig: DbConnectionConfig = {
      id: uuidv4(),
      name: body.name,
      type: body.type || 'mysql',
      // Jump Server
      jumpServerHost: body.jumpServerHost || undefined,
      jumpServerPort: body.jumpServerPort ? Number(body.jumpServerPort) : undefined,
      jumpServerUser: body.jumpServerUser || undefined,
      jumpServerAuthMethod: body.jumpServerAuthMethod || undefined,
      jumpServerPrivateKey: body.jumpServerPrivateKey || undefined,
      jumpServerPassword: body.jumpServerPassword || undefined,
      // Target DB
      host: body.host,
      port: Number(body.port) || 3306,
      username: body.username || '',
      password: body.password || '',
      databaseName: body.databaseName,
      status: body.status || 'unknown',
      sshPreambleSteps: body.sshPreambleSteps || [], // For scenarios
      directTestSshPreamble: body.directTestSshPreamble || [], // For Test Connection on Jump Server
      validationSteps: body.validationSteps || [],
    };

    await db.run(
      `INSERT INTO db_configs (
        id, name, type, host, port, username, password, databaseName,
        status, sshPreambleSteps, directTestSshPreamble, validationSteps,
        jumpServerHost, jumpServerPort, jumpServerUser, jumpServerAuthMethod,
        jumpServerPrivateKey, jumpServerPassword
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newConfig.id, newConfig.name, newConfig.type, newConfig.host, newConfig.port,
      newConfig.username, newConfig.password, newConfig.databaseName, newConfig.status,
      JSON.stringify(newConfig.sshPreambleSteps),
      JSON.stringify(newConfig.directTestSshPreamble),
      JSON.stringify(newConfig.validationSteps),
      newConfig.jumpServerHost, newConfig.jumpServerPort, newConfig.jumpServerUser,
      newConfig.jumpServerAuthMethod, newConfig.jumpServerPrivateKey, newConfig.jumpServerPassword
    );

    return NextResponse.json(newConfig, { status: 201 });
  } catch (error) {
    console.error('Failed to create database configuration:', error);
    return NextResponse.json({ message: 'Failed to create database configuration', error: (error as Error).message }, { status: 500 });
  }
}

    