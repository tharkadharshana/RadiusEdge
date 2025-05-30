
// src/app/api/executions/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { TestExecution } from '../route'; // Assuming TestExecution type is exported from parent route

interface Params {
  id: string;
}

// GET a single test execution by ID
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const execution = await db.get('SELECT * FROM test_executions WHERE id = ?', params.id);

    if (!execution) {
      return NextResponse.json({ message: 'Test execution not found' }, { status: 404 });
    }
    return NextResponse.json(execution);
  } catch (error) {
    console.error(`Failed to fetch test execution ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to fetch test execution ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// PUT (update) a test execution by ID (e.g., to set endTime and status)
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const body = await request.json() as Partial<Pick<TestExecution, 'endTime' | 'status' | 'resultId'>>;
    const db = await getDb();

    const existingExecution = await db.get('SELECT * FROM test_executions WHERE id = ?', params.id);
    if (!existingExecution) {
      return NextResponse.json({ message: 'Test execution not found' }, { status: 404 });
    }

    const fieldsToUpdate: string[] = [];
    const valuesToUpdate: any[] = [];

    if (body.endTime !== undefined) { 
        fieldsToUpdate.push('endTime = ?'); 
        valuesToUpdate.push(body.endTime); 
    }
    if (body.status !== undefined) { 
        fieldsToUpdate.push('status = ?'); 
        valuesToUpdate.push(body.status); 
    }
    if (body.resultId !== undefined) { 
        fieldsToUpdate.push('resultId = ?'); 
        valuesToUpdate.push(body.resultId); 
    }
    
    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({ message: 'No valid fields provided for update' }, { status: 400 });
    }

    valuesToUpdate.push(params.id); // For the WHERE clause

    const result = await db.run(
      `UPDATE test_executions SET ${fieldsToUpdate.join(', ')} WHERE id = ?`,
      ...valuesToUpdate
    );
    
    if (result.changes === 0) {
      // Could be because data is identical or record not found (though checked above)
    }

    const updatedExecution = await db.get('SELECT * FROM test_executions WHERE id = ?', params.id);
    return NextResponse.json(updatedExecution);

  } catch (error) {
    console.error(`Failed to update test execution ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to update test execution ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// DELETE a test execution by ID (and its associated logs - requires cascading or separate logic)
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const db = await getDb();
  try {
    // For proper cleanup, associated logs should also be deleted.
    // This can be handled by database foreign key constraints with ON DELETE CASCADE,
    // or by explicit DELETE statements here.
    await db.run('DELETE FROM execution_logs WHERE testExecutionId = ?', params.id);
    const result = await db.run('DELETE FROM test_executions WHERE id = ?', params.id);

    if (result.changes === 0) {
      return NextResponse.json({ message: 'Test execution not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Test execution and associated logs deleted successfully.' });
  } catch (error) {
    console.error(`Failed to delete test execution ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to delete test execution ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}
