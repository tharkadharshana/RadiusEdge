
"use client";

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit3, Copy, Trash2, Save, Share2, Search, X, Loader2, MoreHorizontal, Wand2, Settings2, CheckSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/hooks/use-toast";
import { parseRadiusAttributesFromString, ParseRadiusAttributesInput, ParseRadiusAttributesOutput } from '@/ai/flows/parse-radius-attributes-flow';
import { cn } from '@/lib/utils';

export interface RadiusAttribute {
  id: string;
  name: string;
  value: string;
}

export interface RadClientOptions {
  server?: string; // e.g., server_ip:port
  type?: 'auth' | 'acct' | 'status' | 'coa' | 'disconnect' | 'auto';
  secret?: string;
  useIPv4?: boolean;
  useIPv6?: boolean;
  blastChecks?: boolean;
  count?: number;
  raddbDirectory?: string;
  dictionaryDirectory?: string;
  inputFile?: string; // file[:file]
  printFileName?: boolean; // -F
  requestId?: number; // -i id
  requestsPerSecond?: number; // -n
  parallelRequests?: number; // -p
  protocol?: 'tcp' | 'udp'; // -P proto
  quietMode?: boolean; // -q
  retries?: number; // -r num_retries
  summaries?: boolean; // -s
  sharedSecretFile?: string; // -S
  timeout?: number; // -t
  debug?: boolean; // -x
}

export interface RadTestOptions {
  user?: string;
  password?: string;
  radiusServer?: string; // server_ip:port
  nasPortNumber?: number;
  secret?: string;
  ppphint?: boolean; // integer > 0 interpreted as true
  nasname?: string;
  raddbDirectory?: string; // -d
  protocol?: 'tcp' | 'udp'; // -P
  authType?: 'pap' | 'chap' | 'mschap' | 'eap-md5'; // -t
  debug?: boolean; // -x
  useIPv4?: boolean; // -4
  useIPv6?: boolean; // -6
}

export type ExecutionTool = 'radclient' | 'radtest';

export interface RadiusPacket {
  id: string;
  name: string;
  description: string;
  attributes: RadiusAttribute[];
  lastModified: string;
  tags: string[];
  executionTool?: ExecutionTool;
  toolOptions?: RadClientOptions | RadTestOptions;
}

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
  return debounced as (...args: Parameters<F>) => ReturnType<F>;
}


export default function PacketsPage() {
  const [packets, setPackets] = useState<RadiusPacket[]>([]);
  const [editingPacket, setEditingPacket] = useState<RadiusPacket | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pastedAttributesText, setPastedAttributesText] = useState('');
  const [isParsingAttributes, setIsParsingAttributes] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const [currentAttributeNameQuery, setCurrentAttributeNameQuery] = useState('');
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);


  const { toast } = useToast();

  const fetchPackets = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/packets');
      if (!response.ok) {
        throw new Error('Failed to fetch packets');
      }
      const data = await response.json();
      setPackets(data.map((p: any) => ({
        ...p,
        toolOptions: p.toolOptions ? (typeof p.toolOptions === 'string' ? JSON.parse(p.toolOptions) : p.toolOptions) : undefined
      })));
    } catch (error) {
      console.error("Error fetching packets:", error);
      toast({ title: "Error", description: "Could not fetch packets.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPackets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPackets = packets.filter(packet =>
    packet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (packet.description && packet.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (Array.isArray(packet.tags) && packet.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const handleEditPacket = (packet: RadiusPacket | null) => {
    setEditingPacket(packet ? JSON.parse(JSON.stringify(packet)) : null); // Deep copy
    setSuggestions([]);
    setActiveSuggestionIndex(null);
    setCurrentAttributeNameQuery('');
    setPastedAttributesText('');
  };

  const handleSavePacket = async () => {
    if (!editingPacket) return;
    setIsSaving(true);

    const packetDataToSave = {
      name: editingPacket.name,
      description: editingPacket.description,
      attributes: editingPacket.attributes,
      tags: editingPacket.tags,
      executionTool: editingPacket.executionTool,
      toolOptions: editingPacket.toolOptions,
    };

    const isNew = editingPacket.id === 'new';
    const url = isNew ? '/api/packets' : `/api/packets/${editingPacket.id}`;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packetDataToSave),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isNew ? 'create' : 'update'} packet`);
      }
      const savedPacket = await response.json();
      const processedSavedPacket = {
        ...savedPacket,
        toolOptions: savedPacket.toolOptions ? (typeof savedPacket.toolOptions === 'string' ? JSON.parse(savedPacket.toolOptions) : savedPacket.toolOptions) : undefined
      };


      if (isNew) {
        setPackets(prev => [processedSavedPacket, ...prev]);
      } else {
        setPackets(prev => prev.map(p => p.id === processedSavedPacket.id ? processedSavedPacket : p));
      }
      handleEditPacket(null);
      toast({ title: "Packet Saved", description: `Packet "${processedSavedPacket.name}" has been saved.` });
    } catch (error: any) {
      console.error(`Error saving packet:`, error);
      toast({ title: "Save Failed", description: error.message || "Could not save packet.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePacket = async (packetId: string) => {
    if (!window.confirm("Are you sure you want to delete this packet?")) return;

    try {
      const response = await fetch(`/api/packets/${packetId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete packet');
      }
      setPackets(prev => prev.filter(p => p.id !== packetId));
      toast({ title: "Packet Deleted", description: "Packet successfully deleted." });
    } catch (error: any) {
      console.error("Error deleting packet:", error);
      toast({ title: "Delete Failed", description: error.message || "Could not delete packet.", variant: "destructive" });
    }
  };

  // Debounced fetch for attribute suggestions
  const debouncedFetchAttributeSuggestions = useCallback(
    debounce(async (query: string, forAttributeIndex: number) => {
      if (!query.trim()) {
        setSuggestions([]);
        setActiveSuggestionIndex(forAttributeIndex);
        return;
      }
      setIsFetchingSuggestions(true);
      try {
        const response = await fetch(`/api/dictionaries/attributes/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch attribute suggestions');
        }
        const data: string[] = await response.json();
        setSuggestions(data);
        setActiveSuggestionIndex(forAttributeIndex);
      } catch (error) {
        console.error("Error fetching attribute suggestions:", error);
        setSuggestions([]);
        toast({ title: "Suggestion Error", description: "Could not fetch attribute suggestions.", variant: "destructive", duration: 2000 });
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 300),
    [toast]
  );

  const handleAttributeChange = (index: number, field: 'name' | 'value', value: string) => {
    if (editingPacket) {
      const updatedAttributes = [...editingPacket.attributes];
      updatedAttributes[index] = { ...updatedAttributes[index], [field]: value };
      setEditingPacket({ ...editingPacket, attributes: updatedAttributes });

      if (field === 'name') {
        setCurrentAttributeNameQuery(value); // Store the current query for the active input
        setActiveSuggestionIndex(index); // Set current input as active for suggestions
        if (value.trim()) {
          debouncedFetchAttributeSuggestions(value, index);
        } else {
          setSuggestions([]); // Clear suggestions if input is empty
        }
      }
    }
  };

  const selectSuggestion = (index: number, suggestion: string) => {
    if (editingPacket) {
      const updatedAttributes = [...editingPacket.attributes];
      updatedAttributes[index] = { ...updatedAttributes[index], name: suggestion };
      setEditingPacket({ ...editingPacket, attributes: updatedAttributes });
    }
    setSuggestions([]);
    setActiveSuggestionIndex(null);
    setCurrentAttributeNameQuery('');
  };


  const addAttribute = () => {
    if (editingPacket) {
      setEditingPacket({
        ...editingPacket,
        attributes: [...editingPacket.attributes, { id: `attr_client_${Date.now()}`, name: '', value: '' }],
      });
    }
  };

  const removeAttribute = (index: number) => {
    if (editingPacket) {
      const updatedAttributes = editingPacket.attributes.filter((_, i) => i !== index);
      setEditingPacket({ ...editingPacket, attributes: updatedAttributes });
    }
  };

  const createNewPacket = () => {
    handleEditPacket({
      id: 'new',
      name: 'New RADIUS Packet',
      description: '',
      attributes: [{ id: `attr_client_new_1`, name: 'User-Name', value: '' }],
      lastModified: new Date().toISOString(),
      tags: [],
      executionTool: 'radclient',
      toolOptions: {} as RadClientOptions, // Initialize with empty options for the default tool
    });
  };

  const handleParsePastedAttributesForPacket = async () => {
    if (!editingPacket || !pastedAttributesText.trim()) {
      toast({ title: "Nothing to parse", description: "Please paste attribute data into the text area.", variant: "destructive" });
      return;
    }
    setIsParsingAttributes(true);
    try {
      const input: ParseRadiusAttributesInput = { rawAttributesText: pastedAttributesText };
      const result: ParseRadiusAttributesOutput = await parseRadiusAttributesFromString(input);

      const newPacketAttributes: RadiusAttribute[] = result.parsedAttributes.map(pa => ({
        id: `attr_client_parsed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: pa.name,
        value: pa.value,
      }));

      setEditingPacket({ ...editingPacket, attributes: newPacketAttributes });
      setPastedAttributesText('');
      toast({ title: "Attributes Parsed", description: `${newPacketAttributes.length} attributes added/updated for the packet.` });
    } catch (error) {
      console.error("Error parsing attributes for packet:", error);
      toast({ title: "Parsing Failed", description: "Could not parse attributes from text. Please check the format.", variant: "destructive" });
    } finally {
      setIsParsingAttributes(false);
    }
  };

  const handleToolChange = (tool: ExecutionTool) => {
    if (editingPacket) {
      setEditingPacket({
        ...editingPacket,
        executionTool: tool,
        toolOptions: tool === 'radclient' ? ({} as RadClientOptions) : ({} as RadTestOptions)
      });
    }
  };
  
  const handleToolOptionChange = (optionKey: keyof RadClientOptions | keyof RadTestOptions, value: any) => {
    if (editingPacket && editingPacket.toolOptions) {
        let parsedValue = value;
        // Type coercion for number inputs
        const numericFieldsClient: (keyof RadClientOptions)[] = ['count', 'requestId', 'requestsPerSecond', 'parallelRequests', 'retries', 'timeout'];
        const numericFieldsTest: (keyof RadTestOptions)[] = ['nasPortNumber'];

        if (editingPacket.executionTool === 'radclient' && numericFieldsClient.includes(optionKey as keyof RadClientOptions)) {
            parsedValue = value === '' ? undefined : parseInt(value, 10);
            if (isNaN(parsedValue as number)) parsedValue = undefined; // Or handle as error
        } else if (editingPacket.executionTool === 'radtest' && numericFieldsTest.includes(optionKey as keyof RadTestOptions)) {
            parsedValue = value === '' ? undefined : parseInt(value, 10);
             if (isNaN(parsedValue as number)) parsedValue = undefined;
        }


      setEditingPacket({
        ...editingPacket,
        toolOptions: {
          ...editingPacket.toolOptions,
          [optionKey]: parsedValue,
        },
      });
    }
  };

  const handleToolBooleanOptionChange = (optionKey: keyof RadClientOptions | keyof RadTestOptions, checked: boolean) => {
     if (editingPacket && editingPacket.toolOptions) {
      setEditingPacket({
        ...editingPacket,
        toolOptions: {
          ...editingPacket.toolOptions,
          [optionKey]: checked,
        },
      });
    }
  };

  const handleDuplicatePacket = (packetId: string) => {
    const packetToDuplicate = packets.find(p => p.id === packetId);
    if (packetToDuplicate) {
      const newPacket: RadiusPacket = {
        ...JSON.parse(JSON.stringify(packetToDuplicate)), // Deep copy
        id: 'new', // Mark as new
        name: `${packetToDuplicate.name} (Copy)`,
        lastModified: new Date().toISOString(),
      };
      handleEditPacket(newPacket);
      toast({ title: "Packet Duplicated", description: `"${packetToDuplicate.name}" duplicated. Save to confirm.` });
    } else {
      toast({ title: "Error", description: "Packet not found for duplication.", variant: "destructive" });
    }
  };
  
  const handleExportPacket = (packetId: string) => {
    const packetToExport = packets.find(p => p.id === packetId);
    if (packetToExport) {
      const packetJson = JSON.stringify(packetToExport, null, 2);
      const blob = new Blob([packetJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = packetToExport.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      a.download = `radiusedge_packet_${safeName || 'untitled'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Packet Exported", description: `Packet "${packetToExport.name}" has been prepared for download.` });
    } else {
      toast({ title: "Error", description: "Packet not found for export.", variant: "destructive" });
    }
  };


  return (
    <div className="space-y-8">
      <PageHeader
        title="Packet Editor & Library"
        description="Manage, create, and edit your RADIUS packets and their execution tool options."
        actions={
          <Button onClick={createNewPacket} disabled={isLoading || isSaving}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Packet
          </Button>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Packet Library</CardTitle>
          <div className="flex items-center gap-2 pt-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search packets by name, description, or tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading packets...</p>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPackets.map((packet) => (
                <TableRow key={packet.id}>
                  <TableCell className="font-medium">{packet.name}</TableCell>
                  <TableCell><Badge variant="outline">{packet.executionTool || 'N/A'}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{packet.description}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {packet.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>{new Date(packet.lastModified).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isSaving}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditPacket(packet)} disabled={isSaving}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicatePacket(packet.id)} disabled={isSaving}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportPacket(packet.id)} disabled={isSaving}>
                          <Share2 className="mr-2 h-4 w-4" /> Export
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeletePacket(packet.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={isSaving}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
               {!isLoading && filteredPackets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No packets found. Try adjusting your search or create a new packet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading..." : `Showing ${filteredPackets.length} of ${packets.length} packets.`}
            </p>
         </CardFooter>
      </Card>

      {/* Packet Editor Dialog */}
      <Dialog open={!!editingPacket} onOpenChange={(isOpen) => !isOpen && handleEditPacket(null)}>
        <DialogContent className="max-w-3xl"> {/* Increased width */}
          <DialogHeader>
            <DialogTitle>{editingPacket?.id === 'new' ? 'Create New Packet' : `Edit Packet: ${editingPacket?.name}`}</DialogTitle>
            <DialogDescription>
              Modify packet details, attributes, and select execution tool options.
            </DialogDescription>
          </DialogHeader>
          {editingPacket && (
          <ScrollArea className="max-h-[75vh] pr-6">
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="packet-name">Packet Name</Label>
                <Input
                  id="packet-name"
                  value={editingPacket.name}
                  onChange={(e) => setEditingPacket({ ...editingPacket, name: e.target.value })}
                  disabled={isSaving || isParsingAttributes}
                />
              </div>
              <div>
                <Label htmlFor="packet-description">Description</Label>
                <Textarea
                  id="packet-description"
                  value={editingPacket.description}
                  onChange={(e) => setEditingPacket({ ...editingPacket, description: e.target.value })}
                  disabled={isSaving || isParsingAttributes}
                />
              </div>
              <div>
                <Label htmlFor="packet-tags">Tags (comma-separated)</Label>
                <Input
                  id="packet-tags"
                  value={editingPacket.tags.join(', ')}
                  onChange={(e) => setEditingPacket({ ...editingPacket, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
                  placeholder="e.g., Auth, 3GPP, Test"
                  disabled={isSaving || isParsingAttributes}
                />
              </div>

              <h3 className="text-lg font-semibold pt-2 flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /> Execution Tool Options</h3>
              <div>
                <Label htmlFor="execution-tool">Tool</Label>
                <Select value={editingPacket.executionTool || 'radclient'} onValueChange={(value) => handleToolChange(value as ExecutionTool)}>
                  <SelectTrigger id="execution-tool"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="radclient">radclient</SelectItem>
                    <SelectItem value="radtest">radtest</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingPacket.executionTool === 'radclient' && editingPacket.toolOptions && (
                <Card className="p-4 bg-muted/30">
                  <CardHeader className="p-0 pb-2 mb-2 border-b"><CardTitle className="text-md">Radclient Options</CardTitle></CardHeader>
                  <CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div><Label>Server[:Port]</Label><Input value={(editingPacket.toolOptions as RadClientOptions).server || ''} onChange={e => handleToolOptionChange('server', e.target.value)} placeholder="e.g., 127.0.0.1:1812" /></div>
                    <div><Label>Type</Label>
                      <Select value={(editingPacket.toolOptions as RadClientOptions).type || 'auth'} onValueChange={val => handleToolOptionChange('type', val)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auth">auth (Access-Request)</SelectItem>
                          <SelectItem value="acct">acct (Accounting-Request)</SelectItem>
                          <SelectItem value="status">status (Status-Server)</SelectItem>
                          <SelectItem value="coa">coa (CoA-Request)</SelectItem>
                          <SelectItem value="disconnect">disconnect (Disconnect-Request)</SelectItem>
                          <SelectItem value="auto">auto (from Packet-Type attribute)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Shared Secret</Label><Input type="password" value={(editingPacket.toolOptions as RadClientOptions).secret || ''} onChange={e => handleToolOptionChange('secret', e.target.value)} placeholder="Packet-specific secret" /></div>
                    <div><Label>Count</Label><Input type="number" value={(editingPacket.toolOptions as RadClientOptions).count || ''} onChange={e => handleToolOptionChange('count', e.target.value)} placeholder="1" /></div>
                    <div><Label>Retries</Label><Input type="number" value={(editingPacket.toolOptions as RadClientOptions).retries || ''} onChange={e => handleToolOptionChange('retries', e.target.value)} placeholder="10" /></div>
                    <div><Label>Timeout (sec)</Label><Input type="number" value={(editingPacket.toolOptions as RadClientOptions).timeout || ''} onChange={e => handleToolOptionChange('timeout', e.target.value)} placeholder="3" /></div>
                    <div><Label>Requests/sec</Label><Input type="number" value={(editingPacket.toolOptions as RadClientOptions).requestsPerSecond || ''} onChange={e => handleToolOptionChange('requestsPerSecond', e.target.value)} placeholder="Optional" /></div>
                    <div><Label>Parallel Requests</Label><Input type="number" value={(editingPacket.toolOptions as RadClientOptions).parallelRequests || ''} onChange={e => handleToolOptionChange('parallelRequests', e.target.value)} placeholder="Optional" /></div>
                    <div><Label>Request ID</Label><Input type="number" value={(editingPacket.toolOptions as RadClientOptions).requestId || ''} onChange={e => handleToolOptionChange('requestId', e.target.value)} placeholder="Optional" /></div>
                    <div><Label>Protocol</Label>
                      <Select value={(editingPacket.toolOptions as RadClientOptions).protocol || 'udp'} onValueChange={val => handleToolOptionChange('protocol', val)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="udp">udp</SelectItem><SelectItem value="tcp">tcp</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2"><Checkbox id="rc-ipv4" checked={(editingPacket.toolOptions as RadClientOptions).useIPv4} onCheckedChange={val => handleToolBooleanOptionChange('useIPv4', !!val)} /><Label htmlFor="rc-ipv4">Use IPv4 (-4)</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="rc-ipv6" checked={(editingPacket.toolOptions as RadClientOptions).useIPv6} onCheckedChange={val => handleToolBooleanOptionChange('useIPv6', !!val)} /><Label htmlFor="rc-ipv6">Use IPv6 (-6)</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="rc-blast" checked={(editingPacket.toolOptions as RadClientOptions).blastChecks} onCheckedChange={val => handleToolBooleanOptionChange('blastChecks', !!val)} /><Label htmlFor="rc-blast">Blast RADIUS Checks (-b)</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="rc-printfile" checked={(editingPacket.toolOptions as RadClientOptions).printFileName} onCheckedChange={val => handleToolBooleanOptionChange('printFileName', !!val)} /><Label htmlFor="rc-printfile">Print File Name (-F)</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="rc-quiet" checked={(editingPacket.toolOptions as RadClientOptions).quietMode} onCheckedChange={val => handleToolBooleanOptionChange('quietMode', !!val)} /><Label htmlFor="rc-quiet">Quiet Mode (-q)</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="rc-summaries" checked={(editingPacket.toolOptions as RadClientOptions).summaries} onCheckedChange={val => handleToolBooleanOptionChange('summaries', !!val)} /><Label htmlFor="rc-summaries">Summaries (-s)</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="rc-debug" checked={(editingPacket.toolOptions as RadClientOptions).debug} onCheckedChange={val => handleToolBooleanOptionChange('debug', !!val)} /><Label htmlFor="rc-debug">Debug (-x)</Label></div>
                    
                    <div className="md:col-span-2 space-y-1">
                      <Label>Raddb Directory (-d)</Label><Input value={(editingPacket.toolOptions as RadClientOptions).raddbDirectory || ''} onChange={e => handleToolOptionChange('raddbDirectory', e.target.value)} placeholder="/etc/raddb" />
                      <Label>Dictionary Directory (-D)</Label><Input value={(editingPacket.toolOptions as RadClientOptions).dictionaryDirectory || ''} onChange={e => handleToolOptionChange('dictionaryDirectory', e.target.value)} placeholder="/usr/share/freeradius" />
                      <Label>Input File (-f)</Label><Input value={(editingPacket.toolOptions as RadClientOptions).inputFile || ''} onChange={e => handleToolOptionChange('inputFile', e.target.value)} placeholder="path/to/file or file1:file2" />
                      <Label>Shared Secret File (-S)</Label><Input value={(editingPacket.toolOptions as RadClientOptions).sharedSecretFile || ''} onChange={e => handleToolOptionChange('sharedSecretFile', e.target.value)} placeholder="path/to/secretfile" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {editingPacket.executionTool === 'radtest' && editingPacket.toolOptions && (
                 <Card className="p-4 bg-muted/30">
                  <CardHeader className="p-0 pb-2 mb-2 border-b"><CardTitle className="text-md">Radtest Options</CardTitle></CardHeader>
                  <CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div><Label>User</Label><Input value={(editingPacket.toolOptions as RadTestOptions).user || ''} onChange={e => handleToolOptionChange('user', e.target.value)} /></div>
                    <div><Label>Password</Label><Input type="password" value={(editingPacket.toolOptions as RadTestOptions).password || ''} onChange={e => handleToolOptionChange('password', e.target.value)} /></div>
                    <div><Label>RADIUS Server[:Port]</Label><Input value={(editingPacket.toolOptions as RadTestOptions).radiusServer || ''} onChange={e => handleToolOptionChange('radiusServer', e.target.value)} /></div>
                    <div><Label>NAS Port Number</Label><Input type="number" value={(editingPacket.toolOptions as RadTestOptions).nasPortNumber || ''} onChange={e => handleToolOptionChange('nasPortNumber', e.target.value)} placeholder="10" /></div>
                    <div><Label>Shared Secret</Label><Input type="password" value={(editingPacket.toolOptions as RadTestOptions).secret || ''} onChange={e => handleToolOptionChange('secret', e.target.value)} /></div>
                    <div><Label>NAS Name</Label><Input value={(editingPacket.toolOptions as RadTestOptions).nasname || ''} onChange={e => handleToolOptionChange('nasname', e.target.value)} placeholder="Local hostname if blank" /></div>
                    <div><Label>Auth Type (-t)</Label>
                        <Select value={(editingPacket.toolOptions as RadTestOptions).authType || 'pap'} onValueChange={val => handleToolOptionChange('authType', val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                            <SelectItem value="pap">pap</SelectItem>
                            <SelectItem value="chap">chap</SelectItem>
                            <SelectItem value="mschap">mschap</SelectItem>
                            <SelectItem value="eap-md5">eap-md5</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label>Protocol (-P)</Label>
                      <Select value={(editingPacket.toolOptions as RadTestOptions).protocol || 'udp'} onValueChange={val => handleToolOptionChange('protocol', val)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="udp">udp</SelectItem><SelectItem value="tcp">tcp</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2"><Checkbox id="rt-ppphint" checked={(editingPacket.toolOptions as RadTestOptions).ppphint} onCheckedChange={val => handleToolBooleanOptionChange('ppphint', !!val)} /><Label htmlFor="rt-ppphint">PPP Hint (Framed-Protocol=PPP)</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="rt-debug" checked={(editingPacket.toolOptions as RadTestOptions).debug} onCheckedChange={val => handleToolBooleanOptionChange('debug', !!val)} /><Label htmlFor="rt-debug">Debug (-x)</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="rt-ipv4" checked={(editingPacket.toolOptions as RadTestOptions).useIPv4} onCheckedChange={val => handleToolBooleanOptionChange('useIPv4', !!val)} /><Label htmlFor="rt-ipv4">Use NAS-IP-Address (-4)</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="rt-ipv6" checked={(editingPacket.toolOptions as RadTestOptions).useIPv6} onCheckedChange={val => handleToolBooleanOptionChange('useIPv6', !!val)} /><Label htmlFor="rt-ipv6">Use NAS-IPv6-Address (-6)</Label></div>
                    <div className="md:col-span-2 space-y-1">
                        <Label>Raddb Directory (-d)</Label><Input value={(editingPacket.toolOptions as RadTestOptions).raddbDirectory || ''} onChange={e => handleToolOptionChange('raddbDirectory', e.target.value)} placeholder="/etc/raddb" />
                    </div>
                  </CardContent>
                </Card>
              )}


              <h3 className="text-lg font-semibold pt-4">Attributes</h3>
              <div className="space-y-2 pt-2 border p-3 rounded-md bg-muted/20">
                <Label className="font-medium">Paste Attributes from Text:</Label>
                <Textarea
                  value={pastedAttributesText}
                  onChange={(e) => setPastedAttributesText(e.target.value)}
                  placeholder={'User-Name = "testuser"\nFramed-IP-Address = 10.0.0.1\nAcct-Status-Type = Start'}
                  rows={4}
                  className="font-mono text-xs"
                  disabled={isSaving || isParsingAttributes}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleParsePastedAttributesForPacket}
                  disabled={isSaving || isParsingAttributes || !pastedAttributesText.trim()}
                  className="w-full"
                >
                  {isParsingAttributes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                  Parse from Text & Add/Replace
                </Button>
              </div>

              {editingPacket.attributes.map((attr, index) => (
                <div key={attr.id || index} className="flex items-end gap-2 p-3 border rounded-md bg-muted/30 relative">
                  <div className="flex-1">
                    <Label htmlFor={`attr-name-${index}`}>Name</Label>
                    <Input
                      id={`attr-name-${index}`}
                      value={attr.name}
                      onChange={(e) => handleAttributeChange(index, 'name', e.target.value)}
                      onFocus={() => {
                        setActiveSuggestionIndex(index);
                        if(attr.name.trim()){
                            debouncedFetchAttributeSuggestions(attr.name, index);
                        } else {
                            setSuggestions([]);
                        }
                      }}
                      placeholder="e.g., User-Name"
                      className="font-mono"
                      disabled={isSaving || isParsingAttributes}
                      autoComplete="off"
                    />
                     {activeSuggestionIndex === index && currentAttributeNameQuery === attr.name && suggestions.length > 0 && (
                      <Card className="absolute z-10 mt-1 w-full shadow-lg max-h-40 overflow-y-auto border">
                        <CardContent className="p-1">
                          {isFetchingSuggestions ? (
                            <div className="p-2 text-center text-sm text-muted-foreground">Loading...</div>
                          ) : (
                            suggestions.map(s => (
                              <Button
                                key={s}
                                variant="ghost"
                                className="w-full justify-start h-8 px-2 text-sm"
                                onClick={() => selectSuggestion(index, s)}
                              >
                                {s}
                              </Button>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  <div className="flex-1">
                    <Label htmlFor={`attr-value-${index}`}>Value</Label>
                    <Input
                      id={`attr-value-${index}`}
                      value={attr.value}
                      onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                      placeholder="e.g., testuser"
                      className="font-mono"
                      disabled={isSaving || isParsingAttributes}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeAttribute(index)} className="text-destructive hover:text-destructive" disabled={isSaving || isParsingAttributes}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={addAttribute} size="sm" disabled={isSaving || isParsingAttributes}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Attribute Manually
              </Button>
            </div>
          </ScrollArea>
          )}
          <DialogFooter className="mt-auto pt-4 border-t flex-shrink-0">
            <DialogClose asChild><Button variant="outline" disabled={isSaving || isParsingAttributes}>Cancel</Button></DialogClose>
            <Button onClick={handleSavePacket} disabled={isSaving || isParsingAttributes}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Packet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    