
// src/app/api/dictionaries/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Dictionary, Attribute } from '@/app/dictionaries/page'; 
import { v4 as uuidv4 } from 'uuid';
import { parseDictionaryFileContent } from '@/ai/flows/parse-dictionary-file-content';

// Helper to parse JSON safely
const parseJsonField = (jsonString: string | null | undefined, defaultValue: any[] = []): Attribute[] => {
  if (jsonString === null || jsonString === undefined) {
    return defaultValue;
  }
  if (typeof jsonString !== 'string') {
    console.warn('API: parseJsonField received non-string input, returning default. Input type:', typeof jsonString);
    return defaultValue;
  }
  if (jsonString.trim() === '') {
    return defaultValue;
  }
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed) && parsed.every(item => 
        typeof item === 'object' && 
        item !== null && 
        typeof item.id === 'string' && // Ensure attributes have IDs
        typeof item.name === 'string' && 
        typeof item.code === 'string' && 
        typeof item.type === 'string'
    )) {
      return parsed as Attribute[];
    }
    console.warn('API: Parsed JSON field for attributes was not an array of valid Attribute objects. Input snippet:', jsonString.substring(0,100));
    return defaultValue;
  } catch (e: any) {
    console.error('API: Failed to parse JSON field for dictionary attributes:', e.message, 'Input string snippet:', jsonString.substring(0,100));
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
      let validLastUpdated: string;
      if (d.lastUpdated) {
        const dateObj = new Date(d.lastUpdated as string);
        if (!isNaN(dateObj.getTime())) {
          validLastUpdated = dateObj.toISOString();
        } else {
          console.warn(`API: Invalid date string for dictionary ID ${d.id}: ${d.lastUpdated}. Defaulting lastUpdated.`);
          validLastUpdated = new Date(0).toISOString(); 
        }
      } else {
        console.warn(`API: Missing lastUpdated for dictionary ID ${d.id}. Defaulting lastUpdated.`);
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
        vendorCodes: 0, // This field is still a placeholder in the current data model
      };
    });

    return NextResponse.json(dictionaries);
  } catch (error: any) {
    console.error('API: Failed to fetch dictionaries (GET all). Error:', error.message, error.stack);
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
  try {
    const body = await request.json() as PostRequestBody;
    const db = await getDb();
    const createdDictionaries: Dictionary[] = [];

    if (body.files && body.files.length > 0) { // Handle bulk file import
      for (const file of body.files) {
        let dictNameFromFile = file.name.split('.').slice(0, -1).join('.') || file.name;
        let dictSourceFromFile = "Uploaded File";
        let exampleAttributesArray: Attribute[] = [];
        let vendorInfo: { vendorName?: string; vendorId?: string } = {};

        if (file.content && file.content.trim() !== '') {
          try {
            console.log(`API: Bulk import - parsing content for file ${file.name}...`);
            const parsedResult = await parseDictionaryFileContent({ dictionaryContent: file.content });
            if (parsedResult.attributes) {
              exampleAttributesArray = parsedResult.attributes.map(attr => ({
                id: attr.id || uuidv4(), 
                name: attr.name, code: attr.code, type: attr.type,
                vendor: parsedResult.vendorName || attr.vendor || 'Unknown',
                description: attr.description || '',
                enumValues: attr.enumValues || [], // Ensure enumValues is an array
                examples: attr.examples || '',
              }));
            }
            vendorInfo = { vendorName: parsedResult.vendorName, vendorId: parsedResult.vendorId };
            if (vendorInfo.vendorName) { // Prioritize parsed vendor name
                dictNameFromFile = vendorInfo.vendorName;
                dictSourceFromFile = vendorInfo.vendorName;
            }
            console.log(`API: Bulk parsing for ${file.name} complete. Vendor: ${vendorInfo.vendorName}, Attributes: ${exampleAttributesArray.length}`);
          } catch (parseError: any) {
            console.warn(`API: AI parsing of dictionary content failed during bulk POST for file ${file.name}:`, parseError.message);
          }
        } else {
            console.log(`API: Bulk import - file ${file.name} has no content, creating metadata only.`);
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
      return NextResponse.json(createdDictionaries, { status: 201 });
    }

    // Handle single dictionary import (manual, paste, or single file upload with content)
    let dictName = body.name;
    let dictSource = body.source;
    let exampleAttributesArray: Attribute[] = [];
    let vendorInfo: { vendorName?: string; vendorId?: string } = {};

    if (body.rawContent) {
      try {
        console.log("API: Single import - Received rawContent, attempting to parse with AI flow...");
        const parsedResult = await parseDictionaryFileContent({ dictionaryContent: body.rawContent });
        if (parsedResult.attributes) {
          exampleAttributesArray = parsedResult.attributes.map(attr => ({
            id: attr.id || uuidv4(), 
            name: attr.name, code: attr.code, type: attr.type,
            vendor: parsedResult.vendorName || attr.vendor || 'Unknown',
            description: attr.description || '',
            enumValues: attr.enumValues || [], // Ensure enumValues is an array
            examples: attr.examples || '',
          }));
        }
        vendorInfo = { vendorName: parsedResult.vendorName, vendorId: parsedResult.vendorId };
        if (!dictName && parsedResult.vendorName) dictName = parsedResult.vendorName;
        if (!dictSource && parsedResult.vendorName) dictSource = parsedResult.vendorName; // Use parsed vendor as source if not provided
        console.log(`API: AI parsing complete. Vendor: ${vendorInfo.vendorName}, Attributes found: ${exampleAttributesArray.length}`);
      } catch (parseError: any) {
        console.warn("API: AI parsing of dictionary content failed during POST:", parseError.message);
      }
    }
    
    if (!dictName) { // If name is still not set (e.g. manual mode without name, or parsing failed to get vendor)
      return NextResponse.json({ message: 'Dictionary name is required (either provided directly or parsable from content)', error: 'Dictionary name required' }, { status: 400 });
    }
    dictSource = dictSource || (body.rawContent ? "Parsed from Content" : "Manually Created");
    const id = `${dictName.toLowerCase().replace(/[^a-z0-9_]/gi, '_').substring(0,30)}_${uuidv4().substring(0,8)}`;
    
    const newDictionaryMetadata = {
      id, name: dictName, source: dictSource, isActive: true,
      lastUpdated: new Date().toISOString(),
      exampleAttributes: JSON.stringify(exampleAttributesArray),
    };

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
    return NextResponse.json(returnData, { status: 201 });

  } catch (error: any) {
    console.error('API: Failed to create dictionary metadata (POST). Error:', error.message, error.stack);
    const errorMessage = error.message || 'An unknown error occurred while creating dictionary.';
    return NextResponse.json({ message: 'Failed to create dictionary metadata', error: errorMessage }, { status: 500 });
  }
}
// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE
