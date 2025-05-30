
"use client";

import { useState, useEffect, useRef } from 'react'; // Added useEffect and useRef
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { UploadCloud, Eye, Trash2, PlusCircle, Info, Loader2 } from 'lucide-react'; // Added Loader2
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast"; // Added useToast
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from 'lucide-react';


export interface Dictionary { // Exporting for API usage
  id: string;
  name: string;
  source: string; 
  attributes: number; // This will remain a mock count from client-side for now
  vendorCodes: number; // This will remain a mock count from client-side for now
  isActive: boolean;
  lastUpdated: string;
}

interface Attribute { // Mocked attribute structure for display
  id: string;
  name: string;
  code: string;
  type: string;
  vendor: string;
  description: string;
  enumValues?: string[];
  examples?: string;
}

// Mock example attributes will still be used for the view details dialog
const exampleAttributes: Attribute[] = [
    { id: 'attr1', name: 'User-Name', code: '1', type: 'string', vendor: 'Standard', description: 'The username being authenticated.', examples: "User-Name = \"alice\"" },
    { id: 'attr2', name: 'NAS-IP-Address', code: '4', type: 'ipaddr', vendor: 'Standard', description: 'The IP address of the NAS initiating the request.', examples: "NAS-IP-Address = 192.168.1.1" },
    { id: 'attr3', name: '3GPP-IMSI', code: '1', type: 'string', vendor: '3GPP (10415)', description: 'International Mobile Subscriber Identity.', examples: "Vendor-Specific = 3GPP, 3GPP-IMSI = \"123456789012345\"" },
];


export default function DictionariesPage() {
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [selectedDictionary, setSelectedDictionary] = useState<Dictionary | null>(null);
  const [selectedAttribute, setSelectedAttribute] = useState<Attribute | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // For import/toggle operations
  
  const [newDictName, setNewDictName] = useState('');
  const [newDictSource, setNewDictSource] = useState('');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const { toast } = useToast();

  const fetchDictionaries = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dictionaries');
      if (!response.ok) throw new Error('Failed to fetch dictionaries');
      const data = await response.json();
      setDictionaries(data.map((d: any) => ({ ...d, attributes: 0, vendorCodes: 0 }))); // Add mock counts
    } catch (error) {
      console.error("Error fetching dictionaries:", error);
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDictionaries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDictionaryActive = async (id: string, currentStatus: boolean) => {
    // Optimistically update UI
    setDictionaries(prev =>
      prev.map(dict =>
        dict.id === id ? { ...dict, isActive: !currentStatus } : dict
      )
    );

    try {
      const response = await fetch(`/api/dictionaries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update dictionary status');
      }
      const updatedDict = await response.json();
      // Confirm update with server response (or re-fetch)
      setDictionaries(prev => prev.map(d => d.id === updatedDict.id ? { ...updatedDict, attributes: d.attributes, vendorCodes: d.vendorCodes } : d));
      toast({ title: "Success", description: `Dictionary "${updatedDict.name}" status updated.` });
    } catch (error) {
      console.error("Error toggling dictionary status:", error);
      toast({ title: "Update Failed", description: (error as Error).message, variant: "destructive" });
      // Revert optimistic update
      setDictionaries(prev =>
        prev.map(dict =>
          dict.id === id ? { ...dict, isActive: currentStatus } : dict
        )
      );
    }
  };

  const handleImportDictionary = async () => {
    if (!newDictName || !newDictSource) {
      toast({ title: "Missing Fields", description: "Please provide a name and source for the dictionary.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/dictionaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDictName, source: newDictSource }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to import dictionary');
      }
      const newDictionary = await response.json();
      setDictionaries(prev => [ { ...newDictionary, attributes: 0, vendorCodes: 0 }, ...prev]);
      toast({ title: "Dictionary Imported", description: `Dictionary "${newDictionary.name}" metadata added.` });
      setNewDictName('');
      setNewDictSource('');
      setIsImportDialogOpen(false);
    } catch (error) {
      console.error("Error importing dictionary:", error);
      toast({ title: "Import Failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteDictionary = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the dictionary "${name}"?`)) return;
    
    setIsSaving(true); // Use generic saving state or a specific deleting state
    try {
      const response = await fetch(`/api/dictionaries/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete dictionary');
      }
      setDictionaries(prev => prev.filter(d => d.id !== id));
      toast({ title: "Dictionary Deleted", description: `Dictionary "${name}" metadata removed.` });
    } catch (error) {
      console.error("Error deleting dictionary:", error);
      toast({ title: "Delete Failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };


  const handleViewDictionary = (dictionary: Dictionary) => {
    setSelectedDictionary(dictionary);
    // In a real app, fetch actual attributes for this dictionary
  };
  
  const handleViewAttribute = (attribute: Attribute) => {
    setSelectedAttribute(attribute);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="RADIUS Dictionary Manager"
        description="Import, manage, and inspect RADIUS dictionaries and Vendor-Specific Attributes (VSAs)."
        actions={
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button><UploadCloud className="mr-2 h-4 w-4" /> Import Dictionary (Metadata)</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import New Dictionary (Metadata)</DialogTitle>
                <DialogDescription>
                  Provide a name and source for the dictionary. Full dictionary file parsing is conceptual for this prototype.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="dict-name">Dictionary Name</Label>
                  <Input id="dict-name" value={newDictName} onChange={(e) => setNewDictName(e.target.value)} placeholder="e.g., My Custom VSAs" disabled={isSaving} />
                </div>
                <div>
                  <Label htmlFor="dict-source">Source / Vendor</Label>
                  <Input id="dict-source" value={newDictSource} onChange={(e) => setNewDictSource(e.target.value)} placeholder="e.g., Custom, AcmeCorp" disabled={isSaving} />
                </div>
                {/* Conceptual file input - not functional for actual parsing in this step */}
                {/* <div>
                  <Label htmlFor="dict-file">Dictionary File (Conceptual)</Label>
                  <Input id="dict-file" type="file" disabled />
                  <p className="text-xs text-muted-foreground mt-1">Actual file parsing not implemented in this prototype.</p>
                </div> */}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsImportDialogOpen(false)} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleImportDictionary} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Available Dictionaries</CardTitle>
          <CardDescription>Enable or disable dictionaries for use in scenarios and packet editing.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading dictionaries...</p>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-center">Attributes (Mock)</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dictionaries.map((dict) => (
                <TableRow key={dict.id}>
                  <TableCell className="font-medium">{dict.name}</TableCell>
                  <TableCell><Badge variant={dict.source.toLowerCase() === 'standard' || dict.source.toLowerCase() === '3gpp' ? 'outline' : 'secondary'}>{dict.source}</Badge></TableCell>
                  <TableCell className="text-center">{dict.attributes}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={dict.isActive}
                      onCheckedChange={() => toggleDictionaryActive(dict.id, dict.isActive)}
                      aria-label={`Toggle ${dict.name} dictionary`}
                      disabled={isSaving}
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isSaving}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                         <DropdownMenuItem onClick={() => handleViewDictionary(dict)} disabled={isSaving}>
                           <Eye className="mr-2 h-4 w-4" /> View Attributes (Mock)
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => handleDeleteDictionary(dict.id, dict.name)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={isSaving}>
                           <Trash2 className="mr-2 h-4 w-4" /> Delete
                         </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
               {!isLoading && dictionaries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No dictionaries found. Try importing dictionary metadata.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading..." : `Showing ${dictionaries.length} dictionary metadata entries.`}
            </p>
         </CardFooter>
      </Card>

      {/* Dialog for Viewing Dictionary Attributes (Still using mock data) */}
      <Dialog open={!!selectedDictionary} onOpenChange={(isOpen) => !isOpen && setSelectedDictionary(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedDictionary?.name} Attributes (Mock Data)</DialogTitle>
            <DialogDescription>Browse attributes within this dictionary. (Note: Attribute data is mocked for this prototype).</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attribute Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exampleAttributes.map(attr => (
                  <TableRow key={attr.id}>
                    <TableCell>{attr.name}</TableCell>
                    <TableCell>{attr.code}</TableCell>
                    <TableCell>{attr.type}</TableCell>
                    <TableCell>{attr.vendor}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleViewAttribute(attr)}>
                        <Info className="mr-1 h-4 w-4" /> Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                 {exampleAttributes.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No mock attributes to display.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Viewing Attribute Details (Still using mock data) */}
       <Dialog open={!!selectedAttribute} onOpenChange={(isOpen) => !isOpen && setSelectedAttribute(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attribute: {selectedAttribute?.name} (Mock Data)</DialogTitle>
            <DialogDescription>Details for RADIUS attribute.</DialogDescription>
          </DialogHeader>
          {selectedAttribute && (
            <div className="space-y-3 py-4 text-sm">
              <p><strong>Code:</strong> {selectedAttribute.code}</p>
              <p><strong>Type:</strong> {selectedAttribute.type}</p>
              <p><strong>Vendor:</strong> {selectedAttribute.vendor}</p>
              <p><strong>Description:</strong> {selectedAttribute.description}</p>
              {selectedAttribute.enumValues && (
                <p><strong>Allowed Values:</strong> {selectedAttribute.enumValues.join(', ')}</p>
              )}
              {selectedAttribute.examples && (
                <div>
                  <strong>Example Usage:</strong>
                  <pre className="mt-1 p-2 bg-muted rounded-md text-xs overflow-x-auto">{selectedAttribute.examples}</pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

    