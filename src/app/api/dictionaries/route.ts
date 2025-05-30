
// src/app/api/dictionaries/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Dictionary, Attribute } from '@/app/dictionaries/page'; 
import { v4 as uuidv4 } from 'uuid';
import { parseDictionaryFileContent } from '@/ai/flows/parse-dictionary-file-content';

// Helper for logging with prefixes for clarity in server logs
function console_log_info_api(message: string, ...optionalParams: any[]) {
  console.log(`[API_DICT INFO] ${new Date().toISOString()} ${message}`, ...optionalParams);
}
function console_log_warn_api(message: string, ...optionalParams: any[]) {
  console.warn(`[API_DICT WARN] ${new Date().toISOString()} ${message}`, ...optionalParams);
}
function console_error_api(message: string, ...optionalParams: any[]) {
  console.error(`[API_DICT ERROR] ${new Date().toISOString()} ${message}`, ...optionalParams);
}


// Helper to parse JSON safely
const parseJsonField = (jsonString: string | null | undefined, defaultValue: any[] = []): Attribute[] => {
  if (jsonString === null || jsonString === undefined) {
    return defaultValue;
  }
  if (typeof jsonString !== 'string') {
    console_log_warn_api('parseJsonField received non-string input, returning default. Input type:', typeof jsonString);
    return defaultValue;
  }
  if (jsonString.trim() === '' || jsonString.trim() === '[]') { // Also handle '[]' specifically
    return [];
  }
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
        // Basic check for attribute structure, can be made more robust
        const isValidArray = parsed.every(item => 
            typeof item === 'object' && 
            item !== null && 
            typeof item.name === 'string' && 
            typeof item.code === 'string' && 
            typeof item.type === 'string'
        );
        if (isValidArray) {
            return parsed.map(attr => ({ id: attr.id || uuidv4(), ...attr })) as Attribute[]; // Ensure IDs
        } else {
            console_log_warn_api('Parsed JSON field for attributes was an array but did not contain valid Attribute objects. Snippet:', jsonString.substring(0,100));
            return defaultValue;
        }
    }
    console_log_warn_api('Parsed JSON field for attributes was not an array. Snippet:', jsonString.substring(0,100));
    return defaultValue;
  } catch (e: any) {
    console_error_api('Failed to parse JSON field for dictionary attributes:', e.message, 'Input string snippet:', jsonString.substring(0,100));
    return defaultValue;
  }
};


// GET all dictionary metadata
export async function GET() {
  console_log_info_api("GET request received for all dictionaries.");
  try {
    const db = await getDb();
    const dictionariesFromDb = await db.all('SELECT id, name, source, isActive, lastUpdated, exampleAttributes FROM dictionaries ORDER BY name ASC');
    console_log_info_api(`Retrieved ${dictionariesFromDb.length} dictionaries from DB.`);
    
    const dictionaries: Dictionary[] = dictionariesFromDb.map(d => {
      const exampleAttrs = parseJsonField(d.exampleAttributes as string | null, []);
      let validLastUpdated: string;
      if (d.lastUpdated) {
        const dateObj = new Date(d.lastUpdated as string);
        if (!isNaN(dateObj.getTime())) {
          validLastUpdated = dateObj.toISOString();
        } else {
          console_log_warn_api(`Invalid date string for dictionary ID ${d.id}: ${d.lastUpdated}. Defaulting lastUpdated.`);
          validLastUpdated = new Date(0).toISOString(); 
        }
      } else {
        console_log_warn_api(`Missing lastUpdated for dictionary ID ${d.id}. Defaulting lastUpdated.`);
        validLastUpdated = new Date(0).toISOString(); 
      }

      return {
        id: d.id as string,
        name: d.name as string,
        source: (d.source as string | null) || 'Unknown',
        isActive: Boolean(d.isActive), 
        lastUpdated: validLastUpdated,
        exampleAttributes: exampleAttrs,
        attributes: exampleAttrs.length, 
        vendorCodes: 0, // This field is still a placeholder
      };
    });
    console_log_info_api("Successfully processed and returning dictionaries.");
    return NextResponse.json(dictionaries);
  } catch (error: any) {
    console_error_api('Failed to fetch dictionaries (GET all). Error:', error.message, error.stack);
    const errorMessage = error.message || 'An unknown error occurred while fetching dictionaries.';
    return NextResponse.json({ message: 'API: Failed to fetch dictionaries', error: errorMessage }, { status: 500 });
  }
}

// POST a new dictionary metadata entry (conceptual "import")
interface PostRequestBody {
  name?: string;
  source?: string;
  rawContent?: string; 
  files?: { name: string; content: string }[]; 
}

export async function POST(request: NextRequest) {
  console_log_info_api("POST request received to create dictionary/dictionaries.");
  let requestBody: PostRequestBody;
  try {
    requestBody = await request.json();
    console_log_info_api("POST: Request body parsed:", requestBody ? "Present" : "Empty/Invalid");
  } catch (jsonError: any) {
    console_error_api("POST: Failed to parse request body as JSON.", jsonError.message, jsonError.stack);
    return NextResponse.json({ message: 'Invalid request body: Must be JSON.', error: jsonError.message }, { status: 400 });
  }

  try {
    const db = await getDb();
    const createdDictionaries: Dictionary[] = [];

    if (requestBody.files && requestBody.files.length > 0) { // Handle bulk file import
      console_log_info_api(`POST: Processing bulk import of ${requestBody.files.length} files.`);
      for (const file of requestBody.files) {
        let dictNameFromFile = file.name.split('.').slice(0, -1).join('.') || file.name;
        let dictSourceFromFile = "Uploaded File";
        let exampleAttributesArray: Attribute[] = [];
        let vendorInfo: { vendorName?: string; vendorId?: string } = {};

        if (file.content && file.content.trim() !== '') {
          try {
            console_log_info_api(`POST: Bulk - Parsing content for file ${file.name}...`);
            const parsedResult = await parseDictionaryFileContent({ dictionaryContent: file.content });
            console_log_info_api(`POST: Bulk - AI parsing complete for ${file.name}. Vendor: ${parsedResult.vendorName}, Attributes found: ${parsedResult.attributes?.length || 0}`);
            if (parsedResult.attributes) {
              exampleAttributesArray = parsedResult.attributes.map(attr => ({
                id: attr.id || uuidv4(), 
                name: attr.name, code: attr.code, type: attr.type,
                vendor: parsedResult.vendorName || attr.vendor || 'Unknown',
                description: attr.description || '',
                enumValues: attr.enumValues || [], 
                examples: attr.examples || '',
              }));
            }
            vendorInfo = { vendorName: parsedResult.vendorName, vendorId: parsedResult.vendorId };
            if (vendorInfo.vendorName) { 
                dictNameFromFile = vendorInfo.vendorName;
                dictSourceFromFile = vendorInfo.vendorName;
            }
          } catch (parseError: any) {
            console_log_warn_api(`POST: Bulk - AI parsing of dictionary content failed for file ${file.name}:`, parseError.message);
            // Continue to create metadata even if parsing fails
          }
        } else {
            console_log_info_api(`POST: Bulk - File ${file.name} has no content, creating metadata only.`);
        }
        
        const id = `${dictNameFromFile.toLowerCase().replace(/[^a-z0-9_]/gi, '_').substring(0,30)}_${uuidv4().substring(0,8)}`;
        const newDictionaryMetadata = {
          id,
          name: dictNameFromFile,
          source: dictSourceFromFile,
          isActive: true,
          lastUpdated: new Date().toISOString(),
          exampleAttributes: JSON.stringify(exampleAttributesArray),
        };
        console_log_info_api(`POST: Bulk - Inserting metadata for ${dictNameFromFile} (ID: ${id})`);
        await db.run(
          'INSERT INTO dictionaries (id, name, source, isActive, lastUpdated, exampleAttributes) VALUES (?, ?, ?, ?, ?, ?)',
          newDictionaryMetadata.id, newDictionaryMetadata.name, newDictionaryMetadata.source,
          newDictionaryMetadata.isActive ? 1 : 0, newDictionaryMetadata.lastUpdated, newDictionaryMetadata.exampleAttributes
        );
        createdDictionaries.push({
          ...newDictionaryMetadata,
          attributes: exampleAttributesArray.length, 
          vendorCodes: vendorInfo.vendorId ? 1 : 0, 
          exampleAttributes: exampleAttributesArray
        });
      }
      console_log_info_api("POST: Bulk import processed successfully.");
      return NextResponse.json(createdDictionaries, { status: 201 });
    }

    // Handle single dictionary import (manual, paste, or single file upload with content)
    console_log_info_api("POST: Processing single dictionary import.");
    let dictName = requestBody.name;
    let dictSource = requestBody.source;
    let exampleAttributesArray: Attribute[] = [];
    let vendorInfo: { vendorName?: string; vendorId?: string } = {};

    if (requestBody.rawContent) {
      try {
        console_log_info_api("POST: Single - Received rawContent, attempting to parse with AI flow...");
        const parsedResult = await parseDictionaryFileContent({ dictionaryContent: requestBody.rawContent });
        console_log_info_api(`POST: Single - AI parsing complete. Vendor: ${parsedResult.vendorName}, Attributes found: ${parsedResult.attributes?.length || 0}`);
        if (parsedResult.attributes) {
          exampleAttributesArray = parsedResult.attributes.map(attr => ({
            id: attr.id || uuidv4(), 
            name: attr.name, code: attr.code, type: attr.type,
            vendor: parsedResult.vendorName || attr.vendor || 'Unknown',
            description: attr.description || '',
            enumValues: attr.enumValues || [], 
            examples: attr.examples || '',
          }));
        }
        vendorInfo = { vendorName: parsedResult.vendorName, vendorId: parsedResult.vendorId };
        if (!dictName && parsedResult.vendorName) dictName = parsedResult.vendorName;
        if (!dictSource && parsedResult.vendorName) dictSource = parsedResult.vendorName; 
      } catch (parseError: any) {
        console_log_warn_api("POST: Single - AI parsing of dictionary content failed:", parseError.message);
        // Proceed with metadata creation even if parsing fails
      }
    }
    
    if (!dictName) { 
      console_log_warn_api("POST: Single - Dictionary name is required but not found after potential parsing.");
      return NextResponse.json({ message: 'Dictionary name is required (either provided directly or parsable from content)', error: 'Dictionary name required' }, { status: 400 });
    }
    dictSource = dictSource || (requestBody.rawContent ? "Parsed from Content" : "Manually Created");
    const id = `${dictName.toLowerCase().replace(/[^a-z0-9_]/gi, '_').substring(0,30)}_${uuidv4().substring(0,8)}`;
    
    const newDictionaryMetadata = {
      id, name: dictName, source: dictSource, isActive: true,
      lastUpdated: new Date().toISOString(),
      exampleAttributes: JSON.stringify(exampleAttributesArray),
    };

    console_log_info_api(`POST: Single - Inserting metadata for ${dictName} (ID: ${id})`);
    await db.run(
      'INSERT INTO dictionaries (id, name, source, isActive, lastUpdated, exampleAttributes) VALUES (?, ?, ?, ?, ?, ?)',
      newDictionaryMetadata.id, newDictionaryMetadata.name, newDictionaryMetadata.source,
      newDictionaryMetadata.isActive ? 1 : 0, newDictionaryMetadata.lastUpdated, newDictionaryMetadata.exampleAttributes
    );

    const returnData: Dictionary = {
      ...newDictionaryMetadata,
      attributes: exampleAttributesArray.length, 
      vendorCodes: vendorInfo.vendorId ? 1 : 0,
      exampleAttributes: exampleAttributesArray,
    };
    console_log_info_api("POST: Single dictionary import processed successfully.");
    return NextResponse.json(returnData, { status: 201 });

  } catch (error: any) {
    console_error_api('POST: Unhandled error in dictionary creation process. Error:', error.message, error.stack);
    const errorMessage = error.message || 'An unknown error occurred while creating dictionary.';
    return NextResponse.json({ message: 'Failed to create dictionary metadata due to an internal server error', error: errorMessage }, { status: 500 });
  }
}
// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE
