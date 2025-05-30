
// src/ai/flows/parse-dictionary-file-content.ts
'use server';
/**
 * @fileOverview An AI agent that attempts to parse the content of a FreeRADIUS-style dictionary file.
 *
 * - parseDictionaryFileContent - A function that parses the dictionary content.
 * - ParseDictionaryContentInput - The input type for the function.
 * - ParsedAttribute - The structure for a parsed attribute.
 * - ParsedEnum - The structure for a parsed enum value.
 * - ParseDictionaryContentOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { v4 as uuidv4 } from 'uuid';

const ParseDictionaryContentInputSchema = z.object({
  dictionaryContent: z.string().describe('The raw text content of a dictionary file.'),
});
export type ParseDictionaryContentInput = z.infer<typeof ParseDictionaryContentInputSchema>;

const ParsedEnumSchema = z.object({
  id: z.string().describe('Unique ID for the enum value.'),
  name: z.string().describe('The symbolic name of the enum value.'),
  value: z.string().describe('The actual value of the enum.'),
});
export type ParsedEnum = z.infer<typeof ParsedEnumSchema>;

const ParsedAttributeSchema = z.object({
  id: z.string().describe('Unique ID for the attribute.'),
  name: z.string().describe('The name of the RADIUS attribute.'),
  code: z.string().describe('The numerical code of the attribute.'),
  type: z.string().describe('The data type of the attribute (e.g., string, integer, ipaddr).'),
  vendor: z.string().optional().describe('The vendor associated with this attribute, if it is vendor-specific.'),
  description: z.string().optional().describe('A description of the attribute, often from comments.'),
  options: z.array(z.string()).optional().describe('Any options associated with the attribute (e.g., has_tag, encrypt=1).'),
  enumValues: z.array(ParsedEnumSchema).optional().describe('An array of enumerated values if the attribute type supports them.'),
  examples: z.string().optional().describe('Example usage or value for the attribute.'),
});
export type ParsedAttribute = z.infer<typeof ParsedAttributeSchema>;

const ParseDictionaryContentOutputSchema = z.object({
  vendorName: z.string().optional().describe('The name of the VENDOR, if defined in the file.'),
  vendorId: z.string().optional().describe('The numerical ID of the VENDOR, if defined.'),
  attributes: z.array(ParsedAttributeSchema).describe('An array of parsed attributes from the file.'),
  // We could add unparsed lines or errors here if needed for diagnostics
});
export type ParseDictionaryContentOutput = z.infer<typeof ParseDictionaryContentOutputSchema>;

export async function parseDictionaryFileContent(input: ParseDictionaryContentInput): Promise<ParseDictionaryContentOutput> {
  return parseDictionaryFileContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'parseDictionaryFilePrompt',
  input: {schema: ParseDictionaryContentInputSchema},
  output: {schema: ParseDictionaryContentOutputSchema},
  prompt: `You are an expert at parsing FreeRADIUS dictionary files.
Your task is to parse the provided dictionary file content.
The file content is delimited by triple backticks below.

File Content:
\`\`\`
{{{dictionaryContent}}}
\`\`\`

From this content, you need to extract:
1.  VENDOR definition: If a line starts with "VENDOR <name> <id>", extract the vendor name and vendor ID. There should typically be at most one VENDOR line that isn't part of BEGIN-VENDOR/END-VENDOR. If VENDOR is defined within a BEGIN-VENDOR/END-VENDOR block, it's usually for namespacing specific attributes. Prioritize top-level VENDOR definition if present for vendorName and vendorId output fields.
2.  ATTRIBUTE definitions: Lines starting with "ATTRIBUTE <name> <code> <type> [options...]".
    - Extract the attribute name, code, and type.
    - Capture any options that follow the type (e.g., "has_tag", "encrypt=1"). Store them as an array of strings.
    - If comments (#) provide a description for the attribute on the same line or preceding lines, try to capture that as the description.
    - Assign a unique ID to each attribute.
    - If the attribute is within a BEGIN-VENDOR/END-VENDOR block, associate it with that vendor. Otherwise, it might be a standard attribute.
3.  VALUE definitions: Lines starting with "VALUE <attribute_name> <enum_name> <enum_value>".
    - These define enumerated values for a preceding ATTRIBUTE.
    - Extract the parent attribute name, the enum's symbolic name, and its actual value.
    - Assign a unique ID to each enum value.
    - Group these under the corresponding parsed attribute in its 'enumValues' array.

General Rules:
- Ignore comment lines (starting with '#') unless they provide context/description for attributes.
- Ignore lines starting with '$INCLUDE'. Do not attempt to process them.
- Handle variations in spacing.
- If multiple VENDOR lines are present, use the first one for the top-level vendorName/vendorId. Attributes within BEGIN-VENDOR/END-VENDOR should have their 'vendor' field set to that vendor name.
- If no VENDOR line is found, vendorName and vendorId can be omitted from the output. Attributes found might be standard or implicitly vendor-specific if within a BEGIN-VENDOR block.
- For 'options' on an ATTRIBUTE line, split them by spaces if multiple are present.
- Try to infer attribute descriptions from comments immediately preceding or on the same line as the ATTRIBUTE definition.
- For the 'examples' field in ParsedAttribute, you can leave it empty or provide a very simple example based on the attribute type if obvious.
- Each ATTRIBUTE and each ENUM should have a unique 'id' field in the output, you can generate UUIDs or simple unique strings like "attr_1", "enum_1".

Return the parsed data in the specified JSON format. If no attributes are found, return an empty array for 'attributes'.
If the content is completely unparseable or empty, return empty/undefined fields as appropriate.
`,
});

const parseDictionaryFileContentFlow = ai.defineFlow(
  {
    name: 'parseDictionaryFileContentFlow',
    inputSchema: ParseDictionaryContentInputSchema,
    outputSchema: ParseDictionaryContentOutputSchema,
  },
  async (input) => {
    if (!input.dictionaryContent || input.dictionaryContent.trim() === '') {
      return { attributes: [] }; // Handle empty input gracefully
    }
    try {
      const {output} = await prompt(input);
      if (!output) {
        console.warn("AI flow for dictionary parsing returned null output.");
        return { attributes: [] };
      }
      // Ensure IDs are present if AI forgets
      output.attributes = output.attributes.map(attr => ({
        ...attr,
        id: attr.id || uuidv4(),
        enumValues: attr.enumValues?.map(enumVal => ({
          ...enumVal,
          id: enumVal.id || uuidv4(),
        })) || [],
      }));
      return output;
    } catch (error) {
      console.error("Error in parseDictionaryFileContentFlow:", error);
      // Return a default/empty structure in case of error
      return {
        attributes: [],
      };
    }
  }
);
// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE
