
// src/app/api/logs/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutionLogEntry {
  id: string;
  testExecutionId: string;
  timestamp: string;
  level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' | 'SENT' | 'RECV' | 'SSH_CMD' | 'SSH_OUT' | 'SSH_FAIL';
  message: string;
  rawDetails?: string; // JSON string
}

interface BatchLogRequest {
  testExecutionId: string;
  logs: Omit<ExecutionLogEntry, 'id' | 'testExecutionId'>[];
}

// POST to add a batch of log entries
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as BatchLogRequest;

    if (!body.testExecutionId || !Array.isArray(body.logs) || body.logs.length === 0) {
      return NextResponse.json({ message: 'testExecutionId and a non-empty logs array are required' }, { status: 400 });
    }

    const db = await getDb();
    
    // Use a transaction for batch inserts
    await db.exec('BEGIN TRANSACTION');
    try {
      const stmt = await db.prepare(
        `INSERT INTO execution_logs (id, testExecutionId, timestamp, level, message, rawDetails) 
         VALUES (?, ?, ?, ?, ?, ?)`
      );

      for (const log of body.logs) {
        if (!log.timestamp || !log.level || !log.message) {
            // Basic validation for each log entry
            console.warn('Skipping invalid log entry:', log);
            continue;
        }
        await stmt.run(
          uuidv4(),
          body.testExecutionId,
          log.timestamp,
          log.level,
          log.message,
          log.rawDetails ? JSON.stringify(log.rawDetails) : null
        );
      }
      await stmt.finalize();
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err; // Re-throw to be caught by outer catch
    }

    return NextResponse.json({ message: `${body.logs.length} log entries added successfully for execution ${body.testExecutionId}` }, { status: 201 });
  } catch (error) {
    console.error('Failed to add log entries:', error);
    return NextResponse.json({ message: 'Failed to add log entries', error: (error as Error).message }, { status: 500 });
  }
}
