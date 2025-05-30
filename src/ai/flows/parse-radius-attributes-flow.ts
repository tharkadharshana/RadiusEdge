
// src/ai/flows/parse-radius-attributes-flow.ts
'use server';
/**
 * @fileOverview An AI agent that parses a raw string of RADIUS attributes into a structured list.
 *
 * - parseRadiusAttributesFromString - A function that parses the raw string.
 * - ParseRadiusAttributesInput - The input type for the function.
 * - ParseRadiusAttributesOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ParseRadiusAttributesInputSchema = z.object({
  rawAttributesText: z.string().describe('A raw string containing multiple RADIUS attributes, typically one per line, e.g., "User-Name = alice\\nFramed-IP-Address = 1.2.3.4".'),
});
export type ParseRadiusAttributesInput = z.infer<typeof ParseRadiusAttributesInputSchema>;

const ParsedAttributeSchema = z.object({
  name: z.string().describe('The parsed name of the RADIUS attribute.'),
  value: z.string().describe('The parsed value of the RADIUS attribute.'),
});

const ParseRadiusAttributesOutputSchema = z.object({
  parsedAttributes: z.array(ParsedAttributeSchema).describe('An array of parsed attribute-value pairs.'),
});
export type ParseRadiusAttributesOutput = z.infer<typeof ParseRadiusAttributesOutputSchema>;

export async function parseRadiusAttributesFromString(input: ParseRadiusAttributesInput): Promise<ParseRadiusAttributesOutput> {
  return parseRadiusAttributesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'parseRadiusAttributesPrompt',
  input: {schema: ParseRadiusAttributesInputSchema},
  output: {schema: ParseRadiusAttributesOutputSchema},
  prompt: `You are an expert RADIUS protocol utility.
Your task is to parse a block of text representing RADIUS attributes and their values.
The input text will typically be in a format similar to radclient output or FreeRADIUS 'users' file format, where each line is generally 'Attribute-Name = Value' or 'Attribute-Name = "Quoted Value"'.

Input Text:
\`\`\`
{{{rawAttributesText}}}
\`\`\`

Parse each line. Extract the attribute name and its corresponding value.
- Attribute names can contain hyphens, dots, and alphanumeric characters (e.g., User-Name, Cisco-AVPair, 3GPP-Something.Else).
- Values can be numbers, IP addresses, MAC addresses, or strings.
- If a value is enclosed in double quotes (e.g., "hello world"), the quotes themselves should NOT be part of the extracted value. The value should be "hello world".
- If a value is enclosed in single quotes (e.g., 'hello world'), the quotes themselves should NOT be part of the extracted value.
- Handle hexadecimal values (e.g., 0xabcdef) correctly as strings.
- Ignore lines that are empty, comments (starting with #), or do not appear to be valid attribute-value pairs.
- Be robust to variations in spacing around the '=' sign.
- If an attribute appears multiple times, include all instances.

Return the result as a list of objects, where each object has a 'name' and a 'value' key.

Example 1:
Input:
User-Name = "alice"
Framed-IP-Address = 10.0.0.1
Vendor-Specific = 0x010203
Custom-Attr = value

Output:
{
  "parsedAttributes": [
    {"name": "User-Name", "value": "alice"},
    {"name": "Framed-IP-Address", "value": "10.0.0.1"},
    {"name": "Vendor-Specific", "value": "0x010203"},
    {"name": "Custom-Attr", "value": "value"}
  ]
}

Example 2 (with comments and empty lines):
Input:
# This is a comment
User-Name = bob
  NAS-Port-Type = Ethernet

Acct-Session-Id = "sess_123"

Output:
{
  "parsedAttributes": [
    {"name": "User-Name", "value": "bob"},
    {"name": "NAS-Port-Type", "value": "Ethernet"},
    {"name": "Acct-Session-Id", "value": "sess_123"}
  ]
}

If no valid attributes are found, return an empty list for "parsedAttributes".
`,
});

const parseRadiusAttributesFlow = ai.defineFlow(
  {
    name: 'parseRadiusAttributesFlow',
    inputSchema: ParseRadiusAttributesInputSchema,
    outputSchema: ParseRadiusAttributesOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
