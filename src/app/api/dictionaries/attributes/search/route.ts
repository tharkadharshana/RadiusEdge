
// src/app/api/dictionaries/attributes/search/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { Attribute as DictionaryAttribute } from '@/app/dictionaries/page'; // Use the existing Attribute type

// Helper to parse JSON safely
const parseJsonField = (jsonString: string | null | undefined, defaultValue: any[] = []): DictionaryAttribute[] => {
  if (jsonString === null || jsonString === undefined) {
    return defaultValue;
  }
  if (typeof jsonString !== 'string') {
    console.warn('parseJsonField received non-string input, returning default. Input type:', typeof jsonString);
    return defaultValue;
  }
  if (jsonString.trim() === '' || jsonString.trim() === '[]') {
    return [];
  }
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
        const isValidArray = parsed.every(item => 
            typeof item === 'object' && 
            item !== null && 
            item.hasOwnProperty('name') // Basic check
        );
        if (isValidArray) {
            return parsed as DictionaryAttribute[];
        }
        return defaultValue;
    }
    return defaultValue;
  } catch (e: any) {
    console.error('Failed to parse JSON field for attributes:', e.message, 'Input string snippet:', jsonString.substring(0,100));
    return defaultValue;
  }
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q')?.toLowerCase() || '';
  const activeOnly = searchParams.get('activeOnly') !== 'false'; // Defaults to true

  try {
    const db = await getDb();
    let sqlQuery = 'SELECT exampleAttributes FROM dictionaries';
    if (activeOnly) {
      sqlQuery += ' WHERE isActive = 1';
    }

    const dictionariesFromDb = await db.all(sqlQuery);
    
    let allAttributeNames: string[] = [];

    dictionariesFromDb.forEach(dict => {
      const attributesArray = parseJsonField(dict.exampleAttributes as string | null, []);
      attributesArray.forEach(attr => {
        if (attr.name) { // Ensure name exists
          allAttributeNames.push(attr.name);
        }
      });
    });

    // Filter by query if provided
    if (query) {
      allAttributeNames = allAttributeNames.filter(name => name.toLowerCase().includes(query));
    }

    // Get unique names and sort them
    const uniqueAttributeNames = Array.from(new Set(allAttributeNames)).sort();

    return NextResponse.json(uniqueAttributeNames);
  } catch (error: any) {
    console.error('Failed to fetch attribute suggestions:', error.message, error.stack);
    return NextResponse.json({ message: 'Failed to fetch attribute suggestions', error: error.message }, { status: 500 });
  }
}
