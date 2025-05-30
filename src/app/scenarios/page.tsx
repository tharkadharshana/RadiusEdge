
"use client";

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { parseRadiusAttributesFromString, ParseRadiusAttributesInput, ParseRadiusAttributesOutput } from '@/ai/flows/parse-radius-attributes-flow';


type ScenarioStepType = 'radius' | 'sql' | 'delay' | 'loop_start' | 'loop_end' | 'conditional_start' | 'conditional_end' | 'api_call' | 'log_message';

interface ExpectedReplyAttribute {
  id: string;
  name: string;
  value: string;
}

interface ApiHeader {
  id: string;
  name: string;
  value: string;
}

interface ScenarioStep {
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

interface ScenarioVariable {
  id: string;
  name: string;
  type: 'static' | 'random_string' | 'random_number' | 'list';
  value: string;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  variables: ScenarioVariable[];
  steps: ScenarioStep[];
  lastModified: string;
  tags: string[];
}

const initialScenarios: Scenario[] = [
  {
    id: 'scn1',
    name: '3GPP Full Auth Flow',
    description: 'Simulates a complete 3GPP authentication and accounting cycle.',
    variables: [{id: 'var1', name: 'imsi', type: 'random_string', value: '3134600000000[0-9]{3}'}],
    steps: [
      { id: 's1', type: 'radius', name: 'Send Access-Request', details: { packet_id: '3gpp_auth_req', expectedAttributes: [{id: 'exp1_1', name: 'Framed-IP-Address', value: '192.168.1.100'}], timeout: 3000, retries: 2 } },
      { id: 's1_cond_start', type: 'conditional_start', name: 'If Access-Accept Received', details: { condition: "RADIUS_Reply_Code == 'Access-Accept'"}},
      { id: 's2', type: 'sql', name: 'Verify Session Status', details: { query: "SELECT status FROM sessions WHERE imsi = ${imsi}", expect_column: "status", expect_value: "active", connection: "prod_db" } },
      { id: 's2_log', type: 'log_message', name: 'Log Success', details: { message: "IMSI ${imsi} session active in DB."}},
      { id: 's1_cond_end', type: 'conditional_end', name: 'End If', details: {}},
      { id: 's3', type: 'delay', name: 'Wait for Session Duration', details: { duration_ms: 60000 } },
      { id: 's4', type: 'radius', name: 'Send Interim-Update', details: { packet_id: '3gpp_interim_acct', expectedAttributes: [], timeout: 3000, retries: 1 } },
      { id: 's5_api', type: 'api_call', name: 'Notify External System', details: { url: 'https://my.api.example.com/notify', method: 'POST', requestBody: '{ "imsi": "${imsi}", "status": "interim_update_sent"}', headers: [{id: 'header1', name: 'Content-Type', value: 'application/json'}, {id:'header2', name: 'X-API-Key', value: 'mysecretkey'}], mockResponseBody: '{ "status": "received" }' }}
    ],
    lastModified: '2024-07-20',
    tags: ['3GPP', 'E2E', 'Auth', 'Acct']
  },
  {
    id: 'scn2',
    name: 'WiFi EAP-TTLS Authentication',
    description: 'Tests EAP-TTLS authentication for a WiFi hotspot.',
    variables: [],
    steps: [
        { id: 's1_wifi', type: 'radius', name: 'EAP-Start', details: { packet_id: 'eap_start_req', expectedAttributes: [], timeout: 3000, retries: 2 } },
        { id: 's2_wifi', type: 'loop_start', name: 'EAP Exchange Loop', details: { iterations: 5, condition: "response_contains_eap_challenge" } },
        { id: 's3_wifi', type: 'radius', name: 'EAP-Response', details: { packet_id: 'eap_response_phase2', expectedAttributes: [], timeout: 3000, retries: 2 } },
        { id: 's4_wifi', type: 'loop_end', name: 'End EAP Exchange', details: {} },
        { id: 's5_wifi', type: 'radius', name: 'EAP-Success Check', details: { packet_id: '', expectedAttributes: [{id: 'exp2_1', name:'EAP-Type', value: 'Success'}], timeout: 5000, retries: 2 } },
    ],
    lastModified: '2024-07-18',
    tags: ['WiFi', 'EAP', 'Auth']
  },
];

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

export default function ScenariosPage() {
  const searchParams = useSearchParams();
  const [scenarios, setScenarios] = useState<Scenario[]>(initialScenarios);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pastedAttributesText, setPastedAttributesText] = useState('');
  const [isParsingAttributes, setIsParsingAttributes] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const templateId = searchParams.get('template');
    if (templateId) {
      const templateName = templateId === '3gpp-auth' ? '3GPP Authentication (from template)' :
                           templateId === 'wifi-eap' ? 'Wi-Fi EAP-TTLS (from template)' :
                           'New Scenario (from template)';
      createNewScenario(templateName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);


  const filteredScenarios = scenarios.filter(scenario =>
    scenario.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    scenario.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    scenario.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleEditScenario = (scenario: Scenario | null) => {
    setEditingScenario(scenario ? JSON.parse(JSON.stringify(scenario)) : null);
    setPastedAttributesText(''); 
  };

  const handleSaveScenario = () => {
    if (editingScenario) {
      const now = new Date().toISOString().split('T')[0];
      const scenarioToSave = { ...editingScenario, lastModified: now };
      if (editingScenario.id === 'new' || editingScenario.id.startsWith('imported-')) {
        setScenarios(prev => [...prev, { ...scenarioToSave, id: `scn${Date.now()}` }]);
      } else {
        setScenarios(prev => prev.map(s => s.id === editingScenario.id ? scenarioToSave : s));
      }
      handleEditScenario(null);
      toast({ title: "Scenario Saved", description: `Scenario "${scenarioToSave.name}" has been saved.` });
    }
  };

  const createNewScenario = (name = 'New RADIUS Scenario') => {
    handleEditScenario({
      id: 'new',
      name: name,
      description: '',
      variables: [],
      steps: [{ id: `step_new_1`, type: 'radius', name: 'Initial RADIUS Request', details: { packet_id: '', expectedAttributes: [], timeout: 3000, retries: 2 } }],
      lastModified: new Date().toISOString().split('T')[0],
      tags: [],
    });
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
        stepDetails = { packet_id: '', expectedAttributes: [], timeout: 3000, retries: 2 };
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
      console.error("Error parsing attributes:", error);
      toast({ title: "Parsing Failed", description: "Could not parse attributes from text. Please check the format.", variant: "destructive" });
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

        // Basic validation
        if (typeof importedData.name !== 'string' || !Array.isArray(importedData.steps)) {
          throw new Error("Invalid scenario file format. Missing 'name' or 'steps'.");
        }
        
        // Prepare for editing (ensure all necessary fields exist, assign new IDs if needed, etc.)
        const scenarioToEdit: Scenario = {
          id: `imported-${Date.now()}`, 
          name: importedData.name || "Imported Scenario",
          description: importedData.description || "",
          variables: Array.isArray(importedData.variables) ? importedData.variables.map((v: any) => ({
            id: v.id || `var${Date.now()}${Math.random()}`, ...v
          })) : [],
          steps: Array.isArray(importedData.steps) ? importedData.steps.map((s: any) => ({
            id: s.id || `step${Date.now()}${Math.random()}`, ...s,
            details: s.details || {},
            expectedAttributes: Array.isArray(s.details?.expectedAttributes) ? s.details.expectedAttributes.map((ea: any) => ({
              id: ea.id || `exp_attr_${Date.now()}${Math.random()}`, ...ea
            })) : [],
            headers: Array.isArray(s.details?.headers) ? s.details.headers.map((h: any) => ({
              id: h.id || `header_${Date.now()}${Math.random()}`, ...h
            })) : [],
          })) : [],
          lastModified: new Date().toISOString().split('T')[0],
          tags: Array.isArray(importedData.tags) ? importedData.tags : [],
        };

        handleEditScenario(scenarioToEdit);
        toast({ title: "Scenario Imported", description: `Scenario "${scenarioToEdit.name}" loaded into editor. Please review and save.` });

      } catch (error: any) {
        console.error("Error importing scenario:", error);
        toast({ title: "Import Failed", description: error.message || "Could not parse scenario file.", variant: "destructive" });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };


  return (
    <div className="space-y-8">
      <PageHeader
        title="Scenario Builder"
        description="Design complex RADIUS test scenarios. Conditional logic is visual only. API calls are simulated. Step reordering (drag & drop) is not yet implemented."
        actions={
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" />
            <Button variant="outline" onClick={handleImportClick}>
              <Upload className="mr-2 h-4 w-4" /> Import Scenario
            </Button>
            <Button onClick={() => createNewScenario()}>
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
            />
          </div>
        </CardHeader>
        <CardContent>
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
              {filteredScenarios.map((scenario) => (
                <TableRow key={scenario.id}>
                  <TableCell className="font-medium">{scenario.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{scenario.description}</TableCell>
                  <TableCell>{scenario.steps.length}</TableCell>
                   <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {scenario.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>{scenario.lastModified}</TableCell>
                  <TableCell className="text-right">
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditScenario(scenario)}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Play className="mr-2 h-4 w-4" /> Run
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
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
              {filteredScenarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No scenarios found. Try adjusting your search or create a new scenario.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Scenario Editor Dialog */}
      <Dialog open={!!editingScenario} onOpenChange={(isOpen) => !isOpen && handleEditScenario(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingScenario?.id === 'new' || editingScenario?.id.startsWith('imported-') ? 'Create/Edit Scenario' : `Edit Scenario: ${editingScenario?.name}`}</DialogTitle>
            <DialogDescription>
              Define scenario properties, variables, and steps. Conditional logic is visual only. API calls are simulated. Step reordering (drag & drop) is not yet implemented.
            </DialogDescription>
          </DialogHeader>
          {editingScenario && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 py-4 overflow-hidden min-h-0">
              {/* Left Panel: Scenario Details & Variables */}
              <ScrollArea className="md:col-span-1 h-full border rounded-md p-4 bg-muted/20 min-h-0"> 
                <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary"/>Properties</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label htmlFor="scenario-name">Scenario Name</Label>
                        <Input id="scenario-name" value={editingScenario.name} onChange={(e) => setEditingScenario({ ...editingScenario, name: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="scenario-description">Description</Label>
                        <Textarea id="scenario-description" value={editingScenario.description} onChange={(e) => setEditingScenario({ ...editingScenario, description: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="scenario-tags">Tags (comma-separated)</Label>
                        <Input id="scenario-tags" value={editingScenario.tags.join(', ')} onChange={(e) => setEditingScenario({ ...editingScenario, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })} placeholder="e.g., Auth, 3GPP" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Variable className="h-5 w-5 text-primary"/>Variables</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {editingScenario.variables.map((variable, index) => (
                        <Card key={variable.id} className="p-3 bg-card">
                          <div className="flex justify-between items-center mb-1">
                            <Label htmlFor={`var-name-${index}`} className="text-xs font-semibold">Variable {index + 1}</Label>
                            <Button variant="ghost" size="icon" onClick={() => removeVariable(index)} className="h-6 w-6 text-destructive hover:text-destructive">
                                <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Input placeholder="Name" value={variable.name} onChange={(e) => handleVariableChange(index, 'name', e.target.value)} />
                            <Select value={variable.type} onValueChange={(val) => handleVariableChange(index, 'type', val)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="static">Static</SelectItem>
                                <SelectItem value="random_string">Random String</SelectItem>
                                <SelectItem value="random_number">Random Number</SelectItem>
                                <SelectItem value="list">List</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Input className="mt-1" placeholder="Value / Pattern / List (CSV)" value={variable.value} onChange={(e) => handleVariableChange(index, 'value', e.target.value)} />
                        </Card>
                      ))}
                      <Button variant="outline" size="sm" onClick={addVariable} className="w-full"><PlusCircle className="mr-2 h-4 w-4" /> Add Variable</Button>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>

              {/* Right Panel: Scenario Steps */}
              <div className="md:col-span-2 flex flex-col h-full border rounded-md p-4 bg-muted/20 min-h-0 overflow-hidden"> 
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><Workflow className="h-5 w-5 text-primary"/>Scenario Steps</h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Step</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => addStep('radius')}><FileText className="mr-2 h-4 w-4" /> RADIUS Packet</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addStep('sql')}><Database className="mr-2 h-4 w-4" /> SQL Validation</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addStep('delay')}><Clock className="mr-2 h-4 w-4" /> Delay</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addStep('api_call')}><Webhook className="mr-2 h-4 w-4" /> API Call (Simulated)</DropdownMenuItem>
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
                           <Button variant="ghost" size="icon" className={cn("absolute top-2 right-10 text-muted-foreground hover:text-foreground h-7 w-7 opacity-50 group-hover:opacity-100 cursor-grab")} aria-label="Drag to reorder (not implemented)">
                            <GripVertical className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeStep(index)} className="absolute top-2 right-2 text-destructive hover:text-destructive h-7 w-7 opacity-50 group-hover:opacity-100">
                            <X className="h-4 w-4" />
                          </Button>
                          <div className="flex items-center gap-2 mb-2">
                            <StepIcon className="h-5 w-5 text-primary" />
                            <Input value={step.name} onChange={(e) => handleStepChange(index, 'name', e.target.value)} className="text-md font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" />
                          </div>

                          {/* RADIUS Step Details */}
                          {step.type === 'radius' && (
                            <div className="space-y-3 pl-7 text-sm">
                              <div>
                                <Label>Packet Template:</Label>
                                <Select value={step.details.packet_id} onValueChange={(v) => handleStepChange(index, 'details', {packet_id: v})}>
                                  <SelectTrigger><SelectValue placeholder="Select Packet..."/></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pkt1">3GPP Access-Request</SelectItem>
                                    <SelectItem value="pkt2">Cisco VoIP Acc Start</SelectItem>
                                    {/* TODO: Populate from actual packet library */}
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
                                />
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleParsePastedAttributes(index)} 
                                  disabled={isParsingAttributes}
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
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <Label htmlFor={`exp-attr-value-${attr.id}`} className="text-xs">Expected Value</Label>
                                    <Input
                                      id={`exp-attr-value-${attr.id}`}
                                      value={attr.value}
                                      onChange={(e) => handleExpectedReplyAttributeChange(index, attr.id, 'value', e.target.value)}
                                      placeholder="e.g., 192.168.0.1"
                                    />
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={() => removeExpectedReplyAttribute(index, attr.id)} className="text-destructive hover:text-destructive h-8 w-8">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                              <Button variant="outline" size="sm" onClick={() => addExpectedReplyAttribute(index)}>
                                <PlusCircle className="mr-2 h-3 w-3" /> Add Expected Attribute Manually
                              </Button>

                              <div className="grid grid-cols-2 gap-2 pt-2">
                                <div><Label>Timeout (ms):</Label><Input type="number" placeholder="3000" value={step.details.timeout || ''} onChange={(e) => handleStepChange(index, 'details', {timeout: parseInt(e.target.value) || undefined })}/></div>
                                <div><Label>Retries:</Label><Input type="number" placeholder="2" value={step.details.retries || ''} onChange={(e) => handleStepChange(index, 'details', {retries: parseInt(e.target.value) || undefined })}/></div>
                              </div>
                            </div>
                          )}

                          {/* SQL Step Details */}
                          {step.type === 'sql' && (
                            <div className="space-y-2 pl-7 text-sm">
                              <Label>SQL Query:</Label><Textarea placeholder="SELECT * FROM users WHERE username = '${user_variable}'" value={step.details.query || ''} onChange={(e) => handleStepChange(index, 'details', {query: e.target.value})} />
                              <Label>Expected Result (column=value):</Label><Input placeholder="e.g., status=active" value={`${step.details.expect_column || ''}=${step.details.expect_value || ''}`} onChange={(e) => { const parts = e.target.value.split('='); handleStepChange(index, 'details', {expect_column: parts[0], expect_value: parts[1] || ''}) }} />
                              <Label>DB Connection:</Label><Input placeholder="Default DB" value={step.details.connection || ''} onChange={(e) => handleStepChange(index, 'details', {connection: e.target.value})} />
                            </div>
                          )}
                          {step.type === 'delay' && (
                            <div className="space-y-2 pl-7 text-sm">
                              <Label>Duration (ms):</Label><Input type="number" placeholder="1000" value={step.details.duration_ms || ''} onChange={(e) => handleStepChange(index, 'details', {duration_ms: parseInt(e.target.value) || undefined})} />
                            </div>
                          )}
                          {(step.type === 'loop_start' || step.type === 'conditional_start') && (
                            <div className="space-y-2 pl-7 text-sm">
                              {step.type === 'loop_start' && <div><Label>Iterations:</Label><Input type="number" placeholder="3" value={step.details.iterations || ''} onChange={(e) => handleStepChange(index, 'details', {iterations: parseInt(e.target.value) || undefined})} /></div>}
                              <Label>Condition:</Label><Input placeholder="e.g., ${var_name} == 'value' or response_code == 5" value={step.details.condition || ''} onChange={(e) => handleStepChange(index, 'details', {condition: e.target.value})}/>
                              {step.type === 'conditional_start' && <p className="text-xs text-muted-foreground">Note: Conditional execution is visual only in this prototype.</p>}
                            </div>
                          )}
                          {(step.type === 'loop_end' || step.type === 'conditional_end') && (
                            <p className="pl-7 text-sm text-muted-foreground">Marks the end of the block.</p>
                          )}
                          
                          {/* API Call Step Details */}
                          {step.type === 'api_call' && (
                            <div className="space-y-3 pl-7 text-sm">
                              <div><Label>URL:</Label><Input placeholder="https://api.example.com/data" value={step.details.url || ''} onChange={(e) => handleStepChange(index, 'details', { url: e.target.value })}/></div>
                              <div>
                                <Label>Method:</Label>
                                <Select value={step.details.method || 'GET'} onValueChange={(v) => handleStepChange(index, 'details', {method: v as 'GET' | 'POST'})}>
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
                                        <Input id={`header-name-${header.id}`} value={header.name} onChange={(e) => handleApiHeaderChange(index, header.id, 'name', e.target.value)} placeholder="e.g., Content-Type"/>
                                    </div>
                                    <div className="flex-1">
                                        <Label htmlFor={`header-value-${header.id}`} className="text-xs">Header Value</Label>
                                        <Input id={`header-value-${header.id}`} value={header.value} onChange={(e) => handleApiHeaderChange(index, header.id, 'value', e.target.value)} placeholder="e.g., application/json"/>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => removeApiHeader(index, header.id)} className="text-destructive hover:text-destructive h-8 w-8"><X className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={() => addApiHeader(index)} className="mt-2"><PlusCircle className="mr-2 h-3 w-3" /> Add Header</Button>
                               </div>
                              {step.details.method === 'POST' && (
                                <div><Label>Request Body (JSON):</Label><Textarea placeholder='{ "key": "value" }' value={step.details.requestBody || ''} onChange={(e) => handleStepChange(index, 'details', { requestBody: e.target.value })} rows={3}/></div>
                              )}
                              <div><Label>Mock Response Body (JSON for simulation):</Label><Textarea placeholder='{ "success": true, "data": {} }' value={step.details.mockResponseBody || ''} onChange={(e) => handleStepChange(index, 'details', { mockResponseBody: e.target.value })} rows={3}/></div>
                              <p className="text-xs text-muted-foreground">Note: API calls are simulated. No actual HTTP request will be made.</p>
                            </div>
                          )}

                          {/* Log Message Step Details */}
                          {step.type === 'log_message' && (
                            <div className="space-y-2 pl-7 text-sm">
                                <Label>Message to Log:</Label>
                                <Textarea placeholder="Enter message. You can use ${variable_name}." value={step.details.message || ''} onChange={(e) => handleStepChange(index, 'details', {message: e.target.value})} rows={2}/>
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
            <Button variant="outline" onClick={handleExportScenario} disabled={!editingScenario}>
                <Download className="mr-2 h-4 w-4" /> Export Scenario
            </Button>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSaveScenario}><Save className="mr-2 h-4 w-4" /> Save Scenario</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

