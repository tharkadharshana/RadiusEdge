
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit3, Copy, Trash2, Play, Settings2, GripVertical, FileText, Database, Clock, Repeat, GitBranch, ListChecks, MoreHorizontal, Search, Workflow, Variable, Save, X, Wand2, Loader2, Webhook, MessageSquareText, Upload, Download } from 'lucide-react';
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
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { parseRadiusAttributesFromString, ParseRadiusAttributesInput, ParseRadiusAttributesOutput } from '@/ai/flows/parse-radius-attributes-flow';
import type { RadiusPacket } from '@/app/packets/page'; 

export type ScenarioStepType = 'radius' | 'sql' | 'delay' | 'loop_start' | 'loop_end' | 'conditional_start' | 'conditional_end' | 'api_call' | 'log_message';

export interface ExpectedReplyAttribute {
  id: string;
  name: string;
  value: string;
}

export interface ApiHeader {
  id: string;
  name: string;
  value: string;
}

export interface ScenarioStep {
  id: string;
  type: ScenarioStepType;
  name: string;
  details: Record<string, any> & {
    // RADIUS
    packet_id?: string;
    expectedAttributes?: ExpectedReplyAttribute[];
    timeout?: number;
    retries?: number;
    // SQL
    query?: string;
    expect_column?: string;
    expect_value?: string;
    connection?: string;
    // Delay
    duration_ms?: number;
    // Loop
    iterations?: number;
    // Conditional / Loop condition
    condition?: string;
    // API Call
    url?: string;
    method?: 'GET' | 'POST';
    headers?: ApiHeader[];
    requestBody?: string;
    mockResponseBody?: string; 
    // Log Message
    message?: string;
  };
}

export interface ScenarioVariable {
  id: string;
  name: string;
  type: 'static' | 'random_string' | 'random_number' | 'list';
  value: string;
}

export interface Scenario { 
  id: string;
  name: string;
  description: string;
  variables: ScenarioVariable[];
  steps: ScenarioStep[];
  lastModified: string;
  tags: string[];
}

const stepIcons: Record<ScenarioStepType, React.ElementType> = {
  radius: FileText,
  sql: Database,
  delay: Clock,
  loop_start: Repeat,
  loop_end: Repeat,
  conditional_start: GitBranch,
  conditional_end: GitBranch,
  api_call: Webhook,
  log_message: MessageSquareText,
};

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


export default function ScenariosPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pastedAttributesText, setPastedAttributesText] = useState('');
  const [isParsingAttributes, setIsParsingAttributes] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [availablePackets, setAvailablePackets] = useState<RadiusPacket[]>([]);
  const [isLoadingPackets, setIsLoadingPackets] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchScenarios = useCallback(async (currentSearchTerm: string) => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (currentSearchTerm) {
        queryParams.append('search', currentSearchTerm);
      }
      queryParams.append('sortBy', 'lastModified'); 

      const response = await fetch(`/api/scenarios?${queryParams.toString()}`);
      if (!response.ok) {
        let apiError = 'Failed to fetch scenarios';
        try {
            const errorData = await response.json();
            apiError = errorData.error || errorData.message || apiError;
            console.error("FRONTEND: API error data for fetchScenarios:", errorData);
        } catch (e) {
            const textError = await response.text().catch(() => "Could not get error text from response.");
            console.error("FRONTEND: Non-JSON API error for fetchScenarios:", textError);
            apiError += `. Response: ${textError.substring(0, 150)}`;
        }
        throw new Error(apiError);
      }
      const data: Scenario[] = await response.json();
      setScenarios(data.map(s => ({
        ...s,
        variables: Array.isArray(s.variables) ? s.variables : [],
        steps: Array.isArray(s.steps) ? s.steps.map(step => ({
          ...step,
          details: step.details || {},
          expectedAttributes: Array.isArray(step.details?.expectedAttributes) ? step.details.expectedAttributes : [],
          headers: Array.isArray(step.details?.headers) ? step.details.headers : [],
        })) : [],
        tags: Array.isArray(s.tags) ? s.tags : [],
      })));
    } catch (error) {
      console.error("FRONTEND: Error in fetchScenarios (catch block):", error);
      toast({ title: "Error Fetching Scenarios", description: (error as Error).message, variant: "destructive" });
      setScenarios([]); 
    } finally {
      setIsLoading(false);
    }
  }, [toast]);


  const debouncedFetchScenarios = useCallback(debounce(fetchScenarios, 300), [fetchScenarios]);

  useEffect(() => {
    debouncedFetchScenarios(searchTerm);
  }, [searchTerm, debouncedFetchScenarios]);

  const fetchAvailablePackets = async () => {
    setIsLoadingPackets(true);
    try {
      const response = await fetch('/api/packets');
      if (!response.ok) {
        throw new Error('Failed to fetch packet templates');
      }
      const data = await response.json();
      setAvailablePackets(data);
    } catch (error) {
      console.error("Error fetching packet templates:", error);
      toast({ title: "Error", description: "Could not load packet templates.", variant: "destructive" });
      setAvailablePackets([]);
    } finally {
      setIsLoadingPackets(false);
    }
  };

  useEffect(() => {
    const templateId = searchParams.get('template');
    const openScenarioId = searchParams.get('open');

    if (openScenarioId && scenarios.length > 0) {
        const scenarioToOpen = scenarios.find(s => s.id === openScenarioId);
        if (scenarioToOpen) {
            handleEditScenario(scenarioToOpen);
        }
    } else if (templateId && scenarios.length === 0 && !isLoading) { 
        const templateName = templateId === '3gpp-auth' ? '3GPP Authentication (from template)' :
                           templateId === 'wifi-eap' ? 'Wi-Fi EAP-TTLS (from template)' :
                           'New Scenario (from template)';
      createNewScenario(templateName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, scenarios, isLoading]); 


  const handleEditScenario = (scenario: Scenario | null) => {
    setEditingScenario(scenario ? JSON.parse(JSON.stringify(scenario)) : null);
    setPastedAttributesText('');
    if (scenario) { 
      fetchAvailablePackets();
    }
  };

  const handleSaveScenario = async () => {
    if (!editingScenario) return;
    setIsSaving(true);
    const isNew = editingScenario.id === 'new' || editingScenario.id.startsWith('imported-');
    const url = isNew ? '/api/scenarios' : `/api/scenarios/${editingScenario.id}`;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingScenario, lastModified: new Date().toISOString() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: "Failed to save scenario"}));
        throw new Error(errorData.message || `Failed to ${isNew ? 'create' : 'update'} scenario`);
      }
      const savedScenario = await response.json();

      fetchScenarios(searchTerm); 
      handleEditScenario(null);
      toast({ title: "Scenario Saved", description: `Scenario "${savedScenario.name}" has been saved.` });
    } catch (error: any) {
      console.error(`FRONTEND: Error saving scenario:`, error);
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteScenario = async (scenarioId: string) => {
    if (!window.confirm("Are you sure you want to delete this scenario?")) {
      return;
    }
    setIsSaving(true); 
    try {
      const response = await fetch(`/api/scenarios/${scenarioId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(()=>({message: "Failed to delete scenario"}));
        throw new Error(errorData.message);
      }
      fetchScenarios(searchTerm); 
      toast({ title: "Scenario Deleted", description: "Scenario successfully deleted." });
    } catch (error: any) {
      console.error("FRONTEND: Error deleting scenario:", error);
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const createNewScenario = (name = 'New RADIUS Scenario') => {
    handleEditScenario({
      id: 'new',
      name: name,
      description: '',
      variables: [],
      steps: [{ id: `step_new_1_${Date.now()}`, type: 'radius', name: 'Initial RADIUS Request', details: { packet_id: '', expectedAttributes: [], timeout: 3000, retries: 2 } }],
      lastModified: new Date().toISOString(),
      tags: [],
    });
    fetchAvailablePackets(); 
  };

  const addVariable = () => {
    if (editingScenario) {
      setEditingScenario(prev => prev ? {
        ...prev,
        variables: [...prev.variables, {id: `var${Date.now()}`, name: `var${prev.variables.length+1}`, type: 'static', value: ''}]
      } : null);
    }
  };

  const removeVariable = (index: number) => {
    if (editingScenario) {
      setEditingScenario(prev => prev ? {
        ...prev,
        variables: prev.variables.filter((_, i) => i !== index)
      } : null);
    }
  };

  const handleVariableChange = (index: number, field: keyof ScenarioVariable, value: string) => {
     if (editingScenario) {
      const updatedVariables = [...editingScenario.variables];
      updatedVariables[index] = { ...updatedVariables[index], [field]: value };
      setEditingScenario({ ...editingScenario, variables: updatedVariables });
    }
  };

  const addStep = (type: ScenarioStepType) => {
    if (editingScenario) {
      let stepName = 'New Step';
      let stepDetails: ScenarioStep['details'] = {};
      if (type === 'radius') {
        stepName = 'New RADIUS Request';
        stepDetails = { packet_id: availablePackets.length > 0 ? availablePackets[0].id : '', expectedAttributes: [], timeout: 3000, retries: 2 };
      } else if (type === 'sql') {
        stepName = 'New SQL Validation';
        stepDetails = { query: '', expect_column: '', expect_value: '', connection: '' };
      } else if (type === 'delay') {
        stepName = 'New Delay';
        stepDetails = { duration_ms: 1000 };
      } else if (type === 'loop_start') {
        stepName = 'Loop Start';
        stepDetails = { iterations: 3, condition: '' };
      } else if (type === 'loop_end') {
        stepName = 'Loop End';
      } else if (type === 'conditional_start') {
        stepName = 'Conditional Start';
        stepDetails = { condition: '' };
      } else if (type === 'conditional_end') {
        stepName = 'Conditional End';
      } else if (type === 'api_call') {
        stepName = 'New API Call';
        stepDetails = { url: '', method: 'GET', headers: [{id: `header_${Date.now()}`, name: 'Content-Type', value: 'application/json'}], requestBody: '', mockResponseBody: '{ "success": true }' };
      } else if (type === 'log_message') {
        stepName = 'New Log Message';
        stepDetails = { message: 'Log: ' };
      }


      setEditingScenario(prev => prev ? {
        ...prev,
        steps: [...prev.steps, {id: `step${Date.now()}`, type, name: stepName, details: stepDetails}]
      } : null);
    }
  };

  const removeStep = (index: number) => {
     if (editingScenario) {
      setEditingScenario(prev => prev ? {
        ...prev,
        steps: prev.steps.filter((_, i) => i !== index)
      } : null);
    }
  };

  const handleStepChange = (stepIndex: number, field: 'name' | 'details', value: any) => {
     if (editingScenario) {
      const updatedSteps = [...editingScenario.steps];
      if (field === 'details') {
         updatedSteps[stepIndex].details = {...updatedSteps[stepIndex].details, ...value};
      } else {
          (updatedSteps[stepIndex] as any)[field] = value;
      }
      setEditingScenario({ ...editingScenario, steps: updatedSteps });
    }
  };

  const addExpectedReplyAttribute = (stepIndex: number) => {
    if (editingScenario) {
      const updatedSteps = [...editingScenario.steps];
      const step = updatedSteps[stepIndex];
      if (step.type === 'radius') {
        const newAttribute: ExpectedReplyAttribute = { id: `exp_attr_${Date.now()}`, name: '', value: '' };
        step.details.expectedAttributes = [...(step.details.expectedAttributes || []), newAttribute];
        setEditingScenario({ ...editingScenario, steps: updatedSteps });
      }
    }
  };

  const removeExpectedReplyAttribute = (stepIndex: number, attributeId: string) => {
    if (editingScenario) {
      const updatedSteps = [...editingScenario.steps];
      const step = updatedSteps[stepIndex];
      if (step.type === 'radius' && step.details.expectedAttributes) {
        step.details.expectedAttributes = step.details.expectedAttributes.filter(attr => attr.id !== attributeId);
        setEditingScenario({ ...editingScenario, steps: updatedSteps });
      }
    }
  };

  const handleExpectedReplyAttributeChange = (stepIndex: number, attributeId: string, field: 'name' | 'value', newValue: string) => {
    if (editingScenario) {
      const updatedSteps = [...editingScenario.steps];
      const step = updatedSteps[stepIndex];
      if (step.type === 'radius' && step.details.expectedAttributes) {
        const attrIndex = step.details.expectedAttributes.findIndex(attr => attr.id === attributeId);
        if (attrIndex > -1) {
          step.details.expectedAttributes[attrIndex] = {
            ...step.details.expectedAttributes[attrIndex],
            [field]: newValue
          };
          setEditingScenario({ ...editingScenario, steps: updatedSteps });
        }
      }
    }
  };

  const addApiHeader = (stepIndex: number) => {
    if (editingScenario) {
      const updatedSteps = [...editingScenario.steps];
      const step = updatedSteps[stepIndex];
      if (step.type === 'api_call') {
        const newHeader: ApiHeader = { id: `header_${Date.now()}`, name: '', value: '' };
        step.details.headers = [...(step.details.headers || []), newHeader];
        setEditingScenario({ ...editingScenario, steps: updatedSteps });
      }
    }
  };

  const removeApiHeader = (stepIndex: number, headerId: string) => {
    if (editingScenario) {
      const updatedSteps = [...editingScenario.steps];
      const step = updatedSteps[stepIndex];
      if (step.type === 'api_call' && step.details.headers) {
        step.details.headers = step.details.headers.filter((h: ApiHeader) => h.id !== headerId);
        setEditingScenario({ ...editingScenario, steps: updatedSteps });
      }
    }
  };

  const handleApiHeaderChange = (stepIndex: number, headerId: string, field: 'name' | 'value', newValue: string) => {
    if (editingScenario) {
      const updatedSteps = [...editingScenario.steps];
      const step = updatedSteps[stepIndex];
      if (step.type === 'api_call' && step.details.headers) {
        const headerIndex = step.details.headers.findIndex((h: ApiHeader) => h.id === headerId);
        if (headerIndex > -1) {
          step.details.headers[headerIndex] = {
            ...step.details.headers[headerIndex],
            [field]: newValue
          };
          setEditingScenario({ ...editingScenario, steps: updatedSteps });
        }
      }
    }
  };

  const handleParsePastedAttributes = async (stepIndex: number) => {
    if (!editingScenario || !pastedAttributesText.trim()) {
      toast({ title: "Nothing to parse", description: "Please paste attribute data into the text area.", variant: "destructive" });
      return;
    }
    setIsParsingAttributes(true);
    try {
      const input: ParseRadiusAttributesInput = { rawAttributesText: pastedAttributesText };
      const result: ParseRadiusAttributesOutput = await parseRadiusAttributesFromString(input);

      const newExpectedAttributes: ExpectedReplyAttribute[] = result.parsedAttributes.map(pa => ({
        id: `exp_attr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: pa.name,
        value: pa.value,
      }));

      const updatedSteps = [...editingScenario.steps];
      const step = updatedSteps[stepIndex];
      if (step.type === 'radius') {
        step.details.expectedAttributes = newExpectedAttributes;
        setEditingScenario({ ...editingScenario, steps: updatedSteps });
        setPastedAttributesText('');
        toast({ title: "Attributes Parsed", description: `${newExpectedAttributes.length} attributes added/updated.` });
      }
    } catch (error) {
      console.error("FRONTEND: Error parsing attributes:", error);
      toast({ title: "Parsing Failed", description: (error as Error).message || "Could not parse attributes from text.", variant: "destructive" });
    } finally {
      setIsParsingAttributes(false);
    }
  };

  const handleExportScenario = () => {
    if (!editingScenario) {
      toast({ title: "No Scenario to Export", description: "Please open a scenario to export.", variant: "destructive" });
      return;
    }
    const scenarioJson = JSON.stringify(editingScenario, null, 2);
    const blob = new Blob([scenarioJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = editingScenario.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `radiusedge_scenario_${safeName || 'untitled'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Scenario Exported", description: `Scenario "${editingScenario.name}" has been prepared for download.` });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const importedData = JSON.parse(text);

        if (typeof importedData.name !== 'string' || !Array.isArray(importedData.steps)) {
          throw new Error("Invalid scenario file format. Missing 'name' or 'steps'.");
        }
        
        const ensureUniqueIds = (items: any[], prefix: string) => 
          items.map(item => ({ ...item, id: `${prefix}_imported_${Date.now()}_${Math.random().toString(36).substring(2,9)}` }));

        const scenarioToEdit: Scenario = {
          id: `imported-${Date.now()}`,
          name: importedData.name || "Imported Scenario",
          description: importedData.description || "",
          variables: Array.isArray(importedData.variables) ? ensureUniqueIds(importedData.variables, 'var') : [],
          steps: Array.isArray(importedData.steps) ? importedData.steps.map((s: any) => ({ 
            ...s, 
            id: `step_imported_${Date.now()}_${Math.random().toString(36).substring(2,9)}`,
            details: s.details || {},
            expectedAttributes: Array.isArray(s.details?.expectedAttributes) ? ensureUniqueIds(s.details.expectedAttributes, 'exp_attr') : [],
            headers: Array.isArray(s.details?.headers) ? ensureUniqueIds(s.details.headers, 'header') : [],
          })) : [],
          lastModified: new Date().toISOString().split('T')[0],
          tags: Array.isArray(importedData.tags) ? importedData.tags : [],
        };

        handleEditScenario(scenarioToEdit);
        toast({ title: "Scenario Imported", description: `Scenario "${scenarioToEdit.name}" loaded into editor. Please review and save.` });

      } catch (error: any) {
        console.error("FRONTEND: Error importing scenario:", error);
        toast({ title: "Import Failed", description: error.message || "Could not parse scenario file.", variant: "destructive" });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleRunScenario = (scenarioId: string, scenarioName: string) => {
    toast({ title: "Run Scenario", description: `Navigating to execute scenario: ${scenarioName}. Please select a server on the next page.` });
    router.push(`/execute?scenarioId=${scenarioId}&scenarioName=${encodeURIComponent(scenarioName)}`);
  };
  
  const handleDuplicateScenario = (scenarioId: string) => {
    const scenarioToDuplicate = scenarios.find(s => s.id === scenarioId);
    if (scenarioToDuplicate) {
      const newScenario: Scenario = {
        ...JSON.parse(JSON.stringify(scenarioToDuplicate)), // Deep copy
        id: 'new', // Mark as new
        name: `${scenarioToDuplicate.name} (Copy)`,
        lastModified: new Date().toISOString(),
      };
      handleEditScenario(newScenario);
      toast({ title: "Scenario Duplicated", description: `"${scenarioToDuplicate.name}" duplicated. Save to confirm.` });
    } else {
      toast({ title: "Error", description: "Scenario not found for duplication.", variant: "destructive" });
    }
  };


  return (
    <div className="space-y-8">
      <PageHeader
        title="Scenario Builder"
        description="Design RADIUS test scenarios. Conditional logic and API calls are currently simulated representations for this prototype. Drag & drop step reordering is not yet implemented."
        actions={
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" />
            <Button variant="outline" onClick={handleImportClick} disabled={isLoading || isSaving}>
              <Upload className="mr-2 h-4 w-4" /> Import Scenario
            </Button>
            <Button onClick={() => createNewScenario()} disabled={isLoading || isSaving}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Scenario
            </Button>
          </div>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Scenario Library</CardTitle>
           <div className="flex items-center gap-2 pt-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search scenarios by name, description, or tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && scenarios.length === 0 ? ( 
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading scenarios...</p>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarios.map((scenario) => (
                <TableRow key={scenario.id}>
                  <TableCell className="font-medium">{scenario.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{scenario.description}</TableCell>
                  <TableCell>{scenario.steps.length}</TableCell>
                   <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(scenario.tags || []).map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>{new Date(scenario.lastModified).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isSaving}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditScenario(scenario)} disabled={isSaving}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRunScenario(scenario.id, scenario.name)} disabled={isSaving}>
                          <Play className="mr-2 h-4 w-4" /> Run
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateScenario(scenario.id)} disabled={isSaving}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteScenario(scenario.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={isSaving}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && scenarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No scenarios found. Try adjusting your search or create a new scenario.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-sm text-muted-foreground">
              {isLoading && scenarios.length === 0 ? "Loading..." : `Showing ${scenarios.length} scenarios.`}
            </p>
         </CardFooter>
      </Card>

      <Dialog open={!!editingScenario} onOpenChange={(isOpen) => !isOpen && handleEditScenario(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingScenario?.id === 'new' || editingScenario?.id.startsWith('imported-') ? 'Create/Edit Scenario' : `Edit Scenario: ${editingScenario?.name}`}</DialogTitle>
            <DialogDescription>
             Define scenario properties, variables, and steps. Conditional logic and API calls are currently simulated representations for this prototype. Drag & drop step reordering is not yet implemented.
            </DialogDescription>
          </DialogHeader>
          {editingScenario && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 py-4 overflow-hidden min-h-0">
              {/* Left Panel: Scenario Details & Variables */}
              <div className="md:col-span-1 flex flex-col border rounded-md p-4 bg-muted/20 min-h-0 overflow-hidden">
                <ScrollArea className="flex-grow pr-2">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary"/>Properties</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label htmlFor="scenario-name">Scenario Name</Label>
                          <Input id="scenario-name" value={editingScenario.name} onChange={(e) => setEditingScenario({ ...editingScenario, name: e.target.value })} disabled={isSaving} />
                        </div>
                        <div>
                          <Label htmlFor="scenario-description">Description</Label>
                          <Textarea id="scenario-description" value={editingScenario.description} onChange={(e) => setEditingScenario({ ...editingScenario, description: e.target.value })} disabled={isSaving} />
                        </div>
                        <div>
                          <Label htmlFor="scenario-tags">Tags (comma-separated)</Label>
                          <Input id="scenario-tags" value={(editingScenario.tags || []).join(', ')} onChange={(e) => setEditingScenario({ ...editingScenario, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })} placeholder="e.g., Auth, 3GPP" disabled={isSaving}/>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="flex-shrink-0">
                      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Variable className="h-5 w-5 text-primary"/>Variables</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {editingScenario.variables.map((variable, index) => (
                          <Card key={variable.id} className="p-3 bg-card">
                            <div className="flex justify-between items-center mb-1">
                              <Label htmlFor={`var-name-${index}`} className="text-xs font-semibold">Variable {index + 1}</Label>
                              <Button variant="ghost" size="icon" onClick={() => removeVariable(index)} className="h-6 w-6 text-destructive hover:text-destructive" disabled={isSaving}>
                                  <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input placeholder="Name" value={variable.name} onChange={(e) => handleVariableChange(index, 'name', e.target.value)} disabled={isSaving}/>
                              <Select value={variable.type} onValueChange={(val) => handleVariableChange(index, 'type', val)} disabled={isSaving}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="static">Static</SelectItem>
                                  <SelectItem value="random_string">Random String</SelectItem>
                                  <SelectItem value="random_number">Random Number</SelectItem>
                                  <SelectItem value="list">List</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Input className="mt-1" placeholder="Value / Pattern / List (CSV)" value={variable.value} onChange={(e) => handleVariableChange(index, 'value', e.target.value)} disabled={isSaving}/>
                          </Card>
                        ))}
                        <Button variant="outline" size="sm" onClick={addVariable} className="w-full" disabled={isSaving}><PlusCircle className="mr-2 h-4 w-4" /> Add Variable</Button>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </div>

              {/* Right Panel: Scenario Steps */}
              <div className="md:col-span-2 flex flex-col h-full border rounded-md p-4 bg-muted/20 min-h-0 overflow-hidden">
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><Workflow className="h-5 w-5 text-primary"/>Scenario Steps</h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isSaving}><PlusCircle className="mr-2 h-4 w-4" /> Add Step</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => addStep('radius')}><FileText className="mr-2 h-4 w-4" /> RADIUS Packet</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addStep('sql')}><Database className="mr-2 h-4 w-4" /> SQL Validation</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addStep('delay')}><Clock className="mr-2 h-4 w-4" /> Delay</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addStep('api_call')}><Webhook className="mr-2 h-4 w-4" /> API Call</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addStep('log_message')}><MessageSquareText className="mr-2 h-4 w-4" /> Log Message</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => addStep('loop_start')}><Repeat className="mr-2 h-4 w-4" /> Loop Start</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addStep('loop_end')}><Repeat className="mr-2 h-4 w-4 transform scale-x-[-1]" /> Loop End</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addStep('conditional_start')}><GitBranch className="mr-2 h-4 w-4" /> Conditional Start</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addStep('conditional_end')}><GitBranch className="mr-2 h-4 w-4 transform scale-x-[-1]" /> Conditional End</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <ScrollArea className="flex-grow pr-2">
                  <div className="space-y-4">
                    {editingScenario.steps.map((step, index) => {
                      const StepIcon = stepIcons[step.type];
                      return (
                        <Card key={step.id || index} className="p-4 relative group bg-card hover:shadow-md transition-shadow">
                           <Button variant="ghost" size="icon" className={cn("absolute top-2 right-10 text-muted-foreground hover:text-foreground h-7 w-7 opacity-50 group-hover:opacity-100 cursor-grab")} aria-label="Drag to reorder (not implemented)" disabled={isSaving}>
                            <GripVertical className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeStep(index)} className="absolute top-2 right-2 text-destructive hover:text-destructive h-7 w-7 opacity-50 group-hover:opacity-100" disabled={isSaving}>
                            <X className="h-4 w-4" />
                          </Button>
                          <div className="flex items-center gap-2 mb-2">
                            <StepIcon className="h-5 w-5 text-primary" />
                            <Input value={step.name} onChange={(e) => handleStepChange(index, 'name', e.target.value)} className="text-md font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" disabled={isSaving} />
                          </div>

                          {step.type === 'radius' && (
                            <div className="space-y-3 pl-7 text-sm">
                              <div>
                                <Label>Packet Template:</Label>
                                <Select 
                                  value={step.details.packet_id} 
                                  onValueChange={(v) => handleStepChange(index, 'details', {packet_id: v})} 
                                  disabled={isSaving || isLoadingPackets}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={isLoadingPackets ? "Loading packets..." : "Select Packet..."}/>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {isLoadingPackets ? (
                                      <div className="p-2 text-center text-sm text-muted-foreground">Loading...</div>
                                    ) : availablePackets.length > 0 ? (
                                      availablePackets.map(packet => (
                                        <SelectItem key={packet.id} value={packet.id}>{packet.name}</SelectItem>
                                      ))
                                    ) : (
                                      <div className="p-2 text-center text-sm text-muted-foreground">No packets found. <Link href="/packets" className="text-primary hover:underline">Create one?</Link></div>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2 pt-2">
                                <Label className="font-medium">Expected Reply Attributes (Paste or Add Manually):</Label>
                                <Textarea
                                  value={pastedAttributesText}
                                  onChange={(e) => setPastedAttributesText(e.target.value)}
                                  placeholder={'User-Name = "testuser"\nFramed-IP-Address = 10.0.0.1\nAcct-Status-Type = Start'}
                                  rows={3}
                                  className="font-mono text-xs"
                                  disabled={isSaving || isParsingAttributes}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleParsePastedAttributes(index)}
                                  disabled={isSaving || isParsingAttributes || !pastedAttributesText.trim()}
                                  className="w-full"
                                >
                                  {isParsingAttributes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                  Parse from Text & Add/Replace
                                </Button>
                              </div>

                              {(step.details.expectedAttributes || []).map((attr: ExpectedReplyAttribute) => (
                                <div key={attr.id} className="flex items-end gap-2 p-2 border rounded-md bg-muted/20">
                                  <div className="flex-1">
                                    <Label htmlFor={`exp-attr-name-${attr.id}`} className="text-xs">Attribute Name</Label>
                                    <Input
                                      id={`exp-attr-name-${attr.id}`}
                                      value={attr.name}
                                      onChange={(e) => handleExpectedReplyAttributeChange(index, attr.id, 'name', e.target.value)}
                                      placeholder="e.g., Framed-IP-Address"
                                      disabled={isSaving}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <Label htmlFor={`exp-attr-value-${attr.id}`} className="text-xs">Expected Value</Label>
                                    <Input
                                      id={`exp-attr-value-${attr.id}`}
                                      value={attr.value}
                                      onChange={(e) => handleExpectedReplyAttributeChange(index, attr.id, 'value', e.target.value)}
                                      placeholder="e.g., 192.168.0.1"
                                      disabled={isSaving}
                                    />
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={() => removeExpectedReplyAttribute(index, attr.id)} className="text-destructive hover:text-destructive h-8 w-8" disabled={isSaving}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                              <Button variant="outline" size="sm" onClick={() => addExpectedReplyAttribute(index)} disabled={isSaving}>
                                <PlusCircle className="mr-2 h-3 w-3" /> Add Expected Attribute Manually
                              </Button>

                              <div className="grid grid-cols-2 gap-2 pt-2">
                                <div><Label>Timeout (ms):</Label><Input type="number" placeholder="3000" value={step.details.timeout || ''} onChange={(e) => handleStepChange(index, 'details', {timeout: parseInt(e.target.value) || undefined })} disabled={isSaving}/></div>
                                <div><Label>Retries:</Label><Input type="number" placeholder="2" value={step.details.retries || ''} onChange={(e) => handleStepChange(index, 'details', {retries: parseInt(e.target.value) || undefined })} disabled={isSaving}/></div>
                              </div>
                            </div>
                          )}

                          {step.type === 'sql' && (
                            <div className="space-y-2 pl-7 text-sm">
                              <Label>SQL Query:</Label><Textarea placeholder="SELECT * FROM users WHERE username = '${user_variable}'" value={step.details.query || ''} onChange={(e) => handleStepChange(index, 'details', {query: e.target.value})} disabled={isSaving}/>
                              <Label>Expected Result (column=value):</Label><Input placeholder="e.g., status=active" value={`${step.details.expect_column || ''}=${step.details.expect_value || ''}`} onChange={(e) => { const parts = e.target.value.split('='); handleStepChange(index, 'details', {expect_column: parts[0], expect_value: parts[1] || ''}) }} disabled={isSaving}/>
                              <Label>DB Connection:</Label><Input placeholder="Default DB (or ID from DB settings)" value={step.details.connection || ''} onChange={(e) => handleStepChange(index, 'details', {connection: e.target.value})} disabled={isSaving}/>
                            </div>
                          )}
                          {step.type === 'delay' && (
                            <div className="space-y-2 pl-7 text-sm">
                              <Label>Duration (ms):</Label><Input type="number" placeholder="1000" value={step.details.duration_ms || ''} onChange={(e) => handleStepChange(index, 'details', {duration_ms: parseInt(e.target.value) || undefined})} disabled={isSaving}/>
                            </div>
                          )}
                          {(step.type === 'loop_start' || step.type === 'conditional_start') && (
                            <div className="space-y-2 pl-7 text-sm">
                              {step.type === 'loop_start' && <div><Label>Iterations:</Label><Input type="number" placeholder="3" value={step.details.iterations || ''} onChange={(e) => handleStepChange(index, 'details', {iterations: parseInt(e.target.value) || undefined})} disabled={isSaving}/></div>}
                              <Label>Condition (Descriptive):</Label><Input placeholder="e.g., ${var_name} == 'value' or response_code == 5" value={step.details.condition || ''} onChange={(e) => handleStepChange(index, 'details', {condition: e.target.value})} disabled={isSaving}/>
                              <p className="text-xs text-muted-foreground">Note: Conditional & loop execution logic is not implemented in this prototype.</p>
                            </div>
                          )}
                          {(step.type === 'loop_end' || step.type === 'conditional_end') && (
                            <p className="pl-7 text-sm text-muted-foreground">Marks the end of the block.</p>
                          )}

                          {step.type === 'api_call' && (
                            <div className="space-y-3 pl-7 text-sm">
                              <div><Label>URL:</Label><Input placeholder="https://api.example.com/data" value={step.details.url || ''} onChange={(e) => handleStepChange(index, 'details', { url: e.target.value })} disabled={isSaving}/></div>
                              <div>
                                <Label>Method:</Label>
                                <Select value={step.details.method || 'GET'} onValueChange={(v) => handleStepChange(index, 'details', {method: v as 'GET' | 'POST'})} disabled={isSaving}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="GET">GET</SelectItem>
                                    <SelectItem value="POST">POST</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                               <div>
                                <Label className="font-medium">Headers:</Label>
                                {(step.details.headers || []).map((header: ApiHeader) => (
                                    <div key={header.id} className="flex items-end gap-2 mt-1 p-2 border rounded-md bg-muted/20">
                                    <div className="flex-1">
                                        <Label htmlFor={`header-name-${header.id}`} className="text-xs">Header Name</Label>
                                        <Input id={`header-name-${header.id}`} value={header.name} onChange={(e) => handleApiHeaderChange(index, header.id, 'name', e.target.value)} placeholder="e.g., Content-Type" disabled={isSaving}/>
                                    </div>
                                    <div className="flex-1">
                                        <Label htmlFor={`header-value-${header.id}`} className="text-xs">Header Value</Label>
                                        <Input id={`header-value-${header.id}`} value={header.value} onChange={(e) => handleApiHeaderChange(index, header.id, 'value', e.target.value)} placeholder="e.g., application/json" disabled={isSaving}/>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => removeApiHeader(index, header.id)} className="text-destructive hover:text-destructive h-8 w-8" disabled={isSaving}><X className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={() => addApiHeader(index)} className="mt-2" disabled={isSaving}><PlusCircle className="mr-2 h-3 w-3" /> Add Header</Button>
                               </div>
                              {step.details.method === 'POST' && (
                                <div><Label>Request Body (JSON):</Label><Textarea placeholder='{ "key": "value" }' value={step.details.requestBody || ''} onChange={(e) => handleStepChange(index, 'details', { requestBody: e.target.value })} rows={3} disabled={isSaving}/></div>
                              )}
                              <div><Label>Mock Response Body (JSON for simulation):</Label><Textarea placeholder='{ "success": true, "data": {} }' value={step.details.mockResponseBody || ''} onChange={(e) => handleStepChange(index, 'details', { mockResponseBody: e.target.value })} rows={3} disabled={isSaving}/></div>
                              <p className="text-xs text-muted-foreground">Note: API calls are simulated in this prototype.</p>
                            </div>
                          )}

                          {step.type === 'log_message' && (
                            <div className="space-y-2 pl-7 text-sm">
                                <Label>Message to Log:</Label>
                                <Textarea placeholder="Enter message. You can use ${variable_name}." value={step.details.message || ''} onChange={(e) => handleStepChange(index, 'details', {message: e.target.value})} rows={2} disabled={isSaving}/>
                            </div>
                          )}

                        </Card>
                      )
                    })}
                    {editingScenario.steps.length === 0 && <p className="text-center text-muted-foreground py-6">No steps defined. Click "Add Step" to begin.</p>}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter className="mt-auto pt-4 border-t flex-shrink-0">
             <Button variant="outline" onClick={handleExportScenario} disabled={!editingScenario || isSaving}>
                <Download className="mr-2 h-4 w-4" /> Export Scenario
            </Button>
            <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
            <Button onClick={handleSaveScenario} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Scenario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE

