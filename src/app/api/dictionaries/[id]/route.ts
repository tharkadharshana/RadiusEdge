
// src/app/api/dictionaries/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Dictionary, Attribute } from '@/app/dictionaries/page'; 
import { parseDictionaryFileContent } from '@/ai/flows/parse-dictionary-file-content';
import { v4 as uuidv4 } from 'uuid';

interface Params {
  id: string;
}

// Helper to parse JSON safely
const parseJsonField = (jsonString: string | null | undefined, defaultValue: any[] = []): Attribute[] => {
  if (!jsonString) return defaultValue;
  try {
    const parsed = JSON.parse(jsonString);
     // Add basic validation for attribute structure if needed
    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'object' && item !== null && 'name' in item && 'code' in item && 'type' in item)) {
      return parsed as Attribute[];
    }
    // console.warn('Parsed JSON field for attributes was not an array of valid Attribute objects:', parsed);
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
    let validLastUpdated: string;
    if (dictFromDb.lastUpdated) {
      const dateObj = new Date(dictFromDb.lastUpdated as string);
      if (!isNaN(dateObj.getTime())) {
        validLastUpdated = dateObj.toISOString();
      } else {
        console.warn(`API: Invalid date string for dictionary ID ${dictFromDb.id}: ${dictFromDb.lastUpdated}. Defaulting lastUpdated.`);
        validLastUpdated = new Date(0).toISOString();
      }
    } else {
      validLastUpdated = new Date(0).toISOString();
    }
    
    const dictionary: Dictionary = {
      id: dictFromDb.id as string,
      name: dictFromDb.name as string,
      source: (dictFromDb.source as string | null) || 'Unknown',
      isActive: Boolean(dictFromDb.isActive),
      lastUpdated: validLastUpdated,
      exampleAttributes: exampleAttrs, 
      attributes: exampleAttrs.length, 
      vendorCodes: 0, // Placeholder
    };

    return NextResponse.json(dictionary);
  } catch (error: any) {
    console.error(`Failed to fetch dictionary ${params.id} (API Error):`, error.stack || error);
    const errorMessage = error.message || 'An unknown error occurred in the API.';
    return NextResponse.json({ message: `API: Failed to fetch dictionary ${params.id}`, error: errorMessage, errorDetails: error.stack }, { status: 500 });
  }
}

interface PutRequestBody {
  name?: string;
  source?: string;
  isActive?: boolean;
  rawContent?: string;
  exampleAttributes?: Attribute[]; // Allow updating exampleAttributes directly (e.g. from manual edits)
}

// PUT (update) a dictionary's metadata by ID
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const body = await request.json() as PutRequestBody; 
    const db = await getDb();
    const existingDict = await db.get('SELECT * FROM dictionaries WHERE id = ?', params.id);
    if (!existingDict) {
      return NextResponse.json({ message: 'Dictionary not found' }, { status: 404 });
    }

    let exampleAttributesString = existingDict.exampleAttributes as string | null;
    let vendorInfo: { vendorName?: string; vendorId?: string } = {};

    if (body.rawContent) {
      try {
        console.log(`API: Received rawContent for dictionary ${params.id}, attempting to parse...`);
        const parsedResult = await parseDictionaryFileContent({ dictionaryContent: body.rawContent });
        let parsedExampleAttributes: Attribute[] = [];
        if (parsedResult.attributes) {
          parsedExampleAttributes = parsedResult.attributes.map(attr => ({
            id: attr.id || uuidv4(),
            name: attr.name, code: attr.code, type: attr.type,
            vendor: parsedResult.vendorName || attr.vendor || 'Unknown',
            description: attr.description || '',
            enumValues: attr.enumValues?.map(ev => ev.name + ' (' + ev.value + ')') || [],
            examples: attr.examples || '',
          }));
        }
        exampleAttributesString = JSON.stringify(parsedExampleAttributes);
        vendorInfo = { vendorName: parsedResult.vendorName, vendorId: parsedResult.vendorId };
        console.log(`API: Parsing complete for dictionary ${params.id}. Vendor: ${vendorInfo.vendorName}, Attributes found: ${parsedExampleAttributes.length}`);
      } catch (parseError: any) {
        console.warn(`API: AI parsing of dictionary content failed during PUT for ${params.id}:`, parseError.message);
        // Potentially fall back or return error if parsing is critical for update
      }
    } else if (body.exampleAttributes !== undefined) {
      // If rawContent is not provided, but exampleAttributes is, use that directly
      exampleAttributesString = JSON.stringify(body.exampleAttributes);
    }

    const updatedDictData = {
      name: body.name !== undefined ? body.name : existingDict.name,
      source: body.source !== undefined ? body.source : existingDict.source,
      isActive: typeof body.isActive === 'boolean' ? (body.isActive ? 1 : 0) : existingDict.isActive,
      exampleAttributes: exampleAttributesString,
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
    if (!updatedDictAfterSave) { 
        return NextResponse.json({ message: 'Failed to retrieve updated dictionary after save' }, { status: 500});
    }
    
    const exampleAttrsRet = parseJsonField(updatedDictAfterSave.exampleAttributes as string | null);
    let validLastUpdatedAfterSave: string;
    if (updatedDictAfterSave.lastUpdated) {
      const dateObj = new Date(updatedDictAfterSave.lastUpdated as string);
      if (!isNaN(dateObj.getTime())) {
        validLastUpdatedAfterSave = dateObj.toISOString();
      } else {
        validLastUpdatedAfterSave = new Date(0).toISOString();
      }
    } else {
      validLastUpdatedAfterSave = new Date(0).toISOString();
    }

    const dictionaryToReturn: Dictionary = {
        id: updatedDictAfterSave.id as string,
        name: updatedDictAfterSave.name as string,
        source: (updatedDictAfterSave.source as string | null) || 'Unknown',
        isActive: Boolean(updatedDictAfterSave.isActive),
        lastUpdated: validLastUpdatedAfterSave,
        exampleAttributes: exampleAttrsRet,
        attributes: exampleAttrsRet.length,
        vendorCodes: vendorInfo.vendorId ? 1 : 0, 
    };

    return NextResponse.json(dictionaryToReturn);
  } catch (error: any) {
    console.error(`Failed to update dictionary ${params.id} (API Error):`, error.stack || error);
    const errorMessage = error.message || 'An unknown error occurred.';
    return NextResponse.json({ message: `Failed to update dictionary ${params.id}`, error: errorMessage, errorDetails: error.stack }, { status: 500 });
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
  } catch (error: any) {
    console.error(`Failed to delete dictionary ${params.id} (API Error):`, error.stack || error);
    const errorMessage = error.message || 'An unknown error occurred.';
    return NextResponse.json({ message: `Failed to delete dictionary ${params.id}`, error: errorMessage, errorDetails: error.stack }, { status: 500 });
  }
}
// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE
