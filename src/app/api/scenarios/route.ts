
// src/app/api/scenarios/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Scenario } from '@/app/scenarios/page'; // Assuming Scenario type is exported
import { v4 as uuidv4 } from 'uuid';

// GET all scenarios
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') as string, 10) : undefined;
  const sortBy = searchParams.get('sortBy'); // e.g., 'lastModified'
  const search = searchParams.get('search'); // New search parameter

  try {
    const db = await getDb();
    let query = 'SELECT * FROM scenarios';
    const queryParams: any[] = [];

    if (search) {
      query += ' WHERE (name LIKE ? OR description LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }
    
    if (sortBy === 'lastModified') {
      query += ' ORDER BY lastModified DESC';
    } else {
      query += (search ? ' AND' : ' WHERE') + ' 1=1 ORDER BY name ASC'; // Ensure ORDER BY is always valid
      if (search) query += ' ORDER BY name ASC'; else query += ' ORDER BY name ASC';
    }

    if (limit) {
      query += ` LIMIT ?`;
      queryParams.push(limit);
    }

    const scenariosFromDb = await db.all(query, ...queryParams);
    
    const scenarios: Scenario[] = scenariosFromDb.map(s => ({
      ...s,
      variables: s.variables ? JSON.parse(s.variables as string) : [],
      steps: s.steps ? JSON.parse(s.steps as string) : [],
      tags: s.tags ? JSON.parse(s.tags as string) : [],
    })) as Scenario[];

    return NextResponse.json(scenarios);
  } catch (error) {
    console.error('Failed to fetch scenarios:', error);
    return NextResponse.json({ message: 'Failed to fetch scenarios', error: (error as Error).message }, { status: 500 });
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
    console.error('Failed to create scenario:', error);
    return NextResponse.json({ message: 'Failed to create scenario', error: (error as Error).message }, { status: 500 });
  }
}
