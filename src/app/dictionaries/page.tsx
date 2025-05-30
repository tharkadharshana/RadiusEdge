
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
import { ScrollArea } from '@/components/ui/scroll-area'; // Added for potentially long attribute lists

export interface Dictionary {
  id: string;
  name: string;
  source: string;
  attributes: number; // This is a count derived from exampleAttributes by the API
  vendorCodes: number; // This remains a mock count
  isActive: boolean;
  lastUpdated: string;
  exampleAttributes?: Attribute[]; // Changed from string to Attribute[] for client-side
}

interface Attribute {
  id: string; // Client-side ID for list rendering, backend might not store this if attributes are just an array
  name: string;
  code: string;
  type: string;
  vendor: string;
  description: string;
  enumValues?: string[];
  examples?: string;
}

export default function DictionariesPage() {
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [selectedDictionary, setSelectedDictionary] = useState<Dictionary | null>(null);
  const [selectedAttributeForDetailView, setSelectedAttributeForDetailView] = useState<Attribute | null>(null); // For existing detail view
  
  // State for managing the list of example attributes being edited for selectedDictionary
  const [editingExampleAttributes, setEditingExampleAttributes] = useState<Attribute[]>([]);
  
  // State for the "Add/Edit Attribute" sub-dialog
  const [isAttributeEditorOpen, setIsAttributeEditorOpen] = useState(false);
  const [currentAttributeToEdit, setCurrentAttributeToEdit] = useState<Partial<Attribute> & { isNew?: boolean } | null>(null);
  const [attributeEditIndex, setAttributeEditIndex] = useState<number | null>(null); // To track which attribute is being edited

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // For import/toggle/delete dictionary
  const [isSavingAttributes, setIsSavingAttributes] = useState(false); // For saving example attributes

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
      // API returns exampleAttributes as an array of objects already parsed from JSON string by the API GET routes
      setDictionaries(data.map((d: any) => ({ ...d, attributes: d.exampleAttributes?.length || 0, vendorCodes: 0 })));
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
    setIsSaving(true);
    setDictionaries(prev => prev.map(dict => dict.id === id ? { ...dict, isActive: !currentStatus } : dict));
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
      setDictionaries(prev => prev.map(d => d.id === updatedDict.id ? { ...updatedDict, attributes: updatedDict.exampleAttributes?.length || 0, vendorCodes: d.vendorCodes } : d));
      toast({ title: "Success", description: `Dictionary "${updatedDict.name}" status updated.` });
    } catch (error) {
      console.error("Error toggling dictionary status:", error);
      toast({ title: "Update Failed", description: (error as Error).message, variant: "destructive" });
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
        throw new Error(errorData.message || 'Failed to import dictionary');
      }
      const newDictionary = await response.json();
      setDictionaries(prev => [ { ...newDictionary, attributes: newDictionary.exampleAttributes?.length || 0, vendorCodes: 0 }, ...prev]);
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
    // API now returns exampleAttributes as an array of objects.
    // Ensure it's an array, provide default empty if not.
    const attributesArray = Array.isArray(dictionary.exampleAttributes) ? dictionary.exampleAttributes : [];
    setEditingExampleAttributes(JSON.parse(JSON.stringify(attributesArray))); // Deep copy for editing
  };
  
  const handleViewAttributeDetail = (attribute: Attribute) => {
    setSelectedAttributeForDetailView(attribute);
  };

  // Handlers for Add/Edit Example Attribute sub-dialog
  const openAttributeEditor = (attribute?: Attribute, index?: number) => {
    setCurrentAttributeToEdit(attribute ? { ...attribute } : { id: `client_attr_${Date.now()}`, name: '', code: '', type: '', vendor: selectedDictionary?.name || 'Standard', description: '', examples: '', isNew: !attribute });
    setAttributeEditIndex(attribute ? index! : null); // Use index for editing existing
    setIsAttributeEditorOpen(true);
  };

  const handleSaveAttributeInEditor = () => {
    if (!currentAttributeToEdit) return;

    setEditingExampleAttributes(prev => {
      const newAttributes = [...prev];
      if (attributeEditIndex !== null && !currentAttributeToEdit.isNew) { // Editing existing
        newAttributes[attributeEditIndex] = currentAttributeToEdit as Attribute;
      } else { // Adding new
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
        body: JSON.stringify({ exampleAttributes: editingExampleAttributes }), // API expects JSON array (stringified)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save example attributes');
      }
      const updatedDictionary = await response.json();
      setDictionaries(prev => prev.map(d => d.id === updatedDictionary.id ? { ...updatedDictionary, attributes: updatedDictionary.exampleAttributes?.length || 0, vendorCodes: d.vendorCodes } : d));
      setSelectedDictionary(null); // Close main dialog
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
    
