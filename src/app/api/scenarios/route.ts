
// src/app/api/scenarios/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Scenario } from '@/app/scenarios/page'; // Assuming Scenario type is exported
import { v4 as uuidv4 } from 'uuid';

// GET all scenarios
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const sortBy = searchParams.get('sortBy'); // e.g., 'lastModified'
  const search = searchParams.get('search');

  try {
    const db = await getDb();
    let query = 'SELECT * FROM scenarios';
    const queryParams: any[] = [];
    const whereClauses: string[] = [];

    if (search) {
      whereClauses.push('(name LIKE ? OR description LIKE ? OR tags LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Add other WHERE clauses here if needed in the future

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    if (sortBy === 'lastModified') {
      query += ' ORDER BY lastModified DESC';
    } else {
      query += ' ORDER BY name ASC'; // Default sort
    }

    if (limit) {
      query += ` LIMIT ?`;
      queryParams.push(limit);
    }

    const scenariosFromDb = await db.all(query, ...queryParams);
    
    const scenarios: Scenario[] = scenariosFromDb.map((s: any) => ({
      ...s,
      variables: s.variables ? JSON.parse(s.variables as string) : [],
      steps: s.steps ? JSON.parse(s.steps as string) : [],
      tags: s.tags ? JSON.parse(s.tags as string) : [],
    })) as Scenario[];

    return NextResponse.json(scenarios);
  } catch (error) {
    console.error('Failed to fetch scenarios (API Error):', error instanceof Error ? error.stack : error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred in the API.';
    return NextResponse.json({ message: 'API: Failed to fetch scenarios', error: errorMessage }, { status: 500 });
  }
}

// POST a new scenario
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, variables, steps, tags } = body as Omit<Scenario, 'id' | 'lastModified'>;

    if (!name) {
      return NextResponse.json({ message: 'Scenario name is required' }, { status: 400 });
    }

    const db = await getDb();
    const newScenario: Scenario = {
      id: uuidv4(),
      name,
      description: description || '',
      variables: variables || [],
      steps: steps || [],
      tags: tags || [],
      lastModified: new Date().toISOString(),
    };

    await db.run(
      'INSERT INTO scenarios (id, name, description, variables, steps, lastModified, tags) VALUES (?, ?, ?, ?, ?, ?, ?)',
      newScenario.id,
      newScenario.name,
      newScenario.description,
      JSON.stringify(newScenario.variables),
      JSON.stringify(newScenario.steps),
      newScenario.lastModified,
      JSON.stringify(newScenario.tags)
    );

    return NextResponse.json(newScenario, { status: 201 });
  } catch (error) {
    console.error('Failed to create scenario (API Error):', error instanceof Error ? error.stack : error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: 'Failed to create scenario', error: errorMessage }, { status: 500 });
  }
}
