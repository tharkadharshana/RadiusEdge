
// src/app/api/dictionaries/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Dictionary, Attribute } from '@/app/dictionaries/page'; 
import { v4 as uuidv4 } from 'uuid';

// Helper to parse JSON safely
const parseJsonField = (jsonString: string | null | undefined, defaultValue: any[] = []): Attribute[] => {
  if (!jsonString) return defaultValue;
  try {
    const parsed = JSON.parse(jsonString);
    // Add basic validation for attribute structure if needed
    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'object' && 'name' in item && 'code' in item && 'type' in item)) {
      return parsed as Attribute[];
    }
    return defaultValue;
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
      const exampleAttrs = parseJsonField(d.exampleAttributes as string | null, []);
      return {
        id: d.id as string,
        name: d.name as string,
        source: (d.source as string | null) || 'Unknown',
        isActive: Boolean(d.isActive), 
        lastUpdated: (d.lastUpdated as string | null) || new Date(0).toISOString(),
        exampleAttributes: exampleAttrs,
        attributes: exampleAttrs.length, 
        vendorCodes: 0, // Placeholder for now
      };
    });

    return NextResponse.json(dictionaries);
  } catch (error) {
    console.error('Failed to fetch dictionaries (API Error):', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred in the API.';
    return NextResponse.json({ message: 'API: Failed to fetch dictionaries', error: errorMessage }, { status: 500 });
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
      exampleAttributes: JSON.stringify([]), // Initialize with empty array string
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
      id: newDictionaryMetadata.id,
      name: newDictionaryMetadata.name,
      source: newDictionaryMetadata.source,
      isActive: newDictionaryMetadata.isActive,
      lastUpdated: newDictionaryMetadata.lastUpdated,
      exampleAttributes: [], // Return as parsed array
      attributes: 0, 
      vendorCodes: 0, 
    };


    return NextResponse.json(returnData, { status: 201 });
  } catch (error) {
    console.error('Failed to create dictionary metadata:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: 'Failed to create dictionary metadata', error: errorMessage }, { status: 500 });
  }
}

    