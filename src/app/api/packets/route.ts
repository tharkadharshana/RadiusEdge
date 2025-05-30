
// src/app/api/packets/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { RadiusPacket, ExecutionTool, RadClientOptions, RadTestOptions } from '@/app/packets/page'; // Assuming types are exported
import { v4 as uuidv4 } from 'uuid';

// GET all packets
export async function GET() {
  try {
    const db = await getDb();
    const packetsFromDb = await db.all('SELECT * FROM packets ORDER BY lastModified DESC');
    
    const packets: RadiusPacket[] = packetsFromDb.map((p: any) => ({
      ...p,
      attributes: p.attributes ? JSON.parse(p.attributes as string) : [],
      tags: p.tags ? JSON.parse(p.tags as string) : [],
      toolOptions: p.toolOptions ? JSON.parse(p.toolOptions as string) : undefined,
    })) as RadiusPacket[];

    return NextResponse.json(packets);
  } catch (error) {
    console.error('Failed to fetch packets:', error);
    return NextResponse.json({ message: 'Failed to fetch packets', error: (error as Error).message }, { status: 500 });
  }
}

// POST a new packet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, attributes, tags, executionTool, toolOptions } = body as Omit<RadiusPacket, 'id' | 'lastModified'>;

    if (!name) {
      return NextResponse.json({ message: 'Packet name is required' }, { status: 400 });
    }

    const db = await getDb();
    const newPacket: RadiusPacket = {
      id: uuidv4(),
      name,
      description: description || '',
      attributes: attributes || [],
      tags: tags || [],
      lastModified: new Date().toISOString(),
      executionTool: executionTool || 'radclient', // Default to radclient
      toolOptions: toolOptions || {},
    };

    await db.run(
      'INSERT INTO packets (id, name, description, attributes, lastModified, tags, executionTool, toolOptions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      newPacket.id,
      newPacket.name,
      newPacket.description,
      JSON.stringify(newPacket.attributes),
      newPacket.lastModified,
      JSON.stringify(newPacket.tags),
      newPacket.executionTool,
      JSON.stringify(newPacket.toolOptions)
    );

    return NextResponse.json(newPacket, { status: 201 });
  } catch (error) {
    console.error('Failed to create packet:', error);
    return NextResponse.json({ message: 'Failed to create packet', error: (error as Error).message }, { status: 500 });
  }
}

    