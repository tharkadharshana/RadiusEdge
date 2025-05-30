
"use client";

import { useState, useEffect } from 'react'; // Added useEffect
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit3, Trash2, Save, DatabaseZap, TestTube2, MoreHorizontal, Terminal, Settings, GripVertical, PlayCircle, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { testDbValidation, TestDbValidationInput, TestDbValidationOutput, DbValidationStepClient } from '@/ai/flows/test-db-validation-flow';

// Type definitions (ensure these match your backend expectations if they differ)
export type DbStatus = 'connected_validated' | 'connected_issues' | 'connection_error' | 'validation_error' | 'unknown' | 'testing';

export interface DbSshPreambleStepConfig { 
  id: string;
  name: string;
  command: string;
  isEnabled: boolean;
  expectedOutputContains?: string;
}

export interface DbValidationStepConfig {
  id: string;
  name: string;
  type: 'sql' | 'ssh';
  commandOrQuery: string;
  isEnabled: boolean;
  isMandatory: boolean; 
  expectedOutputContains?: string;
}

export interface DbConnectionConfig {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'mssql' | 'sqlite';
  host: string;
  port: number;
  username: string;
  password?: string; 
  databaseName: string;
  status?: DbStatus;
  sshPreambleSteps: DbSshPreambleStepConfig[];
  validationSteps: DbValidationStepConfig[];
}

// Default creation functions remain the same
const getDefaultDbSshPreamble = (): DbSshPreambleStepConfig[] => [
    { id: `db_ssh_pre_${Date.now()}`, name: 'Example: Connect to DB Bastion', command: 'ssh user@db-bastion.example.com', isEnabled: false, expectedOutputContains: "Connected to db-bastion" },
];

const getDefaultDbValidationSteps = (): DbValidationStepConfig[] => [
  { id: `db_val_default_${Date.now()}_1`, name: 'Check Users Table Exists', type: 'sql', commandOrQuery: "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'users_example';", isEnabled: true, isMandatory: true, expectedOutputContains: "1" },
  { id: `db_val_default_${Date.now()}_2`, name: 'Basic Select from Users', type: 'sql', commandOrQuery: "SELECT 1 FROM users_example LIMIT 1;", isEnabled: true, isMandatory: false, expectedOutputContains: "1" },
];


export default function DatabaseValidationPage() {
  const [configs, setConfigs] = useState<DbConnectionConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<DbConnectionConfig | null>(null);
  
  const [isLoading, setIsLoading] = useState(true); // For initial load
  const [isSaving, setIsSaving] = useState(false); // For save operations

  const [testingDbId, setTestingDbId] = useState<string | null>(null);
  const [testDbResult, setTestDbResult] = useState<TestDbValidationOutput | null>(null);
  const [testDbError, setTestDbError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDbConfigs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/database');
      if (!response.ok) {
        throw new Error('Failed to fetch database configurations');
      }
      const data = await response.json();
      setConfigs(data);
    } catch (error) {
      console.error("Error fetching DB configs:", error);
      toast({ title: "Error", description: "Could not fetch database configurations.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDbConfigs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditConfig = (config: DbConnectionConfig | null) => {
    setEditingConfig(config ? JSON.parse(JSON.stringify(config)) : null); 
  };

  const handleSaveConfig = async () => {
    if (!editingConfig) return;
    setIsSaving(true);
    const isNew = editingConfig.id === 'new';
    const url = isNew ? '/api/settings/database' : `/api/settings/database/${editingConfig.id}`;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingConfig),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isNew ? 'create' : 'update'} database configuration`);
      }
      const savedConfig = await response.json();

      if (isNew) {
        setConfigs(prev => [savedConfig, ...prev.filter(c => c.id !== 'new')]);
      } else {
        setConfigs(prev => prev.map(c => c.id === savedConfig.id ? savedConfig : c));
      }
      handleEditConfig(null);
      toast({ title: "Success", description: `Database configuration "${savedConfig.name}" saved.` });
    } catch (error: any) {
      console.error("Error saving DB config:", error);
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!window.confirm("Are you sure you want to delete this database configuration?")) return;
    setIsLoading(true); // Can use a more specific deleting state if needed

    try {
      const response = await fetch(`/api/settings/database/${configId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete database configuration');
      }
      setConfigs(prev => prev.filter(c => c.id !== configId));
      toast({ title: "Success", description: "Database configuration deleted." });
    } catch (error: any) {
      console.error("Error deleting DB config:", error);
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const createNewConfig = () => {
    handleEditConfig({
      id: 'new',
      name: 'New DB Connection',
      type: 'mysql',
      host: '',
      port: 3306,
      username: '',
      password: '',
      databaseName: '',
      status: 'unknown',
      sshPreambleSteps: getDefaultDbSshPreamble(),
      validationSteps: getDefaultDbValidationSteps(),
    });
  };

  // SshPreambleStep and ValidationStep change handlers remain the same
  const handleSshPreambleStepChange = (index: number, field: keyof DbSshPreambleStepConfig, value: any) => {
    if (editingConfig) {
      const updatedSteps = [...editingConfig.sshPreambleSteps];
      if (field === 'isEnabled') {
        (updatedSteps[index] as any)[field] = Boolean(value);
      } else {
        (updatedSteps[index] as any)[field] = value;
      }
      setEditingConfig({ ...editingConfig, sshPreambleSteps: updatedSteps });
    }
  };

  const addSshPreambleStep = () => {
    if (editingConfig) {
      const newStep: DbSshPreambleStepConfig = {
        id: `db_ssh_pre_custom_${Date.now()}`, name: 'New Scenario SSH Step', command: '', isEnabled: true, expectedOutputContains: ''
      };
      setEditingConfig({ ...editingConfig, sshPreambleSteps: [...editingConfig.sshPreambleSteps, newStep] });
    }
  };

  const removeSshPreambleStep = (index: number) => {
    if (editingConfig) {
      setEditingConfig({ ...editingConfig, sshPreambleSteps: editingConfig.sshPreambleSteps.filter((_, i) => i !== index) });
    }
  };

  const handleValidationStepChange = (index: number, field: keyof DbValidationStepConfig, value: any) => {
    if (editingConfig) {
      const updatedSteps = [...editingConfig.validationSteps];
      if (field === 'isEnabled' || field === 'isMandatory') { 
        (updatedSteps[index] as any)[field] = Boolean(value);
      } else if (field === 'type') {
         (updatedSteps[index] as any)[field] = value;
         updatedSteps[index].commandOrQuery = ""; // Reset command/query on type change
         updatedSteps[index].expectedOutputContains = ""; // Reset expected output on type change
      }
      else {
        (updatedSteps[index] as any)[field] = value;
      }
      setEditingConfig({ ...editingConfig, validationSteps: updatedSteps });
    }
  };
  
  const addValidationStep = (type: 'sql' | 'ssh' = 'sql') => {
    if (editingConfig) {
      const newStep: DbValidationStepConfig = {
        id: `db_val_custom_${Date.now()}`, 
        name: type === 'sql' ? 'New SQL Validation Step' : 'New SSH Command Step', 
        type, 
        commandOrQuery: '', 
        isEnabled: true, 
        isMandatory: false, 
        expectedOutputContains: ''
      };
      setEditingConfig({ ...editingConfig, validationSteps: [...editingConfig.validationSteps, newStep] });
    }
  };

  const removeValidationStep = (index: number) => {
    if (editingConfig && !editingConfig.validationSteps[index].isMandatory) {
      setEditingConfig({ ...editingConfig, validationSteps: editingConfig.validationSteps.filter((_, i) => i !== index) });
    }
  };


  const handleTestDb = async (configToTest: DbConnectionConfig) => {
    setTestingDbId(configToTest.id);
    setTestDbResult(null);
    setTestDbError(null);
    setConfigs(prev => prev.map(c => c.id === configToTest.id ? { ...c, status: 'testing' } : c));

    try {
        const validationClientSteps: DbValidationStepClient[] = configToTest.validationSteps.map(s => ({
            name: s.name, type: s.type, commandOrQuery: s.commandOrQuery, isEnabled: s.isEnabled, isMandatory: s.isMandatory, expectedOutputContains: s.expectedOutputContains
        }));

        const input: TestDbValidationInput = {
            id: configToTest.id,
            dbType: configToTest.type,
            dbHost: configToTest.host,
            dbPort: configToTest.port,
            dbUsername: configToTest.username,
            dbPassword: configToTest.password || '', 
            dbName: configToTest.databaseName,
            validationSteps: validationClientSteps,
        };
        const result = await testDbValidation(input);
        setTestDbResult(result);

        let newStatus: DbStatus = 'unknown';
        if (result.overallStatus === 'success') newStatus = 'connected_validated';
        else if (result.overallStatus === 'partial_success') newStatus = 'connected_issues';
        else if (result.overallStatus === 'connection_failure') newStatus = 'connection_error';
        else if (result.overallStatus === 'validation_failure') newStatus = 'validation_error';
        
        // Update the config with the new status and save it to backend
        const updatedConfigForSave = { ...configToTest, status: newStatus };
        const response = await fetch(`/api/settings/database/${configToTest.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedConfigForSave),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update DB config status after test');
        }
        const savedConfigWithStatus = await response.json();
        setConfigs(prev => prev.map(c => c.id === savedConfigWithStatus.id ? savedConfigWithStatus : c));
        toast({ title: "DB Test Complete", description: `Test for ${configToTest.name} finished. Status: ${newStatus.replace(/_/g, ' ')}.` });

    } catch (error) {
        console.error("Error testing DB connection/validation or saving:", error);
        setTestDbError(error instanceof Error ? error.message : "An unknown error occurred during the DB test.");
        setConfigs(prev => prev.map(c => c.id === configToTest.id ? { ...c, status: configToTest.status || 'unknown' } : c)); // Revert to original or unknown
        toast({ title: "DB Test Failed", description: (error as Error).message || "Could not run the DB connection/validation test.", variant: "destructive" });
    } finally {
        // No longer setting testingDbId to null here, result dialog handles its own visibility
    }
  };

  const getDbStatusBadge = (status?: DbStatus) => {
    switch (status) {
      case 'connected_validated': return <Badge className="bg-green-100 text-green-700 border-green-300 dark:bg-green-700/30 dark:text-green-300 dark:border-green-600">Validated</Badge>;
      case 'connected_issues': return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-700/30 dark:text-yellow-300 dark:border-yellow-600">Issues</Badge>;
      case 'connection_error': return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-700/30 dark:text-red-300 dark:border-red-600">Connection Error</Badge>;
      case 'validation_error': return <Badge variant="destructive" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-700/30 dark:text-orange-300 dark:border-orange-600">Validation Error</Badge>;
      case 'testing': return <Badge variant="outline" className="text-blue-600 border-blue-400 dark:text-blue-400 dark:border-blue-500"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Testing...</Badge>;
      case 'unknown': default: return <Badge variant="outline">Unknown</Badge>;
    }
  };


  return (
    <div className="space-y-8">
      <PageHeader
        title="Database Validation Setup"
        description="Configure DB connections for result validation. Scenario SSH preambles are for scenario execution."
        actions={
          <Button onClick={createNewConfig} disabled={isLoading || isSaving}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add DB Connection
          </Button>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Configured Database Connections</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !configs.length ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading database configurations...</p>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Host:Port</TableHead>
                <TableHead>Database</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.name}</TableCell>
                  <TableCell><Badge variant="outline">{config.type.toUpperCase()}</Badge></TableCell>
                  <TableCell>{config.host}:{config.port}</TableCell>
                  <TableCell>{config.databaseName}</TableCell>
                  <TableCell>{getDbStatusBadge(config.status)}</TableCell>
                  <TableCell className="text-right">
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={testingDbId === config.id || isSaving}>
                           {testingDbId === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditConfig(config)} disabled={!!testingDbId || isSaving}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTestDb(config)} disabled={!!testingDbId || isSaving}>
                          <TestTube2 className="mr-2 h-4 w-4" /> Test Connection & Validation
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteConfig(config.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={!!testingDbId || isSaving}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && configs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No database configurations found. Click "Add DB Connection" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {/* DB Config Editor Dialog */}
      <Dialog open={!!editingConfig} onOpenChange={(isOpen) => !isOpen && handleEditConfig(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <DatabaseZap className="h-6 w-6 text-primary" />
                {editingConfig?.id === 'new' ? 'Add New Database Connection' : `Edit Connection: ${editingConfig?.name}`}
            </DialogTitle>
            <DialogDescription>
              Configure DB details. The Validation Sequence tests the DB directly. Scenario SSH Preamble is for use by scenarios.
            </DialogDescription>
          </DialogHeader>
          {editingConfig && (
            <ScrollArea className="max-h-[75vh] pr-2 -mr-6 pl-1">
            <div className="space-y-6 py-4 pr-4">
              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">Basic Connection Details</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <Label htmlFor="db-name">Connection Name</Label>
                        <Input id="db-name" value={editingConfig.name} onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })} placeholder="e.g., Main User DB" disabled={isSaving} />
                    </div>
                    <div>
                        <Label htmlFor="db-type">Database Type</Label>
                        <Select value={editingConfig.type} onValueChange={(value) => setEditingConfig({ ...editingConfig, type: value as DbConnectionConfig['type'] })} disabled={isSaving}>
                        <SelectTrigger id="db-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="mysql">MySQL</SelectItem>
                            <SelectItem value="postgresql">PostgreSQL</SelectItem>
                            <SelectItem value="mssql">MS SQL Server</SelectItem>
                            <SelectItem value="sqlite">SQLite</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="db-host">Hostname or IP Address</Label>
                        <Input id="db-host" value={editingConfig.host} onChange={(e) => setEditingConfig({ ...editingConfig, host: e.target.value })} placeholder="db.example.com" disabled={isSaving} />
                    </div>
                    <div>
                        <Label htmlFor="db-port">Port</Label>
                        <Input id="db-port" type="number" value={editingConfig.port} onChange={(e) => setEditingConfig({ ...editingConfig, port: parseInt(e.target.value) || 3306 })} disabled={isSaving} />
                    </div>
                    <div>
                        <Label htmlFor="db-username">Username</Label>
                        <Input id="db-username" value={editingConfig.username} onChange={(e) => setEditingConfig({ ...editingConfig, username: e.target.value })} disabled={isSaving} />
                    </div>
                    <div>
                        <Label htmlFor="db-password">Password</Label>
                        <Input id="db-password" type="password" value={editingConfig.password || ''} onChange={(e) => setEditingConfig({...editingConfig, password: e.target.value})} placeholder="Enter DB password" disabled={isSaving} />
                    </div>
                    <div className="md:col-span-2">
                        <Label htmlFor="db-databaseName">Database Name</Label>
                        <Input id="db-databaseName" value={editingConfig.databaseName} onChange={(e) => setEditingConfig({ ...editingConfig, databaseName: e.target.value })} placeholder="e.g., radius_data" disabled={isSaving} />
                    </div>
                </div>
              </fieldset>

              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">Scenario SSH Preamble (Simulated - for scenarios using this DB)</legend>
                <p className="text-xs text-muted-foreground mt-1 mb-3">Define SSH commands to run before scenarios access this database (e.g., for bastion hosts, tunnels). Not used by 'Test Connection & Validation'.</p>
                <div className="space-y-3">
                  {(editingConfig.sshPreambleSteps || []).map((step, index) => (
                    <Card key={step.id} className="p-3 bg-muted/50 dark:bg-muted/20">
                      <div className="flex items-center justify-between mb-2">
                        <Input value={step.name} onChange={(e) => handleSshPreambleStepChange(index, 'name', e.target.value)} className="text-sm font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent flex-grow min-w-0" placeholder="Preamble Step Name" disabled={isSaving}/>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Switch id={`preamble-enabled-${index}`} checked={step.isEnabled} onCheckedChange={(checked) => handleSshPreambleStepChange(index, 'isEnabled', checked)} aria-label="Enable preamble step" disabled={isSaving}/>
                          <Button variant="ghost" size="icon" onClick={() => removeSshPreambleStep(index)} className="text-destructive hover:text-destructive h-7 w-7" disabled={isSaving}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <Label htmlFor={`preamble-cmd-${index}`} className="text-xs text-muted-foreground">SSH Command</Label>
                      <Textarea id={`preamble-cmd-${index}`} value={step.command} onChange={(e) => handleSshPreambleStepChange(index, 'command', e.target.value)} rows={1} className="font-mono text-xs mt-1" placeholder="e.g., ssh user@bastion.example.com" disabled={isSaving}/>
                      <Label htmlFor={`preamble-expect-${index}`} className="text-xs text-muted-foreground mt-2">Expected Output Contains (Optional)</Label>
                      <Input id={`preamble-expect-${index}`} value={step.expectedOutputContains || ''} onChange={(e) => handleSshPreambleStepChange(index, 'expectedOutputContains', e.target.value)} className="font-mono text-xs mt-1" placeholder="e.g., 'Connection established'" disabled={isSaving}/>
                    </Card>
                  ))}
                  <Button variant="outline" size="sm" onClick={addSshPreambleStep} className="w-full" disabled={isSaving}><PlusCircle className="mr-2 h-4 w-4" /> Add Scenario SSH Step</Button>
                </div>
              </fieldset>
              
              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1 flex justify-between items-center w-full">
                    <span>Validation Sequence (Simulated - for 'Test Connection & Validation')</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => addValidationStep('sql')} disabled={isSaving}><PlusCircle className="mr-2 h-4 w-4" /> Add SQL Step</Button>
                        <Button variant="outline" size="sm" onClick={() => addValidationStep('ssh')} disabled={isSaving}><PlusCircle className="mr-2 h-4 w-4" /> Add SSH (DB Host) Step</Button>
                    </div>
                </legend>
                <div className="space-y-3 mt-3">
                  {editingConfig.validationSteps.map((step, index) => (
                    <Card key={step.id} className="p-3 bg-muted/50 dark:bg-muted/20">
                      <div className="flex items-center justify-between mb-2">
                        <Input value={step.name} onChange={(e) => handleValidationStepChange(index, 'name', e.target.value)} className="text-sm font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent" placeholder="Validation Step Name" disabled={isSaving}/>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{step.type.toUpperCase()}</Badge>
                          {step.isMandatory && <Badge variant="secondary" className="text-xs">Mandatory</Badge>}
                          <Switch id={`val-step-enabled-${index}`} checked={step.isEnabled} onCheckedChange={(checked) => handleValidationStepChange(index, 'isEnabled', checked)} disabled={step.isMandatory || isSaving} aria-label="Enable validation step"/>
                          {!step.isMandatory && <Button variant="ghost" size="icon" onClick={() => removeValidationStep(index)} className="text-destructive hover:text-destructive h-7 w-7" disabled={isSaving}><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      </div>
                      <Label htmlFor={`val-step-cmd-${index}`} className="text-xs text-muted-foreground">{step.type === 'sql' ? 'SQL Query' : 'SSH Command (on DB host)'}</Label>
                      <Textarea id={`val-step-cmd-${index}`} value={step.commandOrQuery} onChange={(e) => handleValidationStepChange(index, 'commandOrQuery', e.target.value)} rows={step.type === 'sql' ? 2 : 1} className="font-mono text-xs mt-1" placeholder={step.type === 'sql' ? "SELECT * FROM sessions WHERE id = '...'" : "grep 'ERROR' /var/log/db.log"} disabled={isSaving}/>
                      <Label htmlFor={`val-step-expect-${index}`} className="text-xs text-muted-foreground mt-2">Expected Output Contains (Optional)</Label>
                      <Input id={`val-step-expect-${index}`} value={step.expectedOutputContains || ''} onChange={(e) => handleValidationStepChange(index, 'expectedOutputContains', e.target.value)} className="font-mono text-xs mt-1" placeholder={step.type === 'sql' ? "e.g., 'status=active' or '1 rows selected'" : "e.g., 'script_completed_successfully'"} disabled={isSaving}/>
                    </Card>
                  ))}
                </div>
              </fieldset>

            </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
            <Button onClick={handleSaveConfig} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test DB Validation Result Dialog */}
      <Dialog open={!!(testingDbId && (testDbResult || testDbError))} onOpenChange={(isOpen) => {
        if (!isOpen) { setTestingDbId(null); setTestDbResult(null); setTestDbError(null); }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>DB Test Results: {configs.find(c => c.id === testingDbId)?.name}</DialogTitle>
            <DialogDescription>
              Showing results of the DB connection and validation sequence.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4 py-4">
            {testDbError && (
              <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-md">
                <h3 className="font-semibold flex items-center gap-2"><AlertTriangle />Error Running Test:</h3>
                <p>{testDbError}</p>
              </div>
            )}
            {testDbResult && (
              <div className="space-y-4">
                <div><span className="font-semibold">Overall Status:</span> <Badge variant={
                    testDbResult.overallStatus === 'success' ? 'default' : 
                    testDbResult.overallStatus === 'connection_failure' || testDbResult.overallStatus === 'validation_failure' ? 'destructive' :
                    'secondary'
                } className={cn(
                    testDbResult.overallStatus === 'success' && 'bg-green-500 hover:bg-green-600 text-primary-foreground',
                    (testDbResult.overallStatus === 'connection_failure' || testDbResult.overallStatus === 'validation_failure') && 'bg-red-500 hover:bg-red-600 text-destructive-foreground',
                    testDbResult.overallStatus === 'partial_success' && 'bg-yellow-500 hover:bg-yellow-600 text-primary-foreground'
                )}>{testDbResult.overallStatus.replace(/_/g, ' ').toUpperCase()}</Badge></div>

                <Card><CardHeader><CardTitle className="text-lg">Database Connection</CardTitle></CardHeader>
                <CardContent>
                    <p className={cn(testDbResult.dbConnectionStatus === 'success' ? "text-green-600" : "text-red-600")}>
                        DB Connection: <span className="font-semibold">{testDbResult.dbConnectionStatus.toUpperCase()}</span>
                        {testDbResult.dbConnectionError && <span className="ml-2 text-sm">({testDbResult.dbConnectionError})</span>}
                    </p>
                </CardContent></Card>
                
                {testDbResult.validationStepResults && testDbResult.validationStepResults.length > 0 && (
                     <Card><CardHeader><CardTitle className="text-lg">Validation Steps</CardTitle></CardHeader>
                     <CardContent className="space-y-2">
                    {testDbResult.validationStepResults.map((step, idx) => (
                        <Card key={`val-${idx}`} className="overflow-hidden">
                            <CardHeader className={cn("p-3 flex flex-row items-center justify-between", step.status === 'success' && 'bg-green-500/10', step.status === 'failure' && 'bg-red-500/10', step.status === 'skipped' && 'bg-gray-500/10')}>
                                <div className="flex items-center gap-2"><h4 className="font-medium">{step.stepName} <Badge variant="outline" className="text-xs">{step.type?.toUpperCase()}</Badge></h4></div>
                                <Badge variant={step.status === 'success' ? 'default' : step.status === 'failure' ? 'destructive' : 'outline'} className={cn(step.status === 'success' && 'bg-green-600 text-primary-foreground', step.status === 'failure' && 'bg-red-600 text-destructive-foreground')}>{step.status}</Badge>
                            </CardHeader>
                            {(step.output || step.error || (step.type === 'sql' ? step.query : step.command) ) && 
                                <CardContent className="p-3 text-xs bg-muted/30">
                                    <p className="text-muted-foreground font-mono mb-1">{step.type === 'sql' ? 'Query' : 'Command'}: <code className="text-foreground bg-background/50 px-1 rounded">{step.type === 'sql' ? step.query : step.command}</code></p>
                                    {step.output && <pre className="whitespace-pre-wrap font-mono bg-background p-2 rounded max-h-40 overflow-y-auto">{step.output}</pre>}
                                    {step.error && <pre className="whitespace-pre-wrap font-mono text-red-600 bg-red-500/10 p-2 rounded mt-1">{step.error}</pre>}
                                </CardContent>
                            }
                        </Card>
                    ))}
                    </CardContent></Card>
                )}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild><Button>Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

