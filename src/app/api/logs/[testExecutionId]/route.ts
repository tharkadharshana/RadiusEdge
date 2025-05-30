
// src/app/api/logs/[testExecutionId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { ExecutionLogEntry } from '../route'; // Assuming type is exported from parent

interface Params {
  testExecutionId: string;
}

// GET all log entries for a specific testExecutionId
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const logsFromDb = await db.all(
      'SELECT * FROM execution_logs WHERE testExecutionId = ? ORDER BY timestamp ASC',
      params.testExecutionId
    );

    const logs: ExecutionLogEntry[] = logsFromDb.map(log => ({
        ...log,
        rawDetails: log.rawDetails ? JSON.parse(log.rawDetails as string) : undefined,
    })) as ExecutionLogEntry[];

    return NextResponse.json(logs);
  } catch (error) {
    console.error(`Failed to fetch logs for execution ${params.testExecutionId}:`, error);
    return NextResponse.json({ message: `Failed to fetch logs for execution ${params.testExecutionId}`, error: (error as Error).message }, { status: 500 });
  }
}

// DELETE all log entries for a specific testExecutionId (use with caution)
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM execution_logs WHERE testExecutionId = ?', params.testExecutionId);

    if (result.changes === 0) {
      // It's possible no logs existed for this executionId
      return NextResponse.json({ message: `No logs found or deleted for execution ${params.testExecutionId}` }, { status: 200 });
    }

    return NextResponse.json({ message: `All logs for execution ${params.testExecutionId} deleted successfully` });
  } catch (error) {
    console.error(`Failed to delete logs for execution ${params.testExecutionId}:`, error);
    return NextResponse.json({ message: `Failed to delete logs for execution ${params.testExecutionId}`, error: (error as Error).message }, { status: 500 });
  }
}
