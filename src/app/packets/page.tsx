
"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit3, Copy, Trash2, Save, Share2, Eye, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"

interface RadiusAttribute {
  id: string;
  name: string;
  value: string;
}

interface RadiusPacket {
  id: string;
  name: string;
  description: string;
  attributes: RadiusAttribute[];
  lastModified: string;
  tags: string[];
}

const initialPackets: RadiusPacket[] = [
  { id: 'pkt1', name: '3GPP Access-Request', description: 'Standard 3GPP authentication request.', attributes: [{id: 'attr1', name: 'User-Name', value: 'imsi12345'}, {id: 'attr2', name: 'NAS-Port-Type', value: 'Wireless-IEEE-802.11'}], lastModified: '2024-07-15', tags: ['3GPP', 'Auth'] },
  { id: 'pkt2', name: 'Cisco VoIP Accounting Start', description: 'Accounting start packet for Cisco VoIP gateway.', attributes: [{id: 'attr3', name: 'Acct-Status-Type', value: 'Start'}, {id: 'attr4', name: 'Cisco-AVPair', value: 'h323-call-id=...'}], lastModified: '2024-07-10', tags: ['Cisco', 'Accounting', 'VoIP'] },
  { id: 'pkt3', name: 'Generic EAP-TLS Auth', description: 'Basic EAP-TLS auth request.', attributes: [{id: 'attr5', name: 'EAP-Message', value: '...'}, {id: 'attr6', name: 'Message-Authenticator', value: '...'}], lastModified: '2024-06-20', tags: ['EAP', 'Auth'] },
];

// Mock dictionary for autocomplete
const dictionaryAttributes = [
  "User-Name", "User-Password", "NAS-IP-Address", "NAS-Port", "Service-Type", 
  "Framed-IP-Address", "Calling-Station-Id", "Called-Station-Id", "Acct-Status-Type", 
  "Acct-Session-Id", "NAS-Identifier", "Vendor-Specific", "EAP-Message", "Message-Authenticator"
];

export default function PacketsPage() {
  const [packets, setPackets] = useState<RadiusPacket[]>(initialPackets);
  const [editingPacket, setEditingPacket] = useState<RadiusPacket | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [attributeSearch, setAttributeSearch] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const filteredPackets = packets.filter(packet =>
    packet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    packet.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    packet.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleEditPacket = (packet: RadiusPacket | null) => {
    setEditingPacket(packet ? { ...packet, attributes: [...packet.attributes.map(a => ({...a}))] } : null);
    setAttributeSearch('');
    setSuggestions([]);
  };

  const handleSavePacket = () => {
    if (editingPacket) {
      if (editingPacket.id === 'new') { // New packet
        setPackets(prev => [...prev, { ...editingPacket, id: `pkt${Date.now()}`, lastModified: new Date().toISOString().split('T')[0] }]);
      } else { // Existing packet
        setPackets(prev => prev.map(p => p.id === editingPacket.id ? { ...editingPacket, lastModified: new Date().toISOString().split('T')[0] } : p));
      }
      handleEditPacket(null); // Close dialog
    }
  };

  const handleAttributeChange = (index: number, field: 'name' | 'value', value: string) => {
    if (editingPacket) {
      const updatedAttributes = [...editingPacket.attributes];
      updatedAttributes[index] = { ...updatedAttributes[index], [field]: value };
      setEditingPacket({ ...editingPacket, attributes: updatedAttributes });

      if (field === 'name') {
        setAttributeSearch(value);
        if (value) {
          setSuggestions(dictionaryAttributes.filter(attr => attr.toLowerCase().includes(value.toLowerCase())));
        } else {
          setSuggestions([]);
        }
      }
    }
  };
  
  const selectSuggestion = (index: number, suggestion: string) => {
    handleAttributeChange(index, 'name', suggestion);
    setSuggestions([]);
    setAttributeSearch('');
  };

  const addAttribute = () => {
    if (editingPacket) {
      setEditingPacket({
        ...editingPacket,
        attributes: [...editingPacket.attributes, { id: `attr${Date.now()}`, name: '', value: '' }],
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
      attributes: [{ id: 'attr_new_1', name: 'User-Name', value: '' }],
      lastModified: new Date().toISOString().split('T')[0],
      tags: [],
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Packet Editor & Library"
        description="Manage, create, and edit your RADIUS packets."
        actions={
          <Button onClick={createNewPacket}>
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
            />
          </div>
        </CardHeader>
        <CardContent>
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
                  <TableCell>{packet.lastModified}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditPacket(packet)}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share2 className="mr-2 h-4 w-4" /> Export
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
               {filteredPackets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No packets found. Try adjusting your search or create a new packet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Packet Editor Dialog */}
      <Dialog open={!!editingPacket} onOpenChange={(isOpen) => !isOpen && handleEditPacket(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPacket?.id === 'new' ? 'Create New Packet' : `Edit Packet: ${editingPacket?.name}`}</DialogTitle>
            <DialogDescription>
              Modify packet details and attributes. Use autocomplete for attribute names.
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
                />
              </div>
              <div>
                <Label htmlFor="packet-description">Description</Label>
                <Textarea
                  id="packet-description"
                  value={editingPacket.description}
                  onChange={(e) => setEditingPacket({ ...editingPacket, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="packet-tags">Tags (comma-separated)</Label>
                <Input
                  id="packet-tags"
                  value={editingPacket.tags.join(', ')}
                  onChange={(e) => setEditingPacket({ ...editingPacket, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
                  placeholder="e.g., Auth, 3GPP, Test"
                />
              </div>

              <h3 className="text-lg font-semibold pt-2">Attributes</h3>
              {editingPacket.attributes.map((attr, index) => (
                <div key={attr.id || index} className="flex items-end gap-2 p-3 border rounded-md bg-muted/30 relative">
                  <div className="flex-1">
                    <Label htmlFor={`attr-name-${index}`}>Name</Label>
                    <Input
                      id={`attr-name-${index}`}
                      value={attr.name}
                      onChange={(e) => handleAttributeChange(index, 'name', e.target.value)}
                      placeholder="e.g., User-Name"
                      className="font-mono"
                    />
                     {attributeSearch === attr.name && suggestions.length > 0 && (
                      <Card className="absolute z-10 mt-1 w-full shadow-lg max-h-40 overflow-y-auto">
                        <CardContent className="p-1">
                          {suggestions.map(s => (
                            <Button
                              key={s}
                              variant="ghost"
                              className="w-full justify-start h-8 px-2"
                              onClick={() => selectSuggestion(index, s)}
                            >
                              {s}
                            </Button>
                          ))}
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
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeAttribute(index)} className="text-destructive hover:text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={addAttribute} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Attribute
              </Button>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSavePacket}><Save className="mr-2 h-4 w-4" /> Save Packet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
