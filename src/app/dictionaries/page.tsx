
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { UploadCloud, Eye, Trash2, PlusCircle, Info, Loader2, Edit2, Save, FileText, FileUp, MoreHorizontal, CheckSquare, Square, ChevronsUpDown, Minus } from 'lucide-react'; // Added Minus just in case, though Checkbox component handles it
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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import type { ParseDictionaryContentOutput, ParsedAttribute, ParsedEnum } from '@/ai/flows/parse-dictionary-file-content';

export interface Attribute {
  id: string;
  name: string;
  code: string;
  type: string;
  vendor?: string;
  description?: string;
  options?: string[];
  enumValues?: (string | ParsedEnum)[]; 
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
  const [selectedDictionaryIds, setSelectedDictionaryIds] = useState<string[]>([]);


  const { toast } = useToast();

  const fetchDictionaries = useCallback(async () => {
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
        // exampleAttributes should already be an array from the API if properly parsed.
        // If it's a string, it means parsing failed or wasn't done by the API.
        // The API GET routes were updated to parse this string into an array for `exampleAttributes`.
        exampleAttributes: Array.isArray(d.exampleAttributes) ? d.exampleAttributes : [],
        attributes: Array.isArray(d.exampleAttributes) ? d.exampleAttributes.length : (d.attributes || 0),
        vendorCodes: d.vendorCodes || 0, 
      })));
    } catch (error) {
      console.error("Error fetching dictionaries (frontend catch):", error);
      toast({ title: "Error Fetching Dictionaries", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDictionaries();
  }, [fetchDictionaries]);

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
      let requestBody: any = {};
      let toastTitle = "Import Started";
      let toastDescription = "Processing your dictionary import...";

      if (importMode === 'upload' && uploadedFiles && uploadedFiles.length > 0) {
        if (uploadedFiles.length > 1) { // Bulk upload
          toastTitle = "Bulk Import Started";
          toastDescription = `Preparing ${uploadedFiles.length} files for import. This may take a while...`;
          const filesToUploadPromises = Array.from(uploadedFiles).map(async (file) => {
            try {
              const content = await file.text();
              return { name: file.name, content };
            } catch (readError) {
              console.error(`Error reading file ${file.name}:`, readError);
              toast({ title: "File Read Error", description: `Could not read file ${file.name}.`, variant: "destructive" });
              return { name: file.name, content: '' }; // Send with empty content if read fails
            }
          });
          requestBody.files = await Promise.all(filesToUploadPromises);
        } else { // Single file upload
          const file = uploadedFiles[0];
          requestBody.rawContent = await file.text();
          if (!newDictName) requestBody.name = file.name.split('.').slice(0, -1).join('.') || file.name;
          else requestBody.name = newDictName;
          if (!newDictSource) requestBody.source = "Uploaded File";
          else requestBody.source = newDictSource;
          toastDescription = `Importing file ${file.name}...`;
        }
      } else if (importMode === 'paste') {
        if (!pastedDictContent.trim()) {
          toast({ title: "No Content", description: "Please paste dictionary content.", variant: "destructive" });
          setIsSaving(false); return;
        }
        requestBody.rawContent = pastedDictContent;
        if (newDictName) requestBody.name = newDictName;
        if (newDictSource) requestBody.source = newDictSource;
        toastDescription = "Parsing pasted content...";
      } else { // Manual mode
        if (!newDictName) {
          toast({ title: "Missing Name", description: "Please provide a name for the dictionary.", variant: "destructive" });
          setIsSaving(false); return;
        }
        requestBody.name = newDictName;
        requestBody.source = newDictSource || "Manually Created";
        toastDescription = `Creating dictionary ${newDictName}...`;
      }
      
      toast({ title: toastTitle, description: toastDescription});

      const response = await fetch('/api/dictionaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error during import."}));
        throw new Error(errorData.error || errorData.message || 'Failed to import dictionary/dictionaries');
      }
      
      const resultData = await response.json();
      if (Array.isArray(resultData)) { // Bulk import response
         toast({ title: "Bulk Import Processed", description: `${resultData.length} dictionary entries created/updated.` });
      } else { // Single import response
         toast({ title: "Dictionary Imported", description: `Dictionary "${resultData.name}" added/updated.` });
      }

      resetImportDialog();
      fetchDictionaries();
      setSelectedDictionaryIds([]);
    } catch (error) {
      console.error("Error importing dictionary:", error);
      toast({ title: "Import Failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleIndividualDictionaryActive = async (id: string, currentStatus: boolean) => {
    setIsSaving(true);
    const optimisticDictionaries = dictionaries.map(dict => dict.id === id ? { ...dict, isActive: !currentStatus } : dict);
    setDictionaries(optimisticDictionaries);

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
      setDictionaries(prev => prev.map(d => d.id === updatedDict.id ? {
        ...updatedDict,
        exampleAttributes: Array.isArray(updatedDict.exampleAttributes) ? updatedDict.exampleAttributes : [],
        attributes: Array.isArray(updatedDict.exampleAttributes) ? updatedDict.exampleAttributes.length : (updatedDict.attributes || 0),
        vendorCodes: updatedDict.vendorCodes || 0,
      } : d));
      toast({ title: "Success", description: `Dictionary "${updatedDict.name}" status updated.` });
    } catch (error) {
      console.error("Error toggling dictionary status:", error);
      toast({ title: "Update Failed", description: (error as Error).message, variant: "destructive" });
      setDictionaries(prev => prev.map(dict => dict.id === id ? { ...dict, isActive: currentStatus } : dict)); // Revert on error
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
      setSelectedDictionaryIds(prev => prev.filter(selectedId => selectedId !== id));
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
    setEditingExampleAttributes(JSON.parse(JSON.stringify(attributesArray))); // Deep copy
  };

  const handleViewAttributeDetail = (attribute: Attribute) => {
    let details = `Name: ${attribute.name}\nCode: ${attribute.code}\nType: ${attribute.type}`;
    if (attribute.vendor) details += `\nVendor: ${attribute.vendor}`;
    if (attribute.description) details += `\nDescription: ${attribute.description}`;
    if (attribute.options && attribute.options.length > 0) details += `\nOptions: ${attribute.options.join(', ')}`;
    if (attribute.enumValues && attribute.enumValues.length > 0) details += `\nEnum Values: ${renderAttributeValue(attribute.enumValues)}`;
    if (attribute.examples) details += `\nExample: ${attribute.examples}`;

    toast({ 
        title: `Attribute: ${attribute.name}`, 
        description: <pre className="whitespace-pre-wrap text-xs">{details}</pre>,
        duration: 10000 
    });
  };

  const openAttributeEditor = (attribute?: Attribute, index?: number) => {
    setCurrentAttributeToEdit(attribute ? { ...attribute } : { id: uuidv4(), name: '', code: '', type: '', vendor: selectedDictionaryForView?.name || 'Standard', description: '', examples: '', isNew: !attribute });
    setAttributeEditIndex(attribute ? index! : null);
    setIsAttributeEditorOpen(true);
  };

  const handleSaveAttributeInEditor = () => {
    if (!currentAttributeToEdit) return;
    setEditingExampleAttributes(prev => {
      const newAttributes = [...prev];
      if (attributeEditIndex !== null && !currentAttributeToEdit.isNew && attributeEditIndex < newAttributes.length) {
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
        body: JSON.stringify({ exampleAttributes: editingExampleAttributes }), // Send as array
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to save example attributes');
      }
      const updatedDictionary: Dictionary = await response.json();
      // Update the main dictionaries list
      setDictionaries(prev => prev.map(d => d.id === updatedDictionary.id ? {
        ...updatedDictionary,
        exampleAttributes: Array.isArray(updatedDictionary.exampleAttributes) ? updatedDictionary.exampleAttributes : [],
        attributes: Array.isArray(updatedDictionary.exampleAttributes) ? updatedDictionary.exampleAttributes.length : (updatedDictionary.attributes || 0),
        vendorCodes: updatedDictionary.vendorCodes || 0,
      } : d));
      // Update the selected dictionary for view
      setSelectedDictionaryForView(prev => prev ? {
        ...prev,
        exampleAttributes: Array.isArray(updatedDictionary.exampleAttributes) ? updatedDictionary.exampleAttributes : [],
        attributes: Array.isArray(updatedDictionary.exampleAttributes) ? updatedDictionary.exampleAttributes.length : 0,
      } : null);
      toast({ title: "Attributes Saved", description: `Attributes for "${updatedDictionary.name}" updated.` });
    } catch (error) {
      console.error("Error saving attributes:", error);
      toast({ title: "Save Failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSavingAttributes(false);
    }
  };

  const renderAttributeValue = (value: (string | ParsedEnum)[] | undefined): string => {
    if (!value || value.length === 0) return 'N/A';
    return value.map(e => {
        if (typeof e === 'string') return e;
        return `${e.name} (${e.value})`; 
    }).join(', ');
  };

  const isAllSelected = dictionaries.length > 0 && selectedDictionaryIds.length === dictionaries.length;
  const isSomeSelectedAndNotAll = selectedDictionaryIds.length > 0 && !isAllSelected;

  let headerCheckboxCheckedState: boolean | 'indeterminate';
  if (isAllSelected) {
    headerCheckboxCheckedState = true;
  } else if (isSomeSelectedAndNotAll) {
    headerCheckboxCheckedState = 'indeterminate';
  } else {
    headerCheckboxCheckedState = false;
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDictionaryIds(dictionaries.map(d => d.id));
    } else {
      setSelectedDictionaryIds([]);
    }
  };


  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedDictionaryIds(prev => [...prev, id]);
    } else {
      setSelectedDictionaryIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const handleBulkEnableDisable = async (enable: boolean) => {
    if (selectedDictionaryIds.length === 0) {
      toast({ title: "No Dictionaries Selected", description: "Please select dictionaries to update.", variant: "default" });
      return;
    }
    setIsSaving(true);
    const action = enable ? "Enable" : "Disable";
    toast({ title: `${action} Selected In Progress`, description: `Attempting to ${action.toLowerCase()} ${selectedDictionaryIds.length} dictionaries...` });

    const updatePromises = selectedDictionaryIds.map(id =>
      fetch(`/api/dictionaries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: enable }),
      }).then(async res => {
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({message: `HTTP error ${res.status}`}));
            return Promise.reject(new Error(`Failed for dictionary ID ${id}: ${errorData.message || res.statusText}`));
        }
        return res.json();
      })
    );

    const results = await Promise.allSettled(updatePromises);
    let successfulUpdates = 0;
    const failedUpdatesMessages: string[] = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        successfulUpdates++;
      } else {
        failedUpdatesMessages.push(result.reason.message);
      }
    });

    if (failedUpdatesMessages.length > 0) {
      const failedSummary = failedUpdatesMessages.length > 3 ? failedUpdatesMessages.slice(0, 3).join('; ') + '...' : failedUpdatesMessages.join('; ');
      toast({ title: `${action} Partially Failed`, description: `${successfulUpdates} succeeded. ${failedUpdatesMessages.length} failed: ${failedSummary}. Check console.`, variant: "destructive", duration: 7000 });
    } else if (successfulUpdates > 0) {
      toast({ title: `${action} Successful`, description: `All ${successfulUpdates} selected dictionaries updated.` });
    } else {
       toast({ title: `No Dictionaries ${action}d`, description: "The operation completed but no dictionaries were changed.", variant: "default" });
    }

    fetchDictionaries(); 
    setSelectedDictionaryIds([]); 
    setIsSaving(false);
  };

  const handleBulkDelete = async () => {
    if (selectedDictionaryIds.length === 0) {
      toast({ title: "No Dictionaries Selected", description: "Please select dictionaries to delete.", variant: "default" });
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedDictionaryIds.length} selected dictionaries? This action cannot be undone.`)) return;

    setIsSaving(true);
    toast({ title: "Bulk Delete In Progress", description: `Attempting to delete ${selectedDictionaryIds.length} dictionaries...` });

    const deletePromises = selectedDictionaryIds.map(id =>
      fetch(`/api/dictionaries/${id}`, { method: 'DELETE' })
      .then(async res => {
        if (!res.ok) {
            let errorMsg = `HTTP ${res.status} ${res.statusText}`;
            try {
                const errorData = await res.json();
                errorMsg = errorData.message || errorData.error || errorMsg;
            } catch (e) { /* ignore if response is not json */ }
            const errorToThrow = new Error(`Dictionary ID ${id}: ${errorMsg}`);
            (errorToThrow as any).dictionaryId = id;
            throw errorToThrow;
        }
        return { id, deleted: true, apiResponse: await res.json().catch(() => ({})) };
      })
      .catch(error => {
          const errorMessage = error.message || 'Unknown error during delete operation';
          const finalError = new Error(error.dictionaryId ? errorMessage : `Dictionary ID ${id}: ${errorMessage}`);
          (finalError as any).dictionaryId = error.dictionaryId || id;
          throw finalError; 
        })
    );

    const results = await Promise.allSettled(deletePromises);
    let successfulDeletesCount = 0;
    const failedDeletesMessages: string[] = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        successfulDeletesCount++;
      } else { 
        const reason = result.reason as Error & { dictionaryId?: string };
        failedDeletesMessages.push(reason.message || `Failed to delete ID ${reason.dictionaryId || 'unknown'}`);
        console.error(`Bulk delete failure for ID ${reason.dictionaryId || 'unknown'}:`, reason.message);
      }
    });

    if (failedDeletesMessages.length > 0) {
       const failedSummary = failedDeletesMessages.length > 3 ? failedDeletesMessages.slice(0, 3).join('; ') + '...' : failedDeletesMessages.join('; ');
      toast({
        title: "Bulk Delete Partially Failed",
        description: `${successfulDeletesCount} succeeded. ${failedDeletesMessages.length} failed: ${failedSummary}. Check console for full details.`,
        variant: "destructive",
        duration: 10000
      });
    } else if (successfulDeletesCount > 0) {
      toast({ title: "Bulk Delete Successful", description: `All ${successfulDeletesCount} selected dictionaries deleted.` });
    } else if (selectedDictionaryIds.length > 0 && successfulDeletesCount === 0 && failedDeletesMessages.length === 0) {
       toast({ title: "Bulk Delete: No Changes", description: "Operation completed. No dictionaries were deleted (perhaps they were already gone or an unknown issue occurred).", variant: "default" });
    } else { 
       toast({ title: "Bulk Delete Failed", description: "No dictionaries were deleted. All attempts failed. Check console for errors.", variant: "destructive" });
    }

    fetchDictionaries(); 
    setSelectedDictionaryIds([]); 
    setIsSaving(false);
  };


  return (
    <div className="space-y-8">
      <PageHeader
        title="RADIUS Dictionary Manager"
        description="Manage dictionaries, import content, and toggle their active status. AI parsing for imported files is best for self-contained vendor dictionaries and does not handle $INCLUDE."
        actions={
          <div className="flex gap-2">
            {selectedDictionaryIds.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={isSaving}>
                    <ChevronsUpDown className="mr-2 h-4 w-4" />
                    Bulk Actions ({selectedDictionaryIds.length})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleBulkEnableDisable(true)} disabled={isSaving}>
                    <CheckSquare className="mr-2 h-4 w-4" /> Enable Selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkEnableDisable(false)} disabled={isSaving}>
                    <Square className="mr-2 h-4 w-4" /> Disable Selected
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleBulkDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={isSaving}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Dialog open={isImportDialogOpen} onOpenChange={(open) => { if (!open) resetImportDialog(); else setIsImportDialogOpen(true); }}>
              <DialogTrigger asChild>
                <Button><UploadCloud className="mr-2 h-4 w-4" /> Import Dictionary</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Import New Dictionary</DialogTitle>
                  <DialogDescription>
                    Manually enter details, paste content, or upload file(s). 
                    AI Parsing works best on self-contained files. Uploading multiple files attempts to parse each.
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
                      {uploadedFiles && uploadedFiles.length > 1 && <p className="text-xs text-muted-foreground mt-1">{uploadedFiles.length} files selected for bulk import. Content will be parsed for each.</p>}
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
                <TableHead className="w-[50px] px-4">
                   <Checkbox
                    checked={headerCheckboxCheckedState}
                    onCheckedChange={(newIsChecked) => {
                        handleSelectAll(newIsChecked as boolean);
                    }}
                    aria-label="Select all dictionaries"
                    disabled={isSaving || dictionaries.length === 0}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-center">Attributes</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dictionaries.map((dict) => (
                <TableRow key={dict.id} data-state={selectedDictionaryIds.includes(dict.id) ? "selected" : ""}>
                  <TableCell className="px-4">
                    <Checkbox
                      checked={selectedDictionaryIds.includes(dict.id)}
                      onCheckedChange={(checked) => handleSelectRow(dict.id, !!checked)}
                      aria-label={`Select dictionary ${dict.name}`}
                      disabled={isSaving}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{dict.name}</TableCell>
                  <TableCell><Badge variant={dict.source.toLowerCase() === 'standard' || dict.source.toLowerCase() === '3gpp' ? 'outline' : 'secondary'}>{dict.source}</Badge></TableCell>
                  <TableCell className="text-center">{dict.attributes}</TableCell>
                  <TableCell>{dict.lastUpdated ? format(new Date(dict.lastUpdated), 'PPpp') : 'N/A'}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={dict.isActive}
                      onCheckedChange={() => handleToggleIndividualDictionaryActive(dict.id, dict.isActive)}
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
              {isLoading ? "Loading..." : selectedDictionaryIds.length > 0 ? `${selectedDictionaryIds.length} of ${dictionaries.length} selected.` : `Showing ${dictionaries.length} dictionary metadata entries.`}
            </p>
         </CardFooter>
      </Card>

      <Dialog open={!!selectedDictionaryForView} onOpenChange={(isOpen) => { if (!isOpen) setSelectedDictionaryForView(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedDictionaryForView?.name} - Parsed/Example Attributes</DialogTitle>
            <DialogDescription>Manage attributes for this dictionary. These are parsed from imported content or added manually.</DialogDescription>
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
              <div><Label>Options (comma-separated):</Label><Input value={currentAttributeToEdit.options?.join(', ') || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, options: e.target.value.split(',').map(s=>s.trim())} : null)} placeholder="e.g., has_tag, encrypt=1" /></div>
              <div><Label>Enum Values (display only, parsed from content):</Label><Textarea value={renderAttributeValue(currentAttributeToEdit.enumValues)} rows={2} readOnly className="bg-muted/50" /></div>
              <div><Label>Example Usage/Value:</Label><Textarea value={currentAttributeToEdit.examples || ''} onChange={e => setCurrentAttributeToEdit(p => p ? {...p, examples: e.target.value} : null)} placeholder='e.g., User-Name = "testuser"' /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAttributeEditorOpen(false); setCurrentAttributeToEdit(null); }}>Cancel</Button>
            <Button onClick={handleSaveAttributeInEditor}>Save Attribute</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE
