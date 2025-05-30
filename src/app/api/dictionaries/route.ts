
// src/app/api/dictionaries/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Dictionary, Attribute } from '@/app/dictionaries/page'; 
import { v4 as uuidv4 } from 'uuid';
import { parseDictionaryFileContent } from '@/ai/flows/parse-dictionary-file-content';

// Helper to parse JSON safely
const parseJsonField = (jsonString: string | null | undefined, defaultValue: any[] = []): Attribute[] => {
  if (jsonString === null || jsonString === undefined) {
    // console.warn('JSON string for attributes was null or undefined, returning default.');
    return defaultValue;
  }
  if (typeof jsonString !== 'string') {
    // console.warn('Attempted to parse non-string as JSON for attributes, returning default. Value:', jsonString);
    return defaultValue;
  }
  if (jsonString.trim() === '') {
    // console.warn('JSON string for attributes was empty, returning default.');
    return defaultValue;
  }
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'object' && item !== null && 'name' in item && 'code' in item && 'type' in item)) {
      return parsed as Attribute[];
    }
    // console.warn('Parsed JSON field for attributes was not an array of valid Attribute objects:', parsed);
    return defaultValue;
  } catch (e) {
    console.error('Failed to parse JSON field for dictionary attributes:', e, 'Input string:', jsonString.substring(0,100)); // Log part of the string
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
          // console.warn(`Invalid date string for dictionary ID ${d.id}: ${d.lastUpdated}. Defaulting lastUpdated.`);
          validLastUpdated = new Date(0).toISOString(); 
        }
      } else {
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
        vendorCodes: 0, // Placeholder for now
      };
    });

    return NextResponse.json(dictionaries);
  } catch (error) {
    console.error('Failed to fetch dictionaries (API Error):', error instanceof Error ? error.stack : error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred in the API.';
    return NextResponse.json({ message: 'API: Failed to fetch dictionaries', error: errorMessage }, { status: 500 });
  }
}

// POST a new dictionary metadata entry (conceptual "import")
interface PostRequestBody {
  name?: string;
  source?: string;
  rawContent?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PostRequestBody;

    let dictName = body.name;
    let dictSource = body.source;
    let exampleAttributes: Attribute[] = [];
    let vendorInfo: { vendorName?: string; vendorId?: string } = {};

    if (body.rawContent) {
      try {
        const parsedResult = await parseDictionaryFileContent({ dictionaryContent: body.rawContent });
        if (parsedResult.attributes) {
          exampleAttributes = parsedResult.attributes.map(attr => ({
            id: attr.id || uuidv4(), 
            name: attr.name,
            code: attr.code,
            type: attr.type,
            vendor: parsedResult.vendorName || attr.vendor || 'Unknown',
            description: attr.description || '',
            enumValues: attr.enumValues || [],
            examples: attr.examples || '',
          }));
        }
        vendorInfo = { vendorName: parsedResult.vendorName, vendorId: parsedResult.vendorId };
        
        if (!dictName && parsedResult.vendorName) {
          dictName = parsedResult.vendorName;
        }
        if (!dictSource && parsedResult.vendorName) {
          dictSource = parsedResult.vendorName;
        }
      } catch (parseError) {
        console.warn("AI parsing of dictionary content failed during POST:", parseError);
      }
    }
    
    if (!dictName) {
      return NextResponse.json({ message: 'Dictionary name is required (either provided directly or parsable from content)' }, { status: 400 });
    }
    dictSource = dictSource || "Manually Created / Parsed";


    const db = await getDb();
    const id = dictName.toLowerCase().replace(/[^a-z0-9_]/gi, '_').substring(0,50) + '_' + uuidv4().substring(0,8);
    
    const newDictionaryMetadata = {
      id,
      name: dictName,
      source: dictSource,
      isActive: true, 
      lastUpdated: new Date().toISOString(),
      exampleAttributes: JSON.stringify(exampleAttributes), 
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
      exampleAttributes: exampleAttributes,
      attributes: exampleAttributes.length, 
      vendorCodes: vendorInfo.vendorId ? 1 : 0, 
    };

    return NextResponse.json(returnData, { status: 201 });
  } catch (error) {
    console.error('Failed to create dictionary metadata (API Error):', error instanceof Error ? error.stack : error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: 'Failed to create dictionary metadata', error: errorMessage }, { status: 500 });
  }
}
