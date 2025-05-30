
// src/app/api/dictionaries/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Dictionary } from '@/app/dictionaries/page'; // Assuming Dictionary type is exported
import { v4 as uuidv4 } from 'uuid';

// Helper to parse JSON safely
const parseJsonField = (jsonString: string | null | undefined, defaultValue: any[] = []) => {
  if (!jsonString) return defaultValue;
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : defaultValue;
  } catch (e) {
    console.error('Failed to parse JSON field for dictionary attributes:', e);
    return defaultValue;
  }
};


// GET all dictionary metadata
export async function GET() {
  try {
    const db = await getDb();
    const dictionariesFromDb = await db.all('SELECT id, name, source, isActive, lastUpdated, exampleAttributes FROM dictionaries ORDER BY name ASC');
    
    const dictionaries: Dictionary[] = dictionariesFromDb.map(d => {
      const exampleAttrs = parseJsonField(d.exampleAttributes);
      return {
        ...d,
        isActive: Boolean(d.isActive), 
        exampleAttributes: exampleAttrs, // API returns parsed array
        attributes: exampleAttrs.length, 
        vendorCodes: 0, 
      } as unknown as Dictionary;
    });

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
    const id = body.name.toLowerCase().replace(/[^a-z0-9]/gi, '_') + '_' + uuidv4().substring(0,4);
    
    const newDictionaryMetadata = {
      id,
      name: body.name,
      source: body.source,
      isActive: true, 
      lastUpdated: new Date().toISOString(),
      exampleAttributes: JSON.stringify([]), // Initialize with empty array string for example attributes
    };

    await db.run(
      'INSERT INTO dictionaries (id, name, source, isActive, lastUpdated, exampleAttributes) VALUES (?, ?, ?, ?, ?, ?)',
      newDictionaryMetadata.id,
      newDictionaryMetadata.name,
      newDictionaryMetadata.source,
      newDictionaryMetadata.isActive,
      newDictionaryMetadata.lastUpdated,
      newDictionaryMetadata.exampleAttributes
    );

    const returnData: Dictionary = {
      ...newDictionaryMetadata,
      exampleAttributes: [], // Return as parsed array
      attributes: 0, 
      vendorCodes: 0, 
    } as unknown as Dictionary;


    return NextResponse.json(returnData, { status: 201 });
  } catch (error) {
    console.error('Failed to create dictionary metadata:', error);
    return NextResponse.json({ message: 'Failed to create dictionary metadata', error: (error as Error).message }, { status: 500 });
  }
}
