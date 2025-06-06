
// src/app/api/ai-interactions/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export interface AiInteraction {
  id: string;
  interactionType: 'generate_packet' | 'explain_attribute';
  userInput: string; // JSON string
  aiOutput: string; // JSON string
  timestamp: string; // ISO8601 string
}

// GET all AI interactions
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') as string, 10) : undefined;

  try {
    const db = await getDb();
    let query = 'SELECT * FROM ai_interactions ORDER BY timestamp DESC';
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    const interactionsFromDb = await db.all(query);
    
    const interactions: AiInteraction[] = interactionsFromDb.map(i => ({
      ...i,
      // userInput and aiOutput are already strings, no need to parse for list display
      // Frontend will parse when displaying full details
    })) as AiInteraction[];

    return NextResponse.json(interactions);
  } catch (error) {
    console.error('Failed to fetch AI interactions:', error);
    return NextResponse.json({ message: 'Failed to fetch AI interactions', error: (error as Error).message }, { status: 500 });
  }
}

// POST a new AI interaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Omit<AiInteraction, 'id' | 'timestamp'>;

    if (!body.interactionType || !body.userInput || !body.aiOutput) {
      return NextResponse.json({ message: 'interactionType, userInput, and aiOutput are required' }, { status: 400 });
    }

    const db = await getDb();
    const newInteraction: AiInteraction = {
      id: uuidv4(),
      interactionType: body.interactionType,
      userInput: JSON.stringify(body.userInput), // Ensure it's stored as string
      aiOutput: JSON.stringify(body.aiOutput),   // Ensure it's stored as string
      timestamp: new Date().toISOString(),
    };

    await db.run(
      'INSERT INTO ai_interactions (id, interactionType, userInput, aiOutput, timestamp) VALUES (?, ?, ?, ?, ?)',
      newInteraction.id,
      newInteraction.interactionType,
      newInteraction.userInput,
      newInteraction.aiOutput,
      newInteraction.timestamp
    );

    return NextResponse.json(newInteraction, { status: 201 });
  } catch (error) {
    console.error('Failed to create AI interaction:', error);
    return NextResponse.json({ message: 'Failed to create AI interaction', error: (error as Error).message }, { status: 500 });
  }
}
