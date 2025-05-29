// src/ai/flows/explain-radius-attribute.ts
'use server';
/**
 * @fileOverview An AI agent that explains the purpose and usage of a specific RADIUS attribute.
 *
 * - explainRadiusAttribute - A function that explains the RADIUS attribute.
 * - ExplainRadiusAttributeInput - The input type for the explainRadiusAttribute function.
 * - ExplainRadiusAttributeOutput - The return type for the explainRadiusAttribute function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainRadiusAttributeInputSchema = z.object({
  attributeName: z.string().describe('The name of the RADIUS attribute to explain.'),
  vendor: z.string().optional().describe('The vendor of the RADIUS attribute, if applicable.'),
});
export type ExplainRadiusAttributeInput = z.infer<typeof ExplainRadiusAttributeInputSchema>;

const ExplainRadiusAttributeOutputSchema = z.object({
  explanation: z.string().describe('A detailed explanation of the RADIUS attribute, including its purpose, usage, and any relevant examples.'),
});
export type ExplainRadiusAttributeOutput = z.infer<typeof ExplainRadiusAttributeOutputSchema>;

export async function explainRadiusAttribute(input: ExplainRadiusAttributeInput): Promise<ExplainRadiusAttributeOutput> {
  return explainRadiusAttributeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainRadiusAttributePrompt',
  input: {schema: ExplainRadiusAttributeInputSchema},
  output: {schema: ExplainRadiusAttributeOutputSchema},
  prompt: `You are an expert in RADIUS networking and security.

  Your task is to explain the purpose, usage, and any relevant examples of a given RADIUS attribute.
  Consider the vendor if provided. If the vendor is not provided, assume it is a standard RADIUS attribute.

  Attribute Name: {{{attributeName}}}
  Vendor: {{{vendor}}}

  Provide a comprehensive explanation that is easy to understand for network engineers and administrators.
  Include information such as:
  - The attribute's purpose in RADIUS authentication, authorization, or accounting.
  - Common use cases for the attribute.
  - Examples of how the attribute is used in different scenarios or protocols.
  - Any vendor-specific considerations (if applicable).
  `,
});

const explainRadiusAttributeFlow = ai.defineFlow(
  {
    name: 'explainRadiusAttributeFlow',
    inputSchema: ExplainRadiusAttributeInputSchema,
    outputSchema: ExplainRadiusAttributeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
