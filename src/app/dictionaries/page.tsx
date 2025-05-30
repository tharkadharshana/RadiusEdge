
"use client";

import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { UploadCloud, Eye, Trash2, PlusCircle, Info, Loader2, Edit2, Save } from 'lucide-react';
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
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area'; 

export interface Attribute {
  id: string; 
  name: string;
  code: string;
  type: string;
  vendor: string;
  description: string;
  enumValues?: string[];
  examples?: string;
}

export interface Dictionary {
  id: string;
  name: string;
  source: string;
  attributes: number; 
  vendorCodes: number; 
  isActive: boolean;
  lastUpdated: string;
  exampleAttributes?: Attribute[]; 
}


export default function DictionariesPage() {
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [selectedDictionary, setSelectedDictionary] = useState<Dictionary | null>(null);
  const [selectedAttributeForDetailView, setSelectedAttributeForDetailView] = useState<Attribute | null>(null); 
  
  const [editingExampleAttributes, setEditingExampleAttributes] = useState<Attribute[]>([]);
  
  const [isAttributeEditorOpen, setIsAttributeEditorOpen] = useState(false);
  const [currentAttributeToEdit, setCurrentAttributeToEdit] = useState<Partial<Attribute> & { isNew?: boolean } | null>(null);
  const [attributeEditIndex, setAttributeEditIndex] = useState<number | null>(null); 

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); 
  const [isSavingAttributes, setIsSavingAttributes] = useState(false); 

  const [newDictName, setNewDictName] = useState('');
  const [newDictSource, setNewDictSource] = useState('');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const { toast } = useToast();

  const fetchDictionaries = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dictionaries');
      if (!response.ok) {
        let apiError = `Failed to fetch dictionaries. Status: ${response.status}`;
        try {
          const errorData = await response.json();
          // Prioritize the 'error' field from the backend for more specific messages
          apiError = errorData.error || errorData.message || apiError; 
        } catch (e) {
          // Response body was not JSON or error during parsing
          const textError = await response.text();
          apiError += `. Response: ${textError.substring(0, 150)}`;
        }
        throw new Error(apiError);
      }
      const data: Dictionary[] = await response.json();
      setDictionaries(data.map(d => ({ 
        ...d, 
        attributes: Array.isArray(d.exampleAttributes) ? d.exampleAttributes.length : 0, 
        vendorCodes: d.vendorCodes || 0,
        exampleAttributes: Array.isArray(d.exampleAttributes) ? d.exampleAttributes : [] 
      })));
    } catch (error) {
      console.error("Error fetching dictionaries (frontend catch):", error);
      toast({ title: "Error Fetching Dictionaries", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDictionaries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDictionaryActive = async (id: string, currentStatus: boolean) => {
    setIsSaving(true);
    // Optimistic UI update
    setDictionaries(prev => prev.map(dict => dict.id === id ? { ...dict, isActive: !currentStatus } : dict));
    try {
      const response = await fetch(`/api/dictionaries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to update dictionary status');
      }
      const updatedDict: Dictionary = await response.json();
      // Update with confirmed data from backend
      setDictionaries(prev => prev.map(d => d.id === updatedDict.id ? { 
        ...updatedDict, 
        attributes: Array.isArray(updatedDict.exampleAttributes) ? updatedDict.exampleAttributes.length : 0, 
        vendorCodes: d.vendorCodes, // keep original vendorCodes as it's not managed by this op
        exampleAttributes: Array.isArray(updatedDict.exampleAttributes) ? updatedDict.exampleAttributes : []
      } : d));
      toast({ title: "Success", description: `Dictionary "${updatedDict.name}" status updated.` });
    } catch (error) {
      console.error("Error toggling dictionary status:", error);
      toast({ title: "Update Failed", description: (error as Error).message, variant: "destructive" });
      // Revert optimistic update on error
      setDictionaries(prev => prev.map(dict => dict.id === id ? { ...dict, isActive: currentStatus } : dict));
    } finally {
      setIsSaving(false);
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
        throw new Error(errorData.error || errorData.message || 'Failed to import dictionary');
      }
      const newDictionary: Dictionary = await response.json();
      setDictionaries(prev => [ { 
        ...newDictionary, 
        attributes: Array.isArray(newDictionary.exampleAttributes) ? newDictionary.exampleAttributes.length : 0, 
        vendorCodes: 0,
        exampleAttributes: Array.isArray(newDictionary.exampleAttributes) ? newDictionary.exampleAttributes : []
      }, ...prev]);
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
    if (!window.confirm(`Are you sure you want to delete the dictionary "${name}"? This will also remove its example attributes.`)) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/dictionaries/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to delete dictionary');
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
    const attributesArray = Array.isArray(dictionary.exampleAttributes) ? dictionary.exampleAttributes : [];
    setEditingExampleAttributes(JSON.parse(JSON.stringify(attributesArray))); 
  };
  
  const handleViewAttributeDetail = (attribute: Attribute) => {
    setSelectedAttributeForDetailView(attribute);
  };

  const openAttributeEditor = (attribute?: Attribute, index?: number) => {
    setCurrentAttributeToEdit(attribute ? { ...attribute } : { id: `client_attr_${Date.now()}`, name: '', code: '', type: '', vendor: selectedDictionary?.name || 'Standard', description: '', examples: '', isNew: !attribute });
    setAttributeEditIndex(attribute ? index! : null); 
    setIsAttributeEditorOpen(true);
  };

  const handleSaveAttributeInEditor = () => {
    if (!currentAttributeToEdit) return;

    setEditingExampleAttributes(prev => {
      const newAttributes = [...prev];
      if (attributeEditIndex !== null && !currentAttributeToEdit.isNew) { 
        newAttributes[attributeEditIndex] = currentAttributeToEdit as Attribute;
      } else { 
        newAttributes.push(currentAttributeToEdit as Attribute);
      }
      return newAttributes;
    });
    setIsAttributeEditorOpen(false);
    setCurrentAttributeToEdit(null);
    setAttributeEditIndex(null);
  };

  const handleDeleteEditingAttribute = (index: number) => {
     setEditingExampleAttributes(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSaveChangesToDictionaryAttributes = async () => {
    if (!selectedDictionary) return;
    setIsSavingAttributes(true);
    try {
      const response = await fetch(`/api/dictionaries/${selectedDictionary.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Backend expects exampleAttributes as JSON string or it will parse as array
        body: JSON.stringify({ exampleAttributes: editingExampleAttributes }), 
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to save example attributes');
      }
      const updatedDictionary: Dictionary = await response.json();
      setDictionaries(prev => prev.map(d => d.id === updatedDictionary.id ? { 
        ...updatedDictionary, 
        attributes: Array.isArray(updatedDictionary.exampleAttributes) ? updatedDictionary.exampleAttributes.length : 0, 
        vendorCodes: d.vendorCodes,
        exampleAttributes: Array.isArray(updatedDictionary.exampleAttributes) ? updatedDictionary.exampleAttributes : []
      } : d));
      setSelectedDictionary(null); 
      toast({ title: "Attributes Saved", description: `Example attributes for "${updatedDictionary.name}" updated.` });
    } catch (error) {
      console.error("Error saving attributes:", error);
      toast({ title: "Save Failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSavingAttributes(false);
    }
  };


  return (
    <div className="space-y-8">
      <PageHeader
        title="RADIUS Dictionary Manager"
        description="Manage dictionary metadata and their example attributes. Full dictionary file parsing is conceptual."
        actions={
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button><UploadCloud className="mr-2 h-4 w-4" /> Import Dictionary (Metadata)</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import New Dictionary (Metadata)</DialogTitle>
                <DialogDescription>
                  Provide a name and source. Example attributes can be added after import.
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
          <CardDescription>Enable or disable dictionaries and manage their example attributes.</CardDescription>
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
                <TableHead className="text-center">Example Attributes</TableHead>
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
                           <Eye className="mr-2 h-4 w-4" /> Manage Example Attributes
                         </DropdownMenuItem>
                         <DropdownMenuSeparator />
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

      {/* Dialog for Viewing/Managing Dictionary Example Attributes */}
      <Dialog open={!!selectedDictionary} onOpenChange={(isOpen) => { if (!isOpen) setSelectedDictionary(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedDictionary?.name} - Example Attributes</DialogTitle>
            <DialogDescription>Manage the example attributes for this dictionary. These are stored with the dictionary metadata.</DialogDescription>
          </DialogHeader>
          <div className="my-4">
             <Button onClick={() => openAttributeEditor()}><PlusCircle className="mr-2 h-4 w-4" /> Add Example Attribute</Button>
          </div>
          <ScrollArea className="max-h-[50vh] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editingExampleAttributes.map((attr, index) => (
                  <TableRow key={attr.id || index}>
                    <TableCell>{attr.name}</TableCell>
                    <TableCell>{attr.code}</TableCell>
                    <TableCell>{attr.type}</TableCell>
                    <TableCell>{attr.vendor}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewAttributeDetail(attr)}>
                        <Info className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAttributeEditor(attr, index)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                       <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-7 w-7" onClick={() => handleDeleteEditingAttribute(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                 {editingExampleAttributes.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No example attributes defined for this dictionary.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDictionary(null)} disabled={isSavingAttributes}>Cancel</Button>
            <Button onClick={handleSaveChangesToDictionaryAttributes} disabled={isSavingAttributes}>
              {isSavingAttributes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes to Attributes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Adding/Editing a single Example Attribute */}
      <Dialog open={isAttributeEditorOpen} onOpenChange={setIsAttributeEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentAttributeToEdit?.isNew ? 'Add New Example Attribute' : `Edit Attribute: ${currentAttributeToEdit?.name}`}</DialogTitle>
            <DialogDescription>Provide details for the example attribute.</DialogDescription>
          </DialogHeader>
          {currentAttributeToEdit && (
            <div className="space-y-3 py-4">
              <div><Label>Name:</Label><Input value={currentAttributeToEdit.name || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, name: e.target.value} : null)} /></div>
              <div><Label>Code:</Label><Input value={currentAttributeToEdit.code || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, code: e.target.value} : null)} /></div>
              <div><Label>Type:</Label><Input value={currentAttributeToEdit.type || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, type: e.target.value} : null)} placeholder="e.g., string, integer, ipaddr" /></div>
              <div><Label>Vendor:</Label><Input value={currentAttributeToEdit.vendor || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, vendor: e.target.value} : null)} placeholder="e.g., Standard, Cisco" /></div>
              <div><Label>Description:</Label><Textarea value={currentAttributeToEdit.description || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, description: e.target.value} : null)} /></div>
              <div><Label>Example Usage:</Label><Textarea value={currentAttributeToEdit.examples || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, examples: e.target.value} : null)} placeholder='e.g., User-Name = "testuser"' /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAttributeEditorOpen(false); setCurrentAttributeToEdit(null); }}>Cancel</Button>
            <Button onClick={handleSaveAttributeInEditor}>Save Attribute</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Viewing Attribute Details (from selectedAttributeForDetailView) */}
       <Dialog open={!!selectedAttributeForDetailView} onOpenChange={(isOpen) => !isOpen && setSelectedAttributeForDetailView(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attribute: {selectedAttributeForDetailView?.name}</DialogTitle>
            <DialogDescription>Details for RADIUS attribute.</DialogDescription>
          </DialogHeader>
          {selectedAttributeForDetailView && (
            <div className="space-y-3 py-4 text-sm">
              <p><strong>Code:</strong> {selectedAttributeForDetailView.code}</p>
              <p><strong>Type:</strong> {selectedAttributeForDetailView.type}</p>
              <p><strong>Vendor:</strong> {selectedAttributeForDetailView.vendor}</p>
              <p><strong>Description:</strong> {selectedAttributeForDetailView.description}</p>
              {selectedAttributeForDetailView.enumValues && (
                <p><strong>Allowed Values:</strong> {selectedAttributeForDetailView.enumValues.join(', ')}</p>
              )}
              {selectedAttributeForDetailView.examples && (
                <div>
                  <strong>Example Usage:</strong>
                  <pre className="mt-1 p-2 bg-muted rounded-md text-xs overflow-x-auto">{selectedAttributeForDetailView.examples}</pre>
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
    
    
