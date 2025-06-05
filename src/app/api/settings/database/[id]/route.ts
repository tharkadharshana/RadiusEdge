
// src/app/api/settings/database/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { DbConnectionConfig } from '@/app/settings/database/page'; 

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

// GET a single database configuration by ID
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const configFromDb = await db.get('SELECT * FROM db_configs WHERE id = ?', params.id);

    if (!configFromDb) {
      return NextResponse.json({ message: 'Database configuration not found' }, { status: 404 });
    }
    
    const config: DbConnectionConfig = {
      ...configFromDb,
      sshPreambleSteps: parseJsonField(configFromDb.sshPreambleSteps, []),
      directTestSshPreamble: parseJsonField(configFromDb.directTestSshPreamble, []),
      validationSteps: parseJsonField(configFromDb.validationSteps, []),
      port: Number(configFromDb.port),
      jumpServerPort: configFromDb.jumpServerPort ? Number(configFromDb.jumpServerPort) : undefined,
    } as DbConnectionConfig;

    return NextResponse.json(config);
  } catch (error) {
    console.error(`Failed to fetch database configuration ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to fetch database configuration ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// PUT (update) a database configuration by ID
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const body = await request.json() as Partial<Omit<DbConnectionConfig, 'id'>>;

    const db = await getDb();
    const existingConfig = await db.get('SELECT * FROM db_configs WHERE id = ?', params.id);
    if (!existingConfig) {
      return NextResponse.json({ message: 'Database configuration not found' }, { status: 404 });
    }

    const updatedConfigData = {
      name: body.name || existingConfig.name,
      type: body.type || existingConfig.type,
      // Jump Server
      jumpServerHost: body.jumpServerHost !== undefined ? body.jumpServerHost : existingConfig.jumpServerHost,
      jumpServerPort: body.jumpServerPort !== undefined ? Number(body.jumpServerPort) : existingConfig.jumpServerPort,
      jumpServerUser: body.jumpServerUser !== undefined ? body.jumpServerUser : existingConfig.jumpServerUser,
      jumpServerAuthMethod: body.jumpServerAuthMethod !== undefined ? body.jumpServerAuthMethod : existingConfig.jumpServerAuthMethod,
      jumpServerPrivateKey: body.jumpServerPrivateKey !== undefined ? body.jumpServerPrivateKey : existingConfig.jumpServerPrivateKey,
      jumpServerPassword: body.jumpServerPassword !== undefined ? body.jumpServerPassword : existingConfig.jumpServerPassword,
      // Target DB
      host: body.host || existingConfig.host,
      port: body.port !== undefined ? Number(body.port) : Number(existingConfig.port),
      username: body.username || existingConfig.username,
      password: body.password !== undefined ? body.password : existingConfig.password,
      databaseName: body.databaseName || existingConfig.databaseName,
      status: body.status !== undefined ? body.status : existingConfig.status,
      sshPreambleSteps: body.sshPreambleSteps !== undefined ? JSON.stringify(body.sshPreambleSteps) : existingConfig.sshPreambleSteps,
      directTestSshPreamble: body.directTestSshPreamble !== undefined ? JSON.stringify(body.directTestSshPreamble) : existingConfig.directTestSshPreamble,
      validationSteps: body.validationSteps !== undefined ? JSON.stringify(body.validationSteps) : existingConfig.validationSteps,
    };

    const result = await db.run(
      `UPDATE db_configs SET 
        name = ?, type = ?, host = ?, port = ?, username = ?, password = ?, 
        databaseName = ?, status = ?, sshPreambleSteps = ?, directTestSshPreamble = ?, validationSteps = ?,
        jumpServerHost = ?, jumpServerPort = ?, jumpServerUser = ?, jumpServerAuthMethod = ?,
        jumpServerPrivateKey = ?, jumpServerPassword = ?
      WHERE id = ?`,
      updatedConfigData.name, updatedConfigData.type, updatedConfigData.host, updatedConfigData.port,
      updatedConfigData.username, updatedConfigData.password, updatedConfigData.databaseName,
      updatedConfigData.status, updatedConfigData.sshPreambleSteps, updatedConfigData.directTestSshPreamble,
      updatedConfigData.validationSteps,
      updatedConfigData.jumpServerHost, updatedConfigData.jumpServerPort, updatedConfigData.jumpServerUser,
      updatedConfigData.jumpServerAuthMethod, updatedConfigData.jumpServerPrivateKey, updatedConfigData.jumpServerPassword,
      params.id
    );

    if (result.changes === 0) {
        // This can happen if the data sent is identical to the existing data.
        // Fetch and return the current config to ensure client has up-to-date representation.
    }
    
    const updatedConfigFromDb = await db.get('SELECT * FROM db_configs WHERE id = ?', params.id);
    if (!updatedConfigFromDb) {
      return NextResponse.json({ message: 'Failed to retrieve updated database configuration' }, { status: 500 });
    }

    const configToReturn: DbConnectionConfig = {
      ...updatedConfigFromDb,
      sshPreambleSteps: parseJsonField(updatedConfigFromDb.sshPreambleSteps, []),
      directTestSshPreamble: parseJsonField(updatedConfigFromDb.directTestSshPreamble, []),
      validationSteps: parseJsonField(updatedConfigFromDb.validationSteps, []),
      port: Number(updatedConfigFromDb.port),
      jumpServerPort: updatedConfigFromDb.jumpServerPort ? Number(updatedConfigFromDb.jumpServerPort) : undefined,
    } as DbConnectionConfig;

    return NextResponse.json(configToReturn);
  } catch (error) {
    console.error(`Failed to update database configuration ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to update database configuration ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// DELETE a database configuration by ID
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM db_configs WHERE id = ?', params.id);

    if (result.changes === 0) {
      return NextResponse.json({ message: 'Database configuration not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Database configuration deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Failed to delete database configuration ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to delete database configuration ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

    