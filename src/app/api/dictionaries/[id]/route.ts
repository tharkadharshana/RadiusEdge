
// src/app/api/dictionaries/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Dictionary, Attribute } from '@/app/dictionaries/page'; 
import { parseDictionaryFileContent } from '@/ai/flows/parse-dictionary-file-content';
import { v4 as uuidv4 } from 'uuid';

interface Params {
  id: string;
}

// Helper for logging with prefixes for clarity in server logs
function console_log_info_api_id(message: string, ...optionalParams: any[]) {
  console.log(`[API_DICT_ID INFO] ${new Date().toISOString()} ${message}`, ...optionalParams);
}
function console_log_warn_api_id(message: string, ...optionalParams: any[]) {
  console.warn(`[API_DICT_ID WARN] ${new Date().toISOString()} ${message}`, ...optionalParams);
}
function console_error_api_id(message: string, ...optionalParams: any[]) {
  console.error(`[API_DICT_ID ERROR] ${new Date().toISOString()} ${message}`, ...optionalParams);
}


// Helper to parse JSON safely
const parseJsonField = (jsonString: string | null | undefined, defaultValue: any[] = []): Attribute[] => {
  if (jsonString === null || jsonString === undefined) {
    // console_log_info_api_id("parseJsonField: input is null/undefined, returning default.");
    return defaultValue;
  }
  if (typeof jsonString === 'string' && jsonString.trim() === '[]') {
    // console_log_info_api_id("parseJsonField: input is '[]', returning empty array.");
    return [];
  }
  if (typeof jsonString !== 'string' || jsonString.trim() === '') {
    // console_log_warn_api_id(`parseJsonField: input is not a non-empty string (type: ${typeof jsonString}), returning default.`);
    return defaultValue;
  }
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
      const isValidArray = parsed.every(item => 
          typeof item === 'object' && 
          item !== null && 
          // Optional: typeof item.id === 'string' && // ID might be generated on client for new items
          typeof item.name === 'string' && 
          typeof item.code === 'string' && 
          typeof item.type === 'string'
      );
      if (isValidArray) {
        // console_log_info_api_id(`parseJsonField: Successfully parsed ${parsed.length} attributes.`);
        return parsed.map(attr => ({ id: attr.id || uuidv4(), ...attr })) as Attribute[]; // Ensure IDs for all attributes
      } else {
        // console_log_warn_api_id('parseJsonField: Parsed JSON was an array but did not contain valid Attribute objects. Snippet:', jsonString.substring(0,100));
        return defaultValue;
      }
    }
    // console_log_warn_api_id('parseJsonField: Parsed JSON was not an array. Snippet:', jsonString.substring(0,100));
    return defaultValue;
  } catch (e: any) {
    console_error_api_id('parseJsonField: Failed to parse JSON. Error:', e.message, 'Input snippet:', jsonString.substring(0,100));
    return defaultValue;
  }
};


// GET a single dictionary's metadata by ID
export async function GET(request: NextRequest, { params }: { params: Params }) {
  console_log_info_api_id(`GET request for dictionary ID: ${params.id}`);
  try {
    const db = await getDb();
    const dictFromDb = await db.get('SELECT id, name, source, isActive, lastUpdated, exampleAttributes FROM dictionaries WHERE id = ?', params.id);

    if (!dictFromDb) {
      console_log_warn_api_id(`Dictionary not found for ID: ${params.id}`);
      return NextResponse.json({ message: 'Dictionary not found', error: 'Dictionary not found' }, { status: 404 });
    }
    
    const exampleAttrs = parseJsonField(dictFromDb.exampleAttributes as string | null, []);
    let validLastUpdated: string;
    if (dictFromDb.lastUpdated && !isNaN(new Date(dictFromDb.lastUpdated as string).getTime())) {
        validLastUpdated = new Date(dictFromDb.lastUpdated as string).toISOString();
    } else {
        console_log_warn_api_id(`Invalid or missing lastUpdated for dictionary ID ${dictFromDb.id}: '${dictFromDb.lastUpdated}'. Defaulting.`);
        validLastUpdated = new Date(0).toISOString(); // Default to epoch if invalid or missing
    }
    
    const dictionary: Dictionary = {
      id: dictFromDb.id as string,
      name: dictFromDb.name as string,
      source: (dictFromDb.source as string | null) || 'Unknown',
      isActive: Boolean(dictFromDb.isActive),
      lastUpdated: validLastUpdated,
      exampleAttributes: exampleAttrs, 
      attributes: exampleAttrs.length, 
      vendorCodes: 0, // This is a placeholder and not directly derived from VENDOR tag in this simplified model
    };
    console_log_info_api_id(`Successfully fetched dictionary ID: ${params.id}. Name: ${dictionary.name}, Attributes: ${dictionary.attributes}`);
    return NextResponse.json(dictionary);
  } catch (error: any) {
    console_error_api_id(`Failed to fetch dictionary ${params.id}. Error:`, error.message, error.stack);
    return NextResponse.json({ message: `API: Failed to fetch dictionary ${params.id}`, error: error.message || 'An unknown error occurred.' }, { status: 500 });
  }
}

interface PutRequestBody {
  name?: string;
  source?: string;
  isActive?: boolean;
  rawContent?: string; 
  exampleAttributes?: Attribute[] | string; 
}

// PUT (update) a dictionary's metadata by ID
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  console_log_info_api_id(`PUT request for dictionary ID: ${params.id}`);
  try {
    const body = await request.json() as PutRequestBody; 
    const db = await getDb();
    const existingDict = await db.get('SELECT * FROM dictionaries WHERE id = ?', params.id);

    if (!existingDict) {
      console_log_warn_api_id(`Dictionary not found for PUT request, ID: ${params.id}`);
      return NextResponse.json({ message: 'Dictionary not found', error: 'Dictionary not found to update' }, { status: 404 });
    }

    let exampleAttributesForDb: string;
    let vendorInfo: { vendorName?: string; vendorId?: string } = {};
    let finalName = body.name !== undefined ? body.name : existingDict.name as string;
    let finalSource = body.source !== undefined ? body.source : existingDict.source as string | null;

    if (body.rawContent) {
      console_log_info_api_id(`PUT: Received rawContent for dictionary ${params.id}, attempting to re-parse...`);
      try {
        const parsedResult = await parseDictionaryFileContent({ dictionaryContent: body.rawContent });
        let parsedExampleAttributes: Attribute[] = [];
        if (parsedResult.attributes) {
          parsedExampleAttributes = parsedResult.attributes.map(attr => ({
            id: attr.id || uuidv4(),
            name: attr.name, code: attr.code, type: attr.type,
            vendor: parsedResult.vendorName || attr.vendor || 'Unknown', // Prioritize overall vendor
            description: attr.description || '',
            enumValues: attr.enumValues || [], 
            options: attr.options || [],
            examples: attr.examples || '',
          }));
        }
        exampleAttributesForDb = JSON.stringify(parsedExampleAttributes);
        vendorInfo = { vendorName: parsedResult.vendorName, vendorId: parsedResult.vendorId };

        if (body.name === undefined && vendorInfo.vendorName) finalName = vendorInfo.vendorName;
        if (body.source === undefined && vendorInfo.vendorName) finalSource = vendorInfo.vendorName;

        console_log_info_api_id(`PUT: Re-parsing complete for dictionary ${params.id}. Vendor: ${vendorInfo.vendorName}, Attributes found: ${parsedExampleAttributes.length}`);
      } catch (parseError: any) {
        console_log_warn_api_id(`PUT: AI parsing of dictionary content failed during PUT for ${params.id}: ${parseError.message}. Falling back on existing/provided exampleAttributes.`);
        if (body.exampleAttributes !== undefined) {
          exampleAttributesForDb = typeof body.exampleAttributes === 'string' ? body.exampleAttributes : JSON.stringify(body.exampleAttributes.map(attr => ({id: attr.id || uuidv4(), ...attr})) || []);
        } else {
          exampleAttributesForDb = existingDict.exampleAttributes as string; 
        }
      }
    } else if (body.exampleAttributes !== undefined) {
       exampleAttributesForDb = typeof body.exampleAttributes === 'string' ? body.exampleAttributes : JSON.stringify(body.exampleAttributes.map(attr => ({id: attr.id || uuidv4(), ...attr})) || []);
    } else {
      exampleAttributesForDb = existingDict.exampleAttributes as string;
    }

    const updatedDictData = {
      name: finalName,
      source: finalSource || 'Unknown', 
      isActive: typeof body.isActive === 'boolean' ? (body.isActive ? 1 : 0) : (existingDict.isActive ? 1: 0),
      exampleAttributes: exampleAttributesForDb, 
      lastUpdated: new Date().toISOString(),
    };
    
    console_log_info_api_id(`PUT: Updating dictionary ID ${params.id} with data:`, { name: updatedDictData.name, source: updatedDictData.source, isActive: updatedDictData.isActive, attrsLength: (JSON.parse(updatedDictData.exampleAttributes) as Array<any>).length });

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
        console_error_api_id(`PUT: Failed to retrieve updated dictionary after save for ID ${params.id}`);
        return NextResponse.json({ message: 'Failed to retrieve updated dictionary after save', error: 'Failed to retrieve updated dictionary' }, { status: 500});
    }
    
    const exampleAttrsRet = parseJsonField(updatedDictAfterSave.exampleAttributes as string | null, []);
    let validLastUpdatedAfterSave: string;
    if (updatedDictAfterSave.lastUpdated && !isNaN(new Date(updatedDictAfterSave.lastUpdated as string).getTime())) {
        validLastUpdatedAfterSave = new Date(updatedDictAfterSave.lastUpdated as string).toISOString();
    } else {
        validLastUpdatedAfterSave = new Date(0).toISOString(); // Default to epoch
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
    console_log_info_api_id(`PUT: Successfully updated dictionary ID: ${params.id}. Returning updated data.`);
    return NextResponse.json(dictionaryToReturn);
  } catch (error: any) {
    console_error_api_id(`PUT: Failed to update dictionary ${params.id}. Error:`, error.message, error.stack);
    return NextResponse.json({ message: `Failed to update dictionary ${params.id}`, error: error.message || 'An unknown error occurred.' }, { status: 500 });
  }
}

// DELETE a dictionary's metadata by ID
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  console_log_info_api_id(`DELETE: Attempting to delete dictionary with ID: ${params.id}`);
  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM dictionaries WHERE id = ?', params.id);
    console_log_info_api_id(`DELETE: Result for ID ${params.id}: changes = ${result.changes}`);

    if (result.changes === 0) {
      console_log_warn_api_id(`DELETE: Dictionary not found or no changes made for ID: ${params.id}. This might be okay if already deleted.`);
      return NextResponse.json({ message: 'Dictionary not found or already deleted' }, { status: 200 }); // Changed from 404 to 200
    }
    console_log_info_api_id(`DELETE: Successfully deleted dictionary ID: ${params.id}`);
    return NextResponse.json({ message: 'Dictionary deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console_error_api_id(`DELETE: Failed to delete dictionary ${params.id}. Error:`, error.message, error.stack);
    return NextResponse.json({ message: `Failed to delete dictionary ${params.id}`, error: error.message || 'An unknown error occurred.' }, { status: 500 });
  }
}
// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE
