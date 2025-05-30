
// src/app/api/executions/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export interface TestExecution {
  id: string;
  scenarioId?: string;
  scenarioName: string;
  serverId?: string;
  serverName: string;
  startTime: string;
  endTime?: string;
  status: 'Running' | 'Completed' | 'Failed' | 'Aborted';
  resultId?: string;
}

// GET all test executions
export async function GET() {
  try {
    const db = await getDb();
    const executions = await db.all('SELECT * FROM test_executions ORDER BY startTime DESC');
    return NextResponse.json(executions);
  } catch (error) {
    console.error('Failed to fetch test executions:', error);
    return NextResponse.json({ message: 'Failed to fetch test executions', error: (error as Error).message }, { status: 500 });
  }
}

// POST to start a new test execution
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Omit<TestExecution, 'id' | 'startTime' | 'status'> & { status?: TestExecution['status'] };

    if (!body.scenarioName || !body.serverName) {
      return NextResponse.json({ message: 'Scenario name and server name are required' }, { status: 400 });
    }

    const db = await getDb();
    const newExecution: TestExecution = {
      id: uuidv4(),
      scenarioId: body.scenarioId,
      scenarioName: body.scenarioName,
      serverId: body.serverId,
      serverName: body.serverName,
      startTime: new Date().toISOString(),
      status: body.status || 'Running', // Default to 'Running'
      resultId: body.resultId,
    };

    await db.run(
      `INSERT INTO test_executions (id, scenarioId, scenarioName, serverId, serverName, startTime, status, resultId) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newExecution.id,
      newExecution.scenarioId,
      newExecution.scenarioName,
      newExecution.serverId,
      newExecution.serverName,
      newExecution.startTime,
      newExecution.status,
      newExecution.resultId
    );

    return NextResponse.json(newExecution, { status: 201 });
  } catch (error) {
    console.error('Failed to start test execution:', error);
    return NextResponse.json({ message: 'Failed to start test execution', error: (error as Error).message }, { status: 500 });
  }
}
