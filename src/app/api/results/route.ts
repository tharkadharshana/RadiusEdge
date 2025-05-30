
// src/app/api/results/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { TestResult } from '@/app/results/page'; // Assuming TestResult type is exported from results page
import { v4 as uuidv4 } from 'uuid';

// GET all test results
// TODO: Add filtering capabilities (scenarioName, status, server, date range) via query params
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    // For now, order by timestamp descending to get recent results first
    const resultsFromDb = await db.all('SELECT * FROM test_results ORDER BY timestamp DESC');
    
    const results: TestResult[] = resultsFromDb.map(r => ({
      ...r,
      details: r.details ? JSON.parse(r.details as string) : undefined,
      timestamp: new Date(r.timestamp as string), // Ensure timestamp is a Date object
      latencyMs: Number(r.latencyMs),
    })) as TestResult[];

    return NextResponse.json(results);
  } catch (error) {
    console.error('Failed to fetch test results:', error);
    return NextResponse.json({ message: 'Failed to fetch test results', error: (error as Error).message }, { status: 500 });
  }
}

// POST a new test result
// This would typically be called by a test execution engine
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Omit<TestResult, 'id'>;

    if (!body.scenarioName || !body.status || !body.timestamp) {
      return NextResponse.json({ message: 'Scenario name, status, and timestamp are required' }, { status: 400 });
    }

    const db = await getDb();
    const newResult: TestResult = {
      id: uuidv4(),
      scenarioName: body.scenarioName,
      status: body.status,
      timestamp: body.timestamp instanceof Date ? body.timestamp : new Date(body.timestamp),
      latencyMs: Number(body.latencyMs) || 0,
      server: body.server || 'Unknown Server',
      details: body.details || {},
    };

    await db.run(
      'INSERT INTO test_results (id, scenarioName, status, timestamp, latencyMs, server, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      newResult.id,
      newResult.scenarioName,
      newResult.status,
      newResult.timestamp.toISOString(),
      newResult.latencyMs,
      newResult.server,
      JSON.stringify(newResult.details)
    );

    return NextResponse.json(newResult, { status: 201 });
  } catch (error) {
    console.error('Failed to create test result:', error);
    return NextResponse.json({ message: 'Failed to create test result', error: (error as Error).message }, { status: 500 });
  }
}
