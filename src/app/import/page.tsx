
"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, AlertTriangle, CheckCircle, FileJson, FileTerminal, FileCode, Loader2, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { parseRadiusAttributesFromString, ParseRadiusAttributesInput, ParseRadiusAttributesOutput } from '@/ai/flows/parse-radius-attributes-flow';

interface ParsedAttribute {
  name: string;
  value: string;
}

interface RadclientParams {
  server: string;
  port?: string;
  type: 'auth' | 'acct' | 'status' | string; // string for custom types
  secret: string;
  options?: string;
}

export default function ImportPage() {
  const [rawInput, setRawInput] = useState('');
  const [parsedAttributes, setParsedAttributes] = useState<ParsedAttribute[]>([]);
  const [radclientParams, setRadclientParams] = useState<RadclientParams | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleParsePacketData = async () => {
    if (!rawInput.trim()) {
      toast({ title: "Input Empty", description: "Please paste packet data to parse.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setError(null);
    setParsedAttributes([]);
    setRadclientParams(null);
    setDetectedFormat(null);

    try {
      let attributesToParse = rawInput;
      let tempRadclientParams: RadclientParams | null = null;
      let currentDetectedFormat: string | null = null;

      // Basic radclient command detection
      const radclientMatch = rawInput.match(/echo\s+"([\s\S]*?)"\s*\|\s*radclient\s*(.*)/i);
      if (radclientMatch) {
        attributesToParse = radclientMatch[1].trim();
        const radclientArgsString = radclientMatch[2];
        
        const paramsMatch = radclientArgsString.match(/(-x\s+)?([\w.-]+)(?::(\d+))?\s+(\w+)\s+([\w-]+)(.*)/);
        if (paramsMatch) {
            tempRadclientParams = {
                server: paramsMatch[2],
                port: paramsMatch[3],
                type: paramsMatch[4],
                secret: paramsMatch[5],
                options: paramsMatch[6] ? paramsMatch[6].trim() : undefined
            };
            currentDetectedFormat = "radclient command";
        } else {
             currentDetectedFormat = "radclient command (parameters unclear)";
        }
      } else if (rawInput.trim().startsWith("{") && rawInput.trim().endsWith("}")) {
        currentDetectedFormat = "JSON (parsing not yet fully supported for direct JSON object - use attribute list for now)";
        // For now, we'll still try to parse it as attribute list if it's not a JSON array of attributes
      } else {
        currentDetectedFormat = "Raw Attributes List";
      }
      
      setRadclientParams(tempRadclientParams);
      setDetectedFormat(currentDetectedFormat);

      const input: ParseRadiusAttributesInput = { rawAttributesText: attributesToParse };
      const result: ParseRadiusAttributesOutput = await parseRadiusAttributesFromString(input);

      if (result.parsedAttributes && result.parsedAttributes.length > 0) {
        setParsedAttributes(result.parsedAttributes);
        toast({ title: "Parsing Successful", description: `Successfully parsed ${result.parsedAttributes.length} attributes. Detected format: ${currentDetectedFormat || 'N/A'}` });
      } else {
        // If radclient params were detected but no attributes from echo, still show params.
        // Error only if NO attributes AND NO radclient params found from echo
        if (tempRadclientParams && (!result.parsedAttributes || result.parsedAttributes.length === 0)) {
             toast({ title: "Radclient Params Detected", description: `Parsed radclient parameters. No attributes found in 'echo' part or they were unparseable by AI. Detected format: ${currentDetectedFormat || 'N/A'}`});
        } else if (!tempRadclientParams) { // No radclient params, and no attributes from raw text
            setError("No attributes found or failed to parse the provided data format.");
            toast({ title: "Parsing Issue", description: "No attributes found or the format was not recognized by the AI parser.", variant: "destructive" });
        }
      }
    } catch (e: any) {
      console.error("Parsing error:", e);
      setError(e.message || "An unexpected error occurred during parsing.");
      toast({ title: "Parsing Failed", description: e.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getFormatIcon = (format: string | null) => {
    if (!format) return <FileCode className="h-5 w-5 text-muted-foreground" />;
    if (format.includes("radclient")) return <FileTerminal className="h-5 w-5 text-primary" />;
    if (format.includes("JSON")) return <FileJson className="h-5 w-5 text-accent" />;
    return <FileCode className="h-5 w-5 text-muted-foreground" />;
  };

  const handleSaveToLibrary = () => {
    if(parsedAttributes.length === 0 && !radclientParams) {
        toast({title: "Nothing to Save", description: "Please parse some packet data first.", variant: "destructive"});
        return;
    }
    // In a real app, this would open a dialog to name the packet and save it.
    toast({title: "Save to Library (Mock)", description: `Conseptually saving ${parsedAttributes.length} attributes. Radclient params: ${radclientParams ? JSON.stringify(radclientParams) : 'N/A'}`});
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Packet Importer"
        description="Paste raw RADIUS data (name=value pairs), JSON, or full 'echo \"...\" | radclient ...' commands."
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Import Packet Data</CardTitle>
          <CardDescription>
            Paste your raw packet data into the text area below and click "Parse Data".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={'Example: User-Name = "testuser"\\nFramed-IP-Address = 10.0.0.1\\nAcct-Status-Type = Start\\n...or paste full radclient command...'}
            rows={10}
            className="font-mono text-sm"
          />
          <Button onClick={handleParsePacketData} disabled={isLoading || !rawInput.trim()} className="w-full sm:w-auto">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Parse Packet Data
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Parsing Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {(parsedAttributes.length > 0 || radclientParams) && (
        <div className="grid md:grid-cols-2 gap-6">
          {parsedAttributes.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getFormatIcon(detectedFormat)}
                  Parsed Attributes 
                  {detectedFormat && <span className="text-sm font-normal text-muted-foreground">({detectedFormat})</span>}
                </CardTitle>
                <CardDescription>Review the attributes extracted from your input.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Attribute Name</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedAttributes.map((attr, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono break-all">{attr.name}</TableCell>
                        <TableCell className="font-mono break-all">{attr.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {radclientParams && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileTerminal className="h-5 w-5 text-primary" />
                  Detected Radclient Parameters
                </CardTitle>
                <CardDescription>Parameters extracted from the `radclient` command line.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Server:</strong> <span className="font-mono">{radclientParams.server}</span></p>
                {radclientParams.port && <p><strong>Port:</strong> <span className="font-mono">{radclientParams.port}</span></p>}
                <p><strong>Type:</strong> <span className="font-mono">{radclientParams.type}</span></p>
                <p><strong>Secret:</strong> <span className="font-mono">**********</span> (masked)</p>
                {radclientParams.options && <p><strong>Other Options:</strong> <span className="font-mono">{radclientParams.options}</span></p>}
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      {(parsedAttributes.length > 0 || radclientParams) && ( 
         <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
                <Button onClick={handleSaveToLibrary} disabled={isLoading}>
                    <Save className="mr-2 h-4 w-4" /> Save to Packet Library (Conceptual)
                </Button>
            </CardContent>
         </Card>
      )}

    </div>
  );
}
