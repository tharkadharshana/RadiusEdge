
"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, AlertTriangle, CheckCircle, FileJson, FileTerminal, FileCode, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ParsedAttribute {
  name: string;
  value: string;
  error?: string;
}

interface ParsedPacket {
  attributes: ParsedAttribute[];
  warnings: string[];
  formatDetected: string;
}

export default function ImportPage() {
  const [packetData, setPacketData] = useState('');
  const [parsedPacket, setParsedPacket] = useState<ParsedPacket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleParsePacketData = () => {
    if (!packetData.trim()) {
      toast({ title: "Input Empty", description: "Please paste packet data to import.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    // Simulate parsing delay and logic
    setTimeout(() => {
      let attributes: ParsedAttribute[] = [];
      let warnings: string[] = [];
      let formatDetected = "Unknown";

      if (packetData.includes("User-Name") && packetData.includes("=")) {
        formatDetected = "FreeRADIUS-style";
        attributes = packetData.split('\n').map(line => {
          const parts = line.split('=');
          if (parts.length === 2) {
            return { name: parts[0].trim(), value: parts[1].trim().replace(/"/g, '') };
          }
          return { name: line, value: "", error: "Invalid format" };
        }).filter(attr => attr.name);
      } else if (packetData.trim().startsWith("{") && packetData.trim().endsWith("}")) {
         try {
            const jsonData = JSON.parse(packetData);
            if (jsonData.attributes && Array.isArray(jsonData.attributes)) {
                formatDetected = "JSON";
                attributes = jsonData.attributes.map((attr: any) => ({
                    name: attr.name || "Unknown Attribute",
                    value: attr.value || ""
                }));
            } else {
                warnings.push("JSON detected, but 'attributes' array not found.");
            }
        } catch (e) {
            warnings.push("Failed to parse JSON data.");
        }
      } else if (packetData.toLowerCase().startsWith("0x")) {
        formatDetected = "Hex Dump (not supported by mock parser)";
        warnings.push("Hex dump parsing is not implemented in this demo.");
        attributes.push({name: "Raw Hex Data", value: packetData.substring(0, 50) + "..."});
      } else {
        warnings.push("Could not determine packet format.");
      }
      
      if(attributes.length === 0 && warnings.length === 0) {
        warnings.push("No attributes found or format not recognized.");
      }

      setParsedPacket({ attributes, warnings, formatDetected });
      setIsLoading(false);
      toast({ title: "Parsing Complete", description: `Detected format: ${formatDetected}. Check results below.`});
    }, 1000);
  };

  const getFormatIcon = (format: string) => {
    if (format === "FreeRADIUS-style") return <FileTerminal className="h-5 w-5 text-primary" />;
    if (format === "JSON") return <FileJson className="h-5 w-5 text-primary" />;
    if (format.includes("Hex")) return <FileCode className="h-5 w-5 text-primary" />;
    return null;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Packet Importer"
        description="Paste raw radclient commands, flat RADIUS packet files, or JSON to import packets."
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Import Packet Data</CardTitle>
          <CardDescription>
            Paste your packet data below. Supported formats include FreeRADIUS-style attributes (e.g., `User-Name = "test"`), JSON, or Hex dumps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={packetData}
            onChange={(e) => setPacketData(e.target.value)}
            placeholder="Example:\nUser-Name = \"testuser\"\nNAS-IP-Address = 10.0.0.1\nCalling-Station-Id = \"00-11-22-33-44-55\""
            rows={10}
            className="font-mono text-sm"
          />
          <Button onClick={handleParsePacketData} disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Parse and Import
          </Button>
        </CardContent>
      </Card>

      {parsedPacket && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getFormatIcon(parsedPacket.formatDetected)}
              Parsing Results 
            </CardTitle>
            <CardDescription>Detected Format: <span className="font-semibold text-primary">{parsedPacket.formatDetected}</span></CardDescription>
          </CardHeader>
          <CardContent>
            {parsedPacket.warnings.length > 0 && (
              <div className="mb-4 space-y-2 rounded-md border border-yellow-300 bg-yellow-50 p-4 dark:bg-yellow-900/30">
                <h3 className="font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Warnings:</h3>
                <ul className="list-disc pl-5 text-sm text-yellow-600 dark:text-yellow-400">
                  {parsedPacket.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsedPacket.attributes.length > 0 ? (
              <>
                <h3 className="mb-2 text-lg font-semibold">Parsed Attributes:</h3>
                <div className="max-h-96 overflow-y-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Attribute Name</th>
                        <th className="p-2 text-left">Value</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedPacket.attributes.map((attr, index) => (
                        <tr key={index} className="border-b last:border-b-0 hover:bg-muted/50">
                          <td className="p-2 font-medium">{attr.name}</td>
                          <td className="p-2 font-mono">{attr.value}</td>
                          <td className="p-2">
                            {attr.error ? (
                              <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{attr.error}</span>
                            ) : (
                              <span className="text-green-500 flex items-center gap-1"><CheckCircle className="h-4 w-4" />OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex gap-2">
                    <Button>Save to Packet Library</Button>
                    <Button variant="outline">Open in Editor</Button>
                </div>
              </>
            ) : (
              !parsedPacket.warnings.length && <p className="text-muted-foreground">No attributes were parsed. Please check the input format.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
