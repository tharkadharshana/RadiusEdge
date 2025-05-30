
"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, AlertTriangle, CheckCircle, FileJson, FileTerminal, FileCode, Loader2, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { parseRadiusAttributesFromString, ParseRadiusAttributesInput, ParseRadiusAttributesOutput } from '@/ai/flows/parse-radius-attributes-flow';
import type { RadiusPacket, RadiusAttribute } from '@/app/packets/page';

interface ParsedAttributeUI {
  id: string;
  name: string;
  value: string;
}

interface RadclientParams {
  server?: string;
  port?: string;
  type?: 'auth' | 'acct' | 'status' | 'disconnect';
  secret?: string;
  options?: string[];
}

export default function ImportPage() {
  const [rawInput, setRawInput] = useState('');
  const [parsedAttributes, setParsedAttributes] = useState<ParsedAttributeUI[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [radclientParams, setRadclientParams] = useState<RadclientParams | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();

  async function handleParsePacketData() {
    if (!rawInput.trim()) {
      toast({ title: "Input Empty", description: "Please paste packet data to parse.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setParsedAttributes([]);
    setDetectedFormat(null);
    setRadclientParams(null);

    try {
      let attributesTextToParse = rawInput;
      let localRadclientParams: RadclientParams = {};
      let currentDetectedFormat = "Raw Attributes";

      // Regex to capture attributes within echo and radclient parameters
      // Updated regex to be more robust for options
      const radclientRegex = /echo\s*"(.*?)"\s*\|\s*radclient\s*(-x)?\s*([\w.-]+)(?::(\d+))?\s*(auth|acct|status|disconnect)\s*([\w.-]+)((?:\s+-\w+(?:\s+[\w.:/-]+)?)*)/is;
      const radclientMatch = rawInput.match(radclientRegex);

      if (radclientMatch) {
        currentDetectedFormat = "radclient Command";
        // Attributes are in radclientMatch[1], unescape newlines if they were escaped for echo
        attributesTextToParse = radclientMatch[1].replace(/\\n/g, '\n').trim();
        localRadclientParams.server = radclientMatch[3];
        localRadclientParams.port = radclientMatch[4] || (radclientMatch[5] === 'acct' || radclientMatch[5] === 'disconnect' ? '1813' : '1812'); // common defaults
        localRadclientParams.type = radclientMatch[5] as RadclientParams['type'];
        localRadclientParams.secret = radclientMatch[6];
        // Process options, splitting by space but keeping options with their values together
        const optionsString = radclientMatch[7] ? radclientMatch[7].trim() : "";
        const optionsArray: string[] = [];
        if (optionsString) {
            // This regex attempts to split options correctly, e.g. -t 5 or -f /path/to/file
            const optionRegex = /(-\w+(?:\s+(?:[\w.:/-]+|"[^"]*"|'[^']*'))?)/g;
            let match;
            while((match = optionRegex.exec(optionsString)) !== null) {
                optionsArray.push(match[1].trim());
            }
        }
        localRadclientParams.options = optionsArray;

        if (radclientMatch[2]) { // if -x was present
          localRadclientParams.options.unshift('-x');
        }

      } else if (rawInput.trim().startsWith('{') || rawInput.trim().startsWith('[')) {
        currentDetectedFormat = "JSON";
        try {
          const jsonData = JSON.parse(rawInput.trim());
          let attributesToSet: ParsedAttributeUI[] = [];
          if (Array.isArray(jsonData) && jsonData.every(attr => typeof attr.name === 'string' && typeof attr.value === 'string')) {
            attributesToSet = jsonData.map((attr, idx) => ({ id: `attr_json_${idx}_${Date.now()}`, name: attr.name, value: attr.value }));
          } else if (typeof jsonData === 'object' && jsonData !== null && jsonData.attributes && Array.isArray(jsonData.attributes) && jsonData.attributes.every((attr: any) => typeof attr.name === 'string' && typeof attr.value === 'string')) {
             attributesToSet = jsonData.attributes.map((attr: any, idx: number) => ({ id: `attr_json_pkt_${idx}_${Date.now()}`, name: attr.name, value: attr.value }));
          } else {
            throw new Error("JSON data is not in a recognized attribute array or packet format (expected array of {name, value} or object with 'attributes' array).");
          }
          setParsedAttributes(attributesToSet);
          setDetectedFormat(currentDetectedFormat);
          setRadclientParams(localRadclientParams.server ? localRadclientParams : null); // Only set if radclient was partially matched
          setIsLoading(false);
          toast({ title: "Data Parsed", description: `Detected format: ${currentDetectedFormat}. ${attributesToSet.length} attributes parsed successfully.` });
          return;
        } catch (jsonError: any) {
          toast({ title: "JSON Parsing Error", description: (jsonError as Error).message, variant: "destructive" });
          setIsLoading(false);
          return;
        }
      }

      const parseInput: ParseRadiusAttributesInput = { rawAttributesText: attributesTextToParse };
      const result: ParseRadiusAttributesOutput = await parseRadiusAttributesFromString(parseInput);

      setParsedAttributes(result.parsedAttributes.map((pa, index) => ({ id: `attr_${index}_${Date.now()}`, name: pa.name, value: pa.value })));
      setDetectedFormat(currentDetectedFormat);
      setRadclientParams(localRadclientParams.server ? localRadclientParams : null);
      toast({ title: "Data Parsed", description: `Detected format: ${currentDetectedFormat}. ${result.parsedAttributes.length} attributes found.` });

    } catch (error: any) {
      console.error("Error parsing packet data:", error);
      toast({ title: "Parsing Failed", description: error.message || "Could not parse packet data. Check format or AI flow.", variant: "destructive" });
      setParsedAttributes([]);
      setDetectedFormat(null);
      setRadclientParams(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveToLibrary() {
    if (!parsedAttributes.length) {
      toast({ title: "No Attributes", description: "Cannot save an empty packet.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const packetName = `Imported Packet - ${new Date().toLocaleString()}`;
    const packetDescription = `Imported from ${detectedFormat || 'pasted data'}${radclientParams?.server ? ` (radclient target: ${radclientParams.server})` : ''}`;

    const attributesToSave: RadiusAttribute[] = parsedAttributes.map(attr => ({
      id: attr.id, // This ID is client-generated, backend will create its own
      name: attr.name,
      value: attr.value,
    }));

    const newPacketData: Omit<RadiusPacket, 'id' | 'lastModified'> = {
      name: packetName,
      description: packetDescription,
      attributes: attributesToSave,
      tags: detectedFormat ? [detectedFormat.toLowerCase().replace(/\s+/g, '-')] : ['imported'],
    };

    try {
      const response = await fetch('/api/packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPacketData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save packet to library");
      }
      const savedPacket = await response.json();
      toast({ title: "Packet Saved", description: `Packet "${savedPacket.name}" added to library.` });

      // Clear inputs after successful save
      setRawInput('');
      setParsedAttributes([]);
      setDetectedFormat(null);
      setRadclientParams(null);
    } catch (error: any) {
      console.error("Error saving packet:", error);
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  function getFormatIcon(format: string | null) {
    if (!format) return FileCode;
    if (format.toLowerCase().includes("radclient")) return FileTerminal;
    if (format.toLowerCase().includes("json")) return FileJson;
    return FileCode;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Packet Importer"
        description="Paste raw RADIUS data (name=value pairs), JSON, or full 'echo \"...\" | radclient ...' commands."
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Paste Packet Data</CardTitle>
          <CardDescription>Enter the raw packet data below. The system will attempt to parse it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={'Example: User-Name = "testuser"\nFramed-IP-Address = 10.0.0.1\n\nOr paste a full `echo "..." | radclient ...` command.'}
            rows={10}
            className="font-mono text-sm"
            disabled={isLoading || isSaving}
          />
          <Button onClick={handleParsePacketData} disabled={isLoading || isSaving || !rawInput.trim()} className="w-full md:w-auto">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Parse Packet Data
          </Button>
        </CardContent>
      </Card>

      {detectedFormat && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {React.createElement(getFormatIcon(detectedFormat), { className: "h-5 w-5 text-primary" })}
              Detected Format: <Badge variant="secondary">{detectedFormat}</Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {radclientParams && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Detected radclient Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {radclientParams.server && <TableRow><TableCell className="font-semibold">Server:</TableCell><TableCell>{radclientParams.server}</TableCell></TableRow>}
                {radclientParams.port && <TableRow><TableCell className="font-semibold">Port:</TableCell><TableCell>{radclientParams.port}</TableCell></TableRow>}
                {radclientParams.type && <TableRow><TableCell className="font-semibold">Type:</TableCell><TableCell>{radclientParams.type}</TableCell></TableRow>}
                {radclientParams.secret && <TableRow><TableCell className="font-semibold">Secret:</TableCell><TableCell>********</TableCell></TableRow>}
                {radclientParams.options && radclientParams.options.length > 0 && (
                  <TableRow><TableCell className="font-semibold">Options:</TableCell><TableCell>{radclientParams.options.join(' ')}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {parsedAttributes.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Parsed Attributes ({parsedAttributes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Attribute Name</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedAttributes.map((attr) => (
                    <TableRow key={attr.id}>
                      <TableCell className="font-medium">{attr.name}</TableCell>
                      <TableCell className="font-mono break-all">{attr.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={handleSaveToLibrary} className="mt-4 w-full md:w-auto" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save as New Packet to Library
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !detectedFormat && rawInput.trim().length > 0 && parsedAttributes.length === 0 && (
        <Card className="shadow-md border-amber-500 dark:border-amber-600">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-700 dark:text-amber-500">
              <AlertTriangle className="mr-2 h-5 w-5"/>Ready to Parse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You've entered some data. Click "Parse Packet Data" to process it.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
