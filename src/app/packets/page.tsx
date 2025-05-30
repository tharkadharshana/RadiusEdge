
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit3, Copy, Trash2, Save, Share2, Eye, Search, X, Loader2, MoreHorizontal, Wand2 } from 'lucide-react';
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
import { useToast } from "@/hooks/use-toast";
import { parseRadiusAttributesFromString, ParseRadiusAttributesInput, ParseRadiusAttributesOutput } from '@/ai/flows/parse-radius-attributes-flow';

export interface RadiusAttribute {
  id: string;
  name: string;
  value: string;
}

export interface RadiusPacket {
  id: string;
  name: string;
  description: string;
  attributes: RadiusAttribute[];
  lastModified: string;
  tags: string[];
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
      setPackets(data);
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

      if (isNew) {
        setPackets(prev => [savedPacket, ...prev]);
      } else {
        setPackets(prev => prev.map(p => p.id === savedPacket.id ? savedPacket : p));
      }
      handleEditPacket(null);
      toast({ title: "Packet Saved", description: `Packet "${savedPacket.name}" has been saved.` });
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


  return (
    <div className="space-y-8">
      <PageHeader
        title="Packet Editor & Library"
        description="Manage, create, and edit your RADIUS packets."
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
                        <DropdownMenuItem disabled> {/* Functionality not implemented */}
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled> {/* Functionality not implemented */}
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
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPacket?.id === 'new' ? 'Create New Packet' : `Edit Packet: ${editingPacket?.name}`}</DialogTitle>
            <DialogDescription>
              Modify packet details and attributes. Use autocomplete for attribute names or paste a block of text.
            </DialogDescription>
          </DialogHeader>
          {editingPacket && (
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
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

              <h3 className="text-lg font-semibold pt-2">Attributes</h3>
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
                        // Optionally, if current attr.name is not empty, trigger initial suggestion fetch
                        if(attr.name.trim()){
                            debouncedFetchAttributeSuggestions(attr.name, index);
                        } else {
                            setSuggestions([]); // Clear if name is empty on focus
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
          )}
          <DialogFooter>
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

