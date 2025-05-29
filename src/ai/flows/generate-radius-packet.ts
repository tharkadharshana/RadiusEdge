// src/ai/flows/generate-radius-packet.ts
'use server';

/**
 * @fileOverview A RADIUS packet generation AI agent.
 *
 * - generateRadiusPacket - A function that handles the RADIUS packet generation process.
 * - GenerateRadiusPacketInput - The input type for the generateRadiusPacket function.
 * - GenerateRadiusPacketOutput - The return type for the generateRadiusPacket function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateRadiusPacketInputSchema = z.object({
  vendor: z.string().describe('The vendor for which to generate the RADIUS packet (e.g., 3GPP, Cisco, Juniper, Huawei).'),
  packetType: z.string().describe('The type of RADIUS packet to generate (e.g., Access-Request, Access-Accept, Accounting-Request).'),
  context: z.string().optional().describe('Additional context or information to guide packet generation.'),
});
export type GenerateRadiusPacketInput = z.infer<typeof GenerateRadiusPacketInputSchema>;

const GenerateRadiusPacketOutputSchema = z.object({
  packetData: z.string().describe('The generated RADIUS packet data in a human-readable format.'),
  explanation: z.string().describe('An explanation of the generated packet and its attributes.'),
});
export type GenerateRadiusPacketOutput = z.infer<typeof GenerateRadiusPacketOutputSchema>;

export async function generateRadiusPacket(input: GenerateRadiusPacketInput): Promise<GenerateRadiusPacketOutput> {
  return generateRadiusPacketFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRadiusPacketPrompt',
  input: {schema: GenerateRadiusPacketInputSchema},
  output: {schema: GenerateRadiusPacketOutputSchema},
  prompt: `You are an expert RADIUS protocol engineer. You will generate a realistic RADIUS test packet based on the provided vendor, packet type, and context.

Vendor: {{{vendor}}}
Packet Type: {{{packetType}}}
Context: {{{context}}}

Provide the generated RADIUS packet data and a detailed explanation of the packet and its attributes.  The packet should be in FreeRADIUS format.
`,
});

const generateRadiusPacketFlow = ai.defineFlow(
  {
    name: 'generateRadiusPacketFlow',
    inputSchema: GenerateRadiusPacketInputSchema,
    outputSchema: GenerateRadiusPacketOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
