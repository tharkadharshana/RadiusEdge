
// src/app/api/dictionaries/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Dictionary } from '@/app/dictionaries/page'; // Assuming Dictionary type is exported
import { v4 as uuidv4 } from 'uuid';

// GET all dictionary metadata
export async function GET() {
  try {
    const db = await getDb();
    const dictionariesFromDb = await db.all('SELECT id, name, source, isActive, lastUpdated FROM dictionaries ORDER BY name ASC');
    
    const dictionaries: Dictionary[] = dictionariesFromDb.map(d => ({
      ...d,
      isActive: Boolean(d.isActive), // Ensure boolean
      // Mock attributesCount and vendorCodesCount as these are not stored in this simplified backend
      attributes: 0, // Placeholder
      vendorCodes: 0, // Placeholder
    })) as unknown as Dictionary[]; // Cast needed due to placeholder counts

    return NextResponse.json(dictionaries);
  } catch (error) {
    console.error('Failed to fetch dictionaries:', error);
    return NextResponse.json({ message: 'Failed to fetch dictionaries', error: (error as Error).message }, { status: 500 });
  }
}

// POST a new dictionary metadata entry (conceptual "import")
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<Pick<Dictionary, 'name' | 'source'>>;

    if (!body.name || !body.source) {
      return NextResponse.json({ message: 'Dictionary name and source are required' }, { status: 400 });
    }

    const db = await getDb();
    // Generate an ID, e.g., from name or UUID
    const id = body.name.toLowerCase().replace(/[^a-z0-9]/gi, '_') + '_' + uuidv4().substring(0,4);
    
    const newDictionaryMetadata = {
      id,
      name: body.name,
      source: body.source,
      isActive: true, // Default to active
      lastUpdated: new Date().toISOString(),
    };

    await db.run(
      'INSERT INTO dictionaries (id, name, source, isActive, lastUpdated) VALUES (?, ?, ?, ?, ?)',
      newDictionaryMetadata.id,
      newDictionaryMetadata.name,
      newDictionaryMetadata.source,
      newDictionaryMetadata.isActive,
      newDictionaryMetadata.lastUpdated
    );

    // Return the created metadata, plus placeholders for counts
    const returnData: Dictionary = {
      ...newDictionaryMetadata,
      attributes: 0, // Placeholder
      vendorCodes: 0, // Placeholder
    } as unknown as Dictionary;


    return NextResponse.json(returnData, { status: 201 });
  } catch (error) {
    console.error('Failed to create dictionary metadata:', error);
    return NextResponse.json({ message: 'Failed to create dictionary metadata', error: (error as Error).message }, { status: 500 });
  }
}
