
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { UploadCloud, Eye, Trash2, PlusCircle, Info, Loader2, Edit2, Save, FileText, FileUp } from 'lucide-react';
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
import { cn } from '@/lib/utils';

export interface AttributeEnum { // Added for completeness if AI flow provides it
  id: string;
  name: string;
  value: string;
}

export interface Attribute {
  id: string; 
  name: string;
  code: string;
  type: string;
  vendor: string;
  description: string;
  options?: string[]; // Added based on AI flow
  enumValues?: string[] | AttributeEnum[]; // Updated to allow more structured enums
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
  const [selectedDictionaryForView, setSelectedDictionaryForView] = useState<Dictionary | null>(null);
  
  const [editingExampleAttributes, setEditingExampleAttributes] = useState<Attribute[]>([]);
  
  const [isAttributeEditorOpen, setIsAttributeEditorOpen] = useState(false);
  const [currentAttributeToEdit, setCurrentAttributeToEdit] = useState<Partial<Attribute> & { isNew?: boolean } | null>(null);
  const [attributeEditIndex, setAttributeEditIndex] = useState<number | null>(null); 

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); 
  const [isSavingAttributes, setIsSavingAttributes] = useState(false); 

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importMode, setImportMode] = useState<'manual' | 'paste' | 'upload'>('manual');
  const [newDictName, setNewDictName] = useState('');
  const [newDictSource, setNewDictSource] = useState('');
  const [pastedDictContent, setPastedDictContent] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<FileList | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const fetchDictionaries = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dictionaries');
      if (!response.ok) {
        let apiError = `Failed to fetch dictionaries. Status: ${response.status}`;
        try {
          const errorData = await response.json();
          apiError = errorData.error || errorData.message || apiError; 
        } catch (e) {
          const textError = await response.text().catch(() => "Could not get error text from response.");
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

  const resetImportDialog = () => {
    setNewDictName('');
    setNewDictSource('');
    setPastedDictContent('');
    setUploadedFiles(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setImportMode('manual');
    setIsImportDialogOpen(false);
  };

  const handleImportDictionary = async () => {
    setIsSaving(true);
    try {
      let response;
      if (importMode === 'upload' && uploadedFiles && uploadedFiles.length > 1) {
        // Bulk metadata import
        const filesToUpload = Array.from(uploadedFiles).map(file => ({ name: file.name, content: '' })); // Content not sent for bulk
        response = await fetch('/api/dictionaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: filesToUpload }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.message || 'Failed to bulk import dictionary metadata');
        }
        const newDictionaries: Dictionary[] = await response.json();
        setDictionaries(prev => [...newDictionaries.map(d => ({...d, attributes: 0, vendorCodes: 0, exampleAttributes: []})), ...prev]);
        toast({ title: "Bulk Import Successful", description: `${newDictionaries.length} dictionary metadata entries added.` });

      } else {
        // Single import (manual, paste, or single file upload)
        let rawContent: string | undefined = undefined;
        if (importMode === 'paste') {
          rawContent = pastedDictContent;
        } else if (importMode === 'upload' && uploadedFiles && uploadedFiles.length === 1) {
          rawContent = await uploadedFiles[0].text();
          if (!newDictName) setNewDictName(uploadedFiles[0].name.split('.').slice(0, -1).join('.') || uploadedFiles[0].name);
          if (!newDictSource) setNewDictSource("Uploaded File");
        }

        if (!newDictName && importMode === 'manual' && !rawContent) {
          toast({ title: "Missing Name", description: "Please provide a name for the dictionary.", variant: "destructive" });
          setIsSaving(false);
          return;
        }
        
        response = await fetch('/api/dictionaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newDictName, source: newDictSource, rawContent }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.message || 'Failed to import dictionary');
        }
        const newDictionary: Dictionary = await response.json();
        setDictionaries(prev => [{ 
          ...newDictionary, 
          attributes: Array.isArray(newDictionary.exampleAttributes) ? newDictionary.exampleAttributes.length : 0, 
          vendorCodes: newDictionary.vendorCodes || 0,
          exampleAttributes: Array.isArray(newDictionary.exampleAttributes) ? newDictionary.exampleAttributes : []
        }, ...prev]);
        toast({ title: "Dictionary Imported", description: `Dictionary "${newDictionary.name}" added.` });
      }
      resetImportDialog();
      fetchDictionaries(); // Re-fetch to ensure list is up-to-date
    } catch (error) {
      console.error("Error importing dictionary:", error);
      toast({ title: "Import Failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDictionaryActive = async (id: string, currentStatus: boolean) => {
    setIsSaving(true);
    setDictionaries(prev => prev.map(dict => dict.id === id ? { ...dict, isActive: !currentStatus } : dict)); // Optimistic
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
      // fetchDictionaries(); // Re-fetch for consistency
      const updatedDict: Dictionary = await response.json();
      setDictionaries(prev => prev.map(d => d.id === updatedDict.id ? { 
        ...updatedDict, 
        attributes: Array.isArray(updatedDict.exampleAttributes) ? updatedDict.exampleAttributes.length : 0, 
        vendorCodes: d.vendorCodes,
        exampleAttributes: Array.isArray(updatedDict.exampleAttributes) ? updatedDict.exampleAttributes : []
      } : d));
      toast({ title: "Success", description: `Dictionary "${updatedDict.name}" status updated.` });
    } catch (error) {
      console.error("Error toggling dictionary status:", error);
      toast({ title: "Update Failed", description: (error as Error).message, variant: "destructive" });
      setDictionaries(prev => prev.map(dict => dict.id === id ? { ...dict, isActive: currentStatus } : dict)); // Revert
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDictionary = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the dictionary "${name}"? This will also remove its attributes.`)) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/dictionaries/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to delete dictionary');
      }
      setDictionaries(prev => prev.filter(d => d.id !== id));
      toast({ title: "Dictionary Deleted", description: `Dictionary "${name}" removed.` });
    } catch (error) {
      console.error("Error deleting dictionary:", error);
      toast({ title: "Delete Failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewDictionary = (dictionary: Dictionary) => {
    setSelectedDictionaryForView(dictionary);
    const attributesArray = Array.isArray(dictionary.exampleAttributes) ? dictionary.exampleAttributes : [];
    setEditingExampleAttributes(JSON.parse(JSON.stringify(attributesArray))); 
  };
  
  const handleViewAttributeDetail = (attribute: Attribute) => {
    // This state needs to be defined if you want a separate modal for viewing attribute details
    // For now, it's just console logging
    console.log("Selected attribute for detail view:", attribute);
    toast({ title: "Attribute Detail", description: `Name: ${attribute.name}, Code: ${attribute.code}`});
  };

  const openAttributeEditor = (attribute?: Attribute, index?: number) => {
    setCurrentAttributeToEdit(attribute ? { ...attribute } : { id: `client_attr_${Date.now()}`, name: '', code: '', type: '', vendor: selectedDictionaryForView?.name || 'Standard', description: '', examples: '', isNew: !attribute });
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
    if (!selectedDictionaryForView) return;
    setIsSavingAttributes(true);
    try {
      const response = await fetch(`/api/dictionaries/${selectedDictionaryForView.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
        vendorCodes: d.vendorCodes, // keep original vendorCodes
        exampleAttributes: Array.isArray(updatedDictionary.exampleAttributes) ? updatedDictionary.exampleAttributes : []
      } : d));
      setSelectedDictionaryForView(null); 
      toast({ title: "Attributes Saved", description: `Attributes for "${updatedDictionary.name}" updated.` });
    } catch (error) {
      console.error("Error saving attributes:", error);
      toast({ title: "Save Failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSavingAttributes(false);
    }
  };

  const handleToggleAllDictionaries = async (targetStatus: boolean) => {
    setIsSaving(true);
    const action = targetStatus ? "Enable" : "Disable";
    toast({ title: `${action} All In Progress`, description: `Attempting to ${action.toLowerCase()} all dictionaries...` });

    const updates = dictionaries.map(dict => 
      fetch(`/api/dictionaries/${dict.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: targetStatus }),
      }).then(res => res.ok ? res.json() : Promise.reject(new Error(`Failed for ${dict.name}`)))
    );

    try {
      await Promise.all(updates);
      toast({ title: `${action} All Successful`, description: `All dictionaries have been ${action.toLowerCase()}d.` });
    } catch (error) {
      console.error(`Error during ${action.toLowerCase()} all:`, error);
      toast({ title: `${action} All Failed`, description: `Some dictionaries could not be updated. Please check individual statuses.`, variant: "destructive" });
    } finally {
      fetchDictionaries(); // Re-fetch all to get consistent state
      setIsSaving(false);
    }
  };

  const renderAttributeValue = (value: string[] | AttributeEnum[] | undefined): string => {
    if (!value || value.length === 0) return 'N/A';
    if (typeof value[0] === 'string') return (value as string[]).join(', ');
    return (value as AttributeEnum[]).map(e => `${e.name} (${e.value})`).join(', ');
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="RADIUS Dictionary Manager"
        description="Manage dictionaries, import content, and toggle their active status."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleToggleAllDictionaries(true)} disabled={isLoading || isSaving || dictionaries.length === 0}>Enable All</Button>
            <Button variant="outline" onClick={() => handleToggleAllDictionaries(false)} disabled={isLoading || isSaving || dictionaries.length === 0}>Disable All</Button>
            <Dialog open={isImportDialogOpen} onOpenChange={(open) => { if (!open) resetImportDialog(); else setIsImportDialogOpen(true); }}>
              <DialogTrigger asChild>
                <Button><UploadCloud className="mr-2 h-4 w-4" /> Import Dictionary</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Import New Dictionary</DialogTitle>
                  <DialogDescription>
                    Manually enter details, paste content, or upload file(s). Uploading multiple files creates metadata entries only.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-3 gap-2 my-4">
                  <Button variant={importMode === 'manual' ? 'default' : 'outline'} onClick={() => setImportMode('manual')}>Manual Entry</Button>
                  <Button variant={importMode === 'paste' ? 'default' : 'outline'} onClick={() => setImportMode('paste')}>Paste Content</Button>
                  <Button variant={importMode === 'upload' ? 'default' : 'outline'} onClick={() => setImportMode('upload')}>Upload File(s)</Button>
                </div>
                <div className="space-y-4 py-2">
                  {(importMode === 'manual' || importMode === 'paste' || (importMode === 'upload' && (!uploadedFiles || uploadedFiles.length <=1))) && (
                    <>
                      <div>
                        <Label htmlFor="dict-name">Dictionary Name</Label>
                        <Input id="dict-name" value={newDictName} onChange={(e) => setNewDictName(e.target.value)} placeholder="e.g., My Custom VSAs" disabled={isSaving} />
                      </div>
                      <div>
                        <Label htmlFor="dict-source">Source / Vendor</Label>
                        <Input id="dict-source" value={newDictSource} onChange={(e) => setNewDictSource(e.target.value)} placeholder="e.g., Custom, AcmeCorp" disabled={isSaving} />
                      </div>
                    </>
                  )}
                  {importMode === 'paste' && (
                    <div>
                      <Label htmlFor="dict-content-paste">Paste Dictionary Content</Label>
                      <Textarea id="dict-content-paste" value={pastedDictContent} onChange={(e) => setPastedDictContent(e.target.value)} placeholder="Paste content of dictionary file..." rows={6} disabled={isSaving} />
                    </div>
                  )}
                  {importMode === 'upload' && (
                    <div>
                      <Label htmlFor="dict-file-upload">Upload Dictionary File(s)</Label>
                      <Input id="dict-file-upload" type="file" ref={fileInputRef} onChange={(e) => setUploadedFiles(e.target.files)} multiple accept=".dic,.dictionary,.txt,text/plain" disabled={isSaving} />
                      {uploadedFiles && uploadedFiles.length > 1 && <p className="text-xs text-muted-foreground mt-1">{uploadedFiles.length} files selected for bulk metadata import.</p>}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetImportDialog} disabled={isSaving}>Cancel</Button>
                  <Button onClick={handleImportDictionary} disabled={isSaving || (importMode === 'upload' && !uploadedFiles)}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Import
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Available Dictionaries</CardTitle>
          <CardDescription>Enable or disable dictionaries and manage their attributes.</CardDescription>
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
                <TableHead className="text-center">Attributes</TableHead>
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
                           <Eye className="mr-2 h-4 w-4" /> View/Manage Attributes
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

      {/* Dialog for Viewing/Managing Dictionary Attributes */}
      <Dialog open={!!selectedDictionaryForView} onOpenChange={(isOpen) => { if (!isOpen) setSelectedDictionaryForView(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedDictionaryForView?.name} - Attributes</DialogTitle>
            <DialogDescription>Manage attributes for this dictionary. These are typically parsed from imported content.</DialogDescription>
          </DialogHeader>
          <div className="my-4">
             <Button onClick={() => openAttributeEditor()}><PlusCircle className="mr-2 h-4 w-4" /> Add Attribute Manually</Button>
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
                    <TableCell className="font-medium">{attr.name}</TableCell>
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
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No attributes defined or parsed for this dictionary.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDictionaryForView(null)} disabled={isSavingAttributes}>Cancel</Button>
            <Button onClick={handleSaveChangesToDictionaryAttributes} disabled={isSavingAttributes}>
              {isSavingAttributes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Attribute Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Adding/Editing a single Attribute */}
      <Dialog open={isAttributeEditorOpen} onOpenChange={setIsAttributeEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentAttributeToEdit?.isNew ? 'Add New Attribute' : `Edit Attribute: ${currentAttributeToEdit?.name}`}</DialogTitle>
            <DialogDescription>Provide details for the attribute.</DialogDescription>
          </DialogHeader>
          {currentAttributeToEdit && (
            <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto pr-1">
              <div><Label>Name:</Label><Input value={currentAttributeToEdit.name || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, name: e.target.value} : null)} /></div>
              <div><Label>Code:</Label><Input value={currentAttributeToEdit.code || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, code: e.target.value} : null)} /></div>
              <div><Label>Type:</Label><Input value={currentAttributeToEdit.type || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, type: e.target.value} : null)} placeholder="e.g., string, integer, ipaddr" /></div>
              <div><Label>Vendor:</Label><Input value={currentAttributeToEdit.vendor || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, vendor: e.target.value} : null)} placeholder={selectedDictionaryForView?.name || "Standard"} /></div>
              <div><Label>Description:</Label><Textarea value={currentAttributeToEdit.description || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, description: e.target.value} : null)} /></div>
              {/* For simplicity, enumValues editing is not directly implemented here, it comes from parser */}
              <div><Label>Options (comma-separated):</Label><Input value={currentAttributeToEdit.options?.join(', ') || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, options: e.target.value.split(',').map(s=>s.trim())} : null)} placeholder="e.g., has_tag, encrypt=1" /></div>
              <div><Label>Example Usage/Value:</Label><Textarea value={currentAttributeToEdit.examples || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, examples: e.target.value} : null)} placeholder='e.g., User-Name = "testuser"' /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAttributeEditorOpen(false); setCurrentAttributeToEdit(null); }}>Cancel</Button>
            <Button onClick={handleSaveAttributeInEditor}>Save Attribute</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Viewing Attribute Full Details (Not implemented in this pass, could be a separate component) */}

    </div>
  );
}
// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE
