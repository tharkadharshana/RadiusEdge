
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
// import { useToast } from "@/hooks/use-toast"; // Commented out for diagnosis

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
  const [detectedFormatState, setDetectedFormatState] = useState<string | null>(null);
  // const { toast } = useToast(); // Commented out for diagnosis

  // Simplified function body for diagnosis
  function handleParsePacketData() {
    setIsLoading(true);
    setParseError(null);
    setParsedAttributes([]);
    setDetectedFormatState(null);
    // toast({ title: "Parsing Initiated (Simplified)", description: "Actual parsing logic is currently bypassed for diagnosis." });
    setTimeout(() => {
      setIsLoading(false);
    }, 100);
  }

  function getFormatIcon(format: string | null) {
    switch (format) {
      case 'json':
      case 'json_array_of_objects':
        return <FileJson className="h-5 w-5" />;
      case 'freeradius_flat':
        return <FileCode className="h-5 w-5" />;
      default:
        return null;
    }
  }

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
                {getFormatIcon(detectedFormatState)}
                Parsed Attributes ({parsedAttributes.length})
                </CardTitle>
            </div>
            {detectedFormatState && <CardDescription>Detected format: <span className="font-semibold">{detectedFormatState}</span></CardDescription>}
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
