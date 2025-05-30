
// src/app/api/scenarios/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Scenario } from '@/app/scenarios/page'; // Assuming Scenario type is exported

interface Params {
  id: string;
}

// GET a single scenario by ID
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const scenarioFromDb = await db.get('SELECT * FROM scenarios WHERE id = ?', params.id);

    if (!scenarioFromDb) {
      return NextResponse.json({ message: 'Scenario not found' }, { status: 404 });
    }
    
    const scenario: Scenario = {
      ...scenarioFromDb,
      variables: scenarioFromDb.variables ? JSON.parse(scenarioFromDb.variables as string) : [],
      steps: scenarioFromDb.steps ? JSON.parse(scenarioFromDb.steps as string) : [],
      tags: scenarioFromDb.tags ? JSON.parse(scenarioFromDb.tags as string) : [],
    } as Scenario;

    return NextResponse.json(scenario);
  } catch (error) {
    console.error(`Failed to fetch scenario ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to fetch scenario ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// PUT (update) a scenario by ID
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const body = await request.json();
    const { name, description, variables, steps, tags } = body as Omit<Scenario, 'id' | 'lastModified'>;

    if (!name) {
      return NextResponse.json({ message: 'Scenario name is required' }, { status: 400 });
    }

    const db = await getDb();
    const existingScenario = await db.get('SELECT * FROM scenarios WHERE id = ?', params.id);
    if (!existingScenario) {
      return NextResponse.json({ message: 'Scenario not found' }, { status: 404 });
    }

    const updatedScenarioData = {
      name: name || existingScenario.name,
      description: description !== undefined ? description : existingScenario.description,
      variables: variables !== undefined ? JSON.stringify(variables) : existingScenario.variables,
      steps: steps !== undefined ? JSON.stringify(steps) : existingScenario.steps,
      tags: tags !== undefined ? JSON.stringify(tags) : existingScenario.tags,
      lastModified: new Date().toISOString(),
    };

    const result = await db.run(
      'UPDATE scenarios SET name = ?, description = ?, variables = ?, steps = ?, lastModified = ?, tags = ? WHERE id = ?',
      updatedScenarioData.name,
      updatedScenarioData.description,
      updatedScenarioData.variables,
      updatedScenarioData.steps,
      updatedScenarioData.lastModified,
      updatedScenarioData.tags,
      params.id
    );

    if (result.changes === 0) {
        return NextResponse.json({ message: 'Scenario not found or no changes made' }, { status: 404 });
    }
    
    // Fetch the updated scenario to return it
    const updatedScenario = await db.get('SELECT * FROM scenarios WHERE id = ?', params.id);
     if (!updatedScenario) { // Should not happen if update was successful
      return NextResponse.json({ message: 'Failed to retrieve updated scenario' }, { status: 500 });
    }

    const scenarioToReturn: Scenario = {
      ...updatedScenario,
      variables: updatedScenario.variables ? JSON.parse(updatedScenario.variables as string) : [],
      steps: updatedScenario.steps ? JSON.parse(updatedScenario.steps as string) : [],
      tags: updatedScenario.tags ? JSON.parse(updatedScenario.tags as string) : [],
    } as Scenario;


    return NextResponse.json(scenarioToReturn);
  } catch (error) {
    console.error(`Failed to update scenario ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to update scenario ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// DELETE a scenario by ID
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM scenarios WHERE id = ?', params.id);

    if (result.changes === 0) {
      return NextResponse.json({ message: 'Scenario not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Scenario deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Failed to delete scenario ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to delete scenario ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}
