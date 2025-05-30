
// src/app/api/dictionaries/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Dictionary } from '@/app/dictionaries/page'; // Assuming Dictionary type is exported

interface Params {
  id: string;
}

// GET a single dictionary's metadata by ID
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const dictFromDb = await db.get('SELECT id, name, source, isActive, lastUpdated FROM dictionaries WHERE id = ?', params.id);

    if (!dictFromDb) {
      return NextResponse.json({ message: 'Dictionary not found' }, { status: 404 });
    }
    
    const dictionary: Dictionary = {
      ...dictFromDb,
      isActive: Boolean(dictFromDb.isActive),
      // Mock counts
      attributes: 0,
      vendorCodes: 0,
    } as unknown as Dictionary;

    return NextResponse.json(dictionary);
  } catch (error) {
    console.error(`Failed to fetch dictionary ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to fetch dictionary ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// PUT (update) a dictionary's metadata by ID (e.g., toggle isActive)
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const body = await request.json() as Partial<Pick<Dictionary, 'name' | 'source' | 'isActive'>>;

    const db = await getDb();
    const existingDict = await db.get('SELECT * FROM dictionaries WHERE id = ?', params.id);
    if (!existingDict) {
      return NextResponse.json({ message: 'Dictionary not found' }, { status: 404 });
    }

    const updatedDictData = {
      name: body.name || existingDict.name,
      source: body.source || existingDict.source,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : Boolean(existingDict.isActive),
      lastUpdated: new Date().toISOString(),
    };

    const result = await db.run(
      'UPDATE dictionaries SET name = ?, source = ?, isActive = ?, lastUpdated = ? WHERE id = ?',
      updatedDictData.name,
      updatedDictData.source,
      updatedDictData.isActive,
      updatedDictData.lastUpdated,
      params.id
    );

    if (result.changes === 0) {
        // This might happen if data is identical
    }
    
    const updatedDict = await db.get('SELECT id, name, source, isActive, lastUpdated FROM dictionaries WHERE id = ?', params.id);
    if (!updatedDict) {
        return NextResponse.json({ message: 'Failed to retrieve updated dictionary' }, { status: 500});
    }
    
    const dictionaryToReturn: Dictionary = {
        ...updatedDict,
        isActive: Boolean(updatedDict.isActive),
        attributes: 0, // Placeholder
        vendorCodes: 0, // Placeholder
    } as unknown as Dictionary;


    return NextResponse.json(dictionaryToReturn);
  } catch (error) {
    console.error(`Failed to update dictionary ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to update dictionary ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// DELETE a dictionary's metadata by ID
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM dictionaries WHERE id = ?', params.id);

    if (result.changes === 0) {
      return NextResponse.json({ message: 'Dictionary not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Dictionary deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Failed to delete dictionary ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to delete dictionary ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

