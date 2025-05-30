
// src/app/api/results/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { TestResult } from '@/app/results/page';

interface Params {
  id: string;
}

// GET a single test result by ID
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const resultFromDb = await db.get('SELECT * FROM test_results WHERE id = ?', params.id);

    if (!resultFromDb) {
      return NextResponse.json({ message: 'Test result not found' }, { status: 404 });
    }
    
    const result: TestResult = {
      ...resultFromDb,
      details: resultFromDb.details ? JSON.parse(resultFromDb.details as string) : undefined,
      timestamp: new Date(resultFromDb.timestamp as string),
      latencyMs: Number(resultFromDb.latencyMs),
    } as TestResult;

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Failed to fetch test result ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to fetch test result ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// DELETE a test result by ID
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM test_results WHERE id = ?', params.id);

    if (result.changes === 0) {
      return NextResponse.json({ message: 'Test result not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Test result deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Failed to delete test result ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to delete test result ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// PUT (update) a test result - Less common for immutable results, but could be used for adding notes, etc.
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const body = await request.json() as Partial<Omit<TestResult, 'id'>>;
    const db = await getDb();

    const existingResult = await db.get('SELECT * FROM test_results WHERE id = ?', params.id);
    if (!existingResult) {
      return NextResponse.json({ message: 'Test result not found' }, { status: 404 });
    }

    // Example: Allow updating details or status (though status might be better set on creation)
    const updatedData = {
      scenarioName: body.scenarioName || existingResult.scenarioName,
      status: body.status || existingResult.status,
      timestamp: body.timestamp ? (body.timestamp instanceof Date ? body.timestamp.toISOString() : new Date(body.timestamp).toISOString()) : existingResult.timestamp,
      latencyMs: body.latencyMs !== undefined ? Number(body.latencyMs) : Number(existingResult.latencyMs),
      server: body.server || existingResult.server,
      details: body.details !== undefined ? JSON.stringify(body.details) : existingResult.details,
    };
    
    const result = await db.run(
      `UPDATE test_results SET 
        scenarioName = ?, status = ?, timestamp = ?, latencyMs = ?, server = ?, details = ?
      WHERE id = ?`,
      updatedData.scenarioName,
      updatedData.status,
      updatedData.timestamp,
      updatedData.latencyMs,
      updatedData.server,
      updatedData.details,
      params.id
    );

    if (result.changes === 0) {
      // This might happen if data is identical or result not found (though checked above)
    }

    const updatedResultFromDb = await db.get('SELECT * FROM test_results WHERE id = ?', params.id);
    if (!updatedResultFromDb) {
        return NextResponse.json({ message: 'Failed to retrieve updated test result' }, { status: 500});
    }
    
    const resultToReturn: TestResult = {
        ...updatedResultFromDb,
        details: updatedResultFromDb.details ? JSON.parse(updatedResultFromDb.details as string) : undefined,
        timestamp: new Date(updatedResultFromDb.timestamp as string),
        latencyMs: Number(updatedResultFromDb.latencyMs),
    } as TestResult;

    return NextResponse.json(resultToReturn);
  } catch (error) {
    console.error(`Failed to update test result ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to update test result ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}
