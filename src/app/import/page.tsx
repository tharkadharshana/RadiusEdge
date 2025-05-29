
// src/app/import/page.tsx
"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, AlertTriangle, CheckCircle, FileJson, FileTerminal, FileCode, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface PacketAttribute {
  id: string;
  name: string;
  value: string;
}

export default function ImportPage() {
  const [rawInput, setRawInput] = useState('');
  const [parsedAttributes, setParsedAttributes] = useState<PacketAttribute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const { toast } = useToast();

  const handleParsePacketData = () => {
    setIsLoading(true);
    setParseError(null);
    setParsedAttributes([]);
    setDetectedFormat(null);

    try {
      const trimmedInput = rawInput.trim();
      if (!trimmedInput) {
        throw new Error("Input is empty.");
      }

      let attributes: PacketAttribute[] = [];
      // Try parsing as JSON first
      try {
        const jsonData = JSON.parse(trimmedInput);
        if (typeof jsonData === 'object' && jsonData !== null && !Array.isArray(jsonData)) {
          attributes = Object.entries(jsonData).map(([name, value], index) => ({
            id: `attr-json-${index}`, name, value: String(value),
          }));
          setDetectedFormat('json');
        } else if (Array.isArray(jsonData) && jsonData.every(item => typeof item.name === 'string' && typeof item.value !== 'undefined')) {
            attributes = jsonData.map((item, index) => ({
                id: `attr-json-arr-${index}`, name: item.name, value: String(item.value)
            }));
            setDetectedFormat('json_array_of_objects');
        } else {
          throw new Error("Not a recognized JSON structure for direct parsing.");
        }
      } catch (e) {
        // Fallback to flat file (name = value)
        const lines = trimmedInput.split('\n').filter(line => line.trim() !== '');
        if (lines.length > 0 && lines.every(line => line.includes('='))) {
          attributes = lines.map((line, index) => {
            const parts = line.split('=', 2);
            const name = parts[0].trim();
            let value = parts.length > 1 ? parts[1].trim() : '';
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            return { id: `attr-flat-${index}`, name, value };
          });
          setDetectedFormat('freeradius_flat');
        } else {
          if (attributes.length === 0) {
             throw new Error("Could not determine packet format. Please use JSON or 'name = value' pairs per line.");
          }
        }
      }
      
      if (attributes.length === 0) {
        throw new Error("No attributes parsed. Ensure format is JSON or 'name = value' pairs.");
      }

      setParsedAttributes(attributes);
      toast({
        title: "Data Parsed Successfully",
        description: `Detected format: ${detectedFormat || 'unknown'}. Parsed ${attributes.length} attributes.`,
        variant: "default",
      });

    } catch (e: any) {
      setParseError(e.message);
      setDetectedFormat(null);
      setParsedAttributes([]);
      toast({
        title: "Parsing Failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const getFormatIcon = (format: string | null) => {
    switch (format) {
      case 'json':
      case 'json_array_of_objects':
        return <FileJson className="h-5 w-5" />;
      case 'freeradius_flat':
        return <FileCode className="h-5 w-5" />;
      default:
        return null; 
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Packet Importer"
        description="Paste raw RADIUS data (name=value pairs) or JSON to import packets."
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Input Raw Packet Data</CardTitle>
          <CardDescription>
            The system will attempt to auto-detect the format (JSON or name=value pairs).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Example FreeRADIUS format:\nUser-Name = \"testuser\"\nNAS-IP-Address = 192.168.1.1\n\nExample JSON format:\n{ \"User-Name\": \"testuser\", \"NAS-IP-Address\": \"192.168.1.1\" }"
            rows={10}
            className="font-mono text-sm"
          />
          <Button onClick={handleParsePacketData} disabled={isLoading || !rawInput.trim()} className="mt-4 w-full sm:w-auto">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Parse Data
          </Button>
        </CardContent>
      </Card>

      {parseError && (
        <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Parsing Data</AlertTitle>
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {parsedAttributes.length > 0 && !parseError && (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                {getFormatIcon(detectedFormat)}
                Parsed Attributes ({parsedAttributes.length})
                </CardTitle>
            </div>
            {detectedFormat && <CardDescription>Detected format: <span className="font-semibold">{detectedFormat}</span></CardDescription>}
          </CardHeader>
          {parsedAttributes.length > 0 && (
            <CardContent>
                <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[40%]">Attribute Name</TableHead>
                        <TableHead>Value</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {parsedAttributes.map((attr) => (
                        <TableRow key={attr.id}>
                            <TableCell className="font-mono">{attr.name}</TableCell>
                            <TableCell className="font-mono whitespace-pre-wrap break-all">{attr.value}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
