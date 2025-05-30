
// src/app/api/packets/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { RadiusPacket, RadiusAttribute } from '@/app/packets/page'; // Assuming types are exported

interface Params {
  id: string;
}

// GET a single packet by ID
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const packetFromDb = await db.get('SELECT * FROM packets WHERE id = ?', params.id);

    if (!packetFromDb) {
      return NextResponse.json({ message: 'Packet not found' }, { status: 404 });
    }
    
    const packet: RadiusPacket = {
      ...packetFromDb,
      attributes: packetFromDb.attributes ? JSON.parse(packetFromDb.attributes as string) : [],
      tags: packetFromDb.tags ? JSON.parse(packetFromDb.tags as string) : [],
    } as RadiusPacket;

    return NextResponse.json(packet);
  } catch (error) {
    console.error(`Failed to fetch packet ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to fetch packet ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// PUT (update) a packet by ID
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const body = await request.json();
    const { name, description, attributes, tags } = body as Omit<RadiusPacket, 'id' | 'lastModified'>;

    if (!name) {
      return NextResponse.json({ message: 'Packet name is required' }, { status: 400 });
    }

    const db = await getDb();
    const existingPacket = await db.get('SELECT * FROM packets WHERE id = ?', params.id);
    if (!existingPacket) {
      return NextResponse.json({ message: 'Packet not found' }, { status: 404 });
    }

    const updatedPacketData = {
      name: name || existingPacket.name,
      description: description !== undefined ? description : existingPacket.description,
      attributes: attributes !== undefined ? JSON.stringify(attributes) : existingPacket.attributes,
      tags: tags !== undefined ? JSON.stringify(tags) : existingPacket.tags,
      lastModified: new Date().toISOString(),
    };

    const result = await db.run(
      'UPDATE packets SET name = ?, description = ?, attributes = ?, lastModified = ?, tags = ? WHERE id = ?',
      updatedPacketData.name,
      updatedPacketData.description,
      updatedPacketData.attributes,
      updatedPacketData.lastModified,
      updatedPacketData.tags,
      params.id
    );

    if (result.changes === 0) {
        return NextResponse.json({ message: 'Packet not found or no changes made' }, { status: 404 });
    }
    
    const updatedPacket = await db.get('SELECT * FROM packets WHERE id = ?', params.id);
    if (!updatedPacket) {
      return NextResponse.json({ message: 'Failed to retrieve updated packet' }, { status: 500 });
    }
    
    const packetToReturn: RadiusPacket = {
      ...updatedPacket,
      attributes: updatedPacket.attributes ? JSON.parse(updatedPacket.attributes as string) : [],
      tags: updatedPacket.tags ? JSON.parse(updatedPacket.tags as string) : [],
    } as RadiusPacket;

    return NextResponse.json(packetToReturn);
  } catch (error) {
    console.error(`Failed to update packet ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to update packet ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// DELETE a packet by ID
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM packets WHERE id = ?', params.id);

    if (result.changes === 0) {
      return NextResponse.json({ message: 'Packet not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Packet deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Failed to delete packet ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to delete packet ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}
