
// src/app/api/scenarios/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Scenario } from '@/app/scenarios/page'; // Assuming Scenario type is exported
import { v4 as uuidv4 } from 'uuid';

// GET all scenarios
export async function GET() {
  try {
    const db = await getDb();
    const scenariosFromDb = await db.all('SELECT * FROM scenarios ORDER BY lastModified DESC');
    
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
