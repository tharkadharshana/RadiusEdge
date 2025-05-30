
// src/app/api/dictionaries/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Dictionary, Attribute } from '@/app/dictionaries/page'; 

interface Params {
  id: string;
}

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

// GET a single dictionary's metadata by ID
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const dictFromDb = await db.get('SELECT id, name, source, isActive, lastUpdated, exampleAttributes FROM dictionaries WHERE id = ?', params.id);

    if (!dictFromDb) {
      return NextResponse.json({ message: 'Dictionary not found' }, { status: 404 });
    }
    
    const exampleAttrs = parseJsonField(dictFromDb.exampleAttributes as string | null);
    const dictionary: Dictionary = {
      id: dictFromDb.id as string,
      name: dictFromDb.name as string,
      source: (dictFromDb.source as string | null) || 'Unknown',
      isActive: Boolean(dictFromDb.isActive),
      lastUpdated: (dictFromDb.lastUpdated as string | null) || new Date(0).toISOString(),
      exampleAttributes: exampleAttrs, 
      attributes: exampleAttrs.length, 
      vendorCodes: 0, // Placeholder
    };

    return NextResponse.json(dictionary);
  } catch (error) {
    console.error(`Failed to fetch dictionary ${params.id} (API Error):`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred in the API.';
    return NextResponse.json({ message: `API: Failed to fetch dictionary ${params.id}`, error: errorMessage }, { status: 500 });
  }
}

// PUT (update) a dictionary's metadata by ID (e.g., toggle isActive or update exampleAttributes)
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const body = await request.json(); 

    const db = await getDb();
    const existingDict = await db.get('SELECT * FROM dictionaries WHERE id = ?', params.id);
    if (!existingDict) {
      return NextResponse.json({ message: 'Dictionary not found' }, { status: 404 });
    }

    const updatedDictData = {
      name: body.name !== undefined ? body.name : existingDict.name,
      source: body.source !== undefined ? body.source : existingDict.source,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : Boolean(existingDict.isActive),
      exampleAttributes: body.exampleAttributes !== undefined 
        ? (typeof body.exampleAttributes === 'string' ? body.exampleAttributes : JSON.stringify(body.exampleAttributes)) 
        : existingDict.exampleAttributes,
      lastUpdated: new Date().toISOString(),
    };

    await db.run(
      'UPDATE dictionaries SET name = ?, source = ?, isActive = ?, lastUpdated = ?, exampleAttributes = ? WHERE id = ?',
      updatedDictData.name,
      updatedDictData.source,
      updatedDictData.isActive,
      updatedDictData.lastUpdated,
      updatedDictData.exampleAttributes,
      params.id
    );
    
    const updatedDictAfterSave = await db.get('SELECT id, name, source, isActive, lastUpdated, exampleAttributes FROM dictionaries WHERE id = ?', params.id);
    if (!updatedDictAfterSave) { // Should not happen
        return NextResponse.json({ message: 'Failed to retrieve updated dictionary after save' }, { status: 500});
    }
    
    const exampleAttrsRet = parseJsonField(updatedDictAfterSave.exampleAttributes as string | null);
    const dictionaryToReturn: Dictionary = {
        id: updatedDictAfterSave.id as string,
        name: updatedDictAfterSave.name as string,
        source: (updatedDictAfterSave.source as string | null) || 'Unknown',
        isActive: Boolean(updatedDictAfterSave.isActive),
        lastUpdated: (updatedDictAfterSave.lastUpdated as string | null) || new Date(0).toISOString(),
        exampleAttributes: exampleAttrsRet,
        attributes: exampleAttrsRet.length,
        vendorCodes: 0, 
    };

    return NextResponse.json(dictionaryToReturn);
  } catch (error) {
    console.error(`Failed to update dictionary ${params.id}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: `Failed to update dictionary ${params.id}`, error: errorMessage }, { status: 500 });
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
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: `Failed to delete dictionary ${params.id}`, error: errorMessage }, { status: 500 });
  }
}

    