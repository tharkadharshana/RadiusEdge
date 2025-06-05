
"use client";

import { useState, useEffect } from 'react'; 
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit3, Trash2, Save, DatabaseZap, TestTube2, MoreHorizontal, Terminal, Settings, GripVertical, PlayCircle, CheckCircle, XCircle, AlertTriangle, Loader2, KeyRound } from 'lucide-react';
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
import { testDbValidation, TestDbValidationInput, TestDbValidationOutput, DbValidationStepClient, DbSshPreambleStepConfigClient } from '@/ai/flows/test-db-validation-flow';

export type DbStatus = 'connected_validated' | 'connected_issues' | 'connection_error' | 'validation_error' | 'unknown' | 'testing' | 'jump_server_connection_failure' | 'preamble_failure';


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
  // Jump Server Details
  jumpServerHost?: string;
  jumpServerPort?: number;
  jumpServerUser?: string;
  jumpServerAuthMethod?: 'key' | 'password';
  jumpServerPrivateKey?: string;
  jumpServerPassword?: string;
  // Target DB Server Details (accessed from jump server or directly)
  host: string;
  port: number;
  username: string;
  password?: string; 
  databaseName: string;
  status?: DbStatus;
  sshPreambleSteps: DbSshPreambleStepConfig[]; // For scenarios using this DB config (e.g. if DB itself needs an SSH tunnel setup by scenario)
  directTestSshPreamble?: DbSshPreambleStepConfig[]; // For "Test Connection & Validation" - these run on the jump server.
  validationSteps: DbValidationStepConfig[]; // For "Test Connection & Validation" - these run against target DB or on target DB host.
}

const getDefaultDbSshPreamble = (): DbSshPreambleStepConfig[] => [
    { id: `db_ssh_pre_scenario_${Date.now()}`, name: 'Example: Scenario SSH Step (e.g. Tunnel)', command: 'ssh -L 3307:${target_db_host}:3306 user@scenario-bastion.example.com -N -f', isEnabled: false, expectedOutputContains: "" },
];
const getDefaultDirectTestSshPreamble = (): DbSshPreambleStepConfig[] => [ // These run on the Jump Server
    { id: `db_ssh_pre_direct_test_${Date.now()}`, name: 'Example: Check Jump Server Connectivity', command: 'ping -c 1 google.com', isEnabled: false, expectedOutputContains: "1 packets transmitted" },
];


const getDefaultDbValidationSteps = (): DbValidationStepConfig[] => [
  { id: `db_val_default_${Date.now()}_1`, name: 'Check Users Table Exists', type: 'sql', commandOrQuery: "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'users_example';", isEnabled: true, isMandatory: true, expectedOutputContains: "1" },
  { id: `db_val_default_${Date.now()}_2`, name: 'Basic Select from Users', type: 'sql', commandOrQuery: "SELECT 1 FROM users_example LIMIT 1;", isEnabled: true, isMandatory: false, expectedOutputContains: "1" },
];


export default function DatabaseValidationPage() {
  const [configs, setConfigs] = useState<DbConnectionConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<DbConnectionConfig | null>(null);
  
  const [isLoading, setIsLoading] = useState(true); 
  const [isSaving, setIsSaving] = useState(false); 

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
    setIsLoading(true); 

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
      // Jump Server
      jumpServerHost: '',
      jumpServerPort: 22,
      jumpServerUser: '',
      jumpServerAuthMethod: 'key',
      jumpServerPrivateKey: '',
      jumpServerPassword: '',
      // Target DB
      host: '',
      port: 3306,
      username: '',
      password: '',
      databaseName: '',
      status: 'unknown',
      sshPreambleSteps: getDefaultDbSshPreamble(), // For scenarios using this DB
      directTestSshPreamble: getDefaultDirectTestSshPreamble(), // For "Test Connection" - runs on Jump Server
      validationSteps: getDefaultDbValidationSteps(),
    });
  };

  const handleDbSshPreambleStepChange = (
    listName: 'sshPreambleSteps' | 'directTestSshPreamble',
    index: number,
    field: keyof DbSshPreambleStepConfig,
    value: any
  ) => {
    if (editingConfig) {
      const currentList = editingConfig[listName] || [];
      const updatedSteps = [...currentList];
      if (field === 'isEnabled') {
        (updatedSteps[index] as any)[field] = Boolean(value);
      } else {
        (updatedSteps[index] as any)[field] = value;
      }
      setEditingConfig({ ...editingConfig, [listName]: updatedSteps });
    }
  };

  const addDbSshPreambleStep = (listName: 'sshPreambleSteps' | 'directTestSshPreamble') => {
    if (editingConfig) {
      const newStep: DbSshPreambleStepConfig = {
        id: `db_ssh_custom_${listName}_${Date.now()}`, name: 'New SSH Step', command: '', isEnabled: true, expectedOutputContains: ''
      };
      const currentList = editingConfig[listName] || [];
      setEditingConfig({ ...editingConfig, [listName]: [...currentList, newStep] });
    }
  };

  const removeDbSshPreambleStep = (listName: 'sshPreambleSteps' | 'directTestSshPreamble', index: number) => {
    if (editingConfig) {
      const currentList = editingConfig[listName] || [];
      setEditingConfig({ ...editingConfig, [listName]: currentList.filter((_, i) => i !== index) });
    }
  };


  const handleValidationStepChange = (index: number, field: keyof DbValidationStepConfig, value: any) => {
    if (editingConfig) {
      const updatedSteps = [...editingConfig.validationSteps];
      if (field === 'isEnabled' || field === 'isMandatory') { 
        (updatedSteps[index] as any)[field] = Boolean(value);
      } else if (field === 'type') {
         (updatedSteps[index] as any)[field] = value;
         updatedSteps[index].commandOrQuery = ""; 
         updatedSteps[index].expectedOutputContains = ""; 
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
        name: type === 'sql' ? 'New SQL Validation Step' : 'New SSH Command Step (on DB Host)', 
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
        
        const directTestPreambleClientSteps: DbSshPreambleStepConfigClient[] | undefined = configToTest.directTestSshPreamble?.map(s => ({
            id: s.id, name: s.name, command: s.command, isEnabled: s.isEnabled, expectedOutputContains: s.expectedOutputContains
        }));


        const input: TestDbValidationInput = {
            id: configToTest.id,
            // Jump Server Details
            jumpServerHost: configToTest.jumpServerHost,
            jumpServerPort: configToTest.jumpServerPort,
            jumpServerUser: configToTest.jumpServerUser,
            jumpServerAuthMethod: configToTest.jumpServerAuthMethod,
            jumpServerPrivateKey: configToTest.jumpServerPrivateKey,
            jumpServerPassword: configToTest.jumpServerPassword,
            // Target DB Details
            dbType: configToTest.type,
            dbHost: configToTest.host,
            dbPort: configToTest.port,
            dbUsername: configToTest.username,
            dbPassword: configToTest.password || '', 
            dbName: configToTest.databaseName,
            // Steps
            directTestSshPreamble: directTestPreambleClientSteps, // Runs on Jump Server
            validationSteps: validationClientSteps, // Runs against target DB or on target DB host
        };
        const result = await testDbValidation(input);
        setTestDbResult(result);

        let newStatus: DbStatus = 'unknown';
        if (result.overallStatus === 'success') newStatus = 'connected_validated';
        else if (result.overallStatus === 'jump_server_connection_failure') newStatus = 'jump_server_connection_failure';
        else if (result.overallStatus === 'preamble_failure') newStatus = 'preamble_failure'; // Jump Server Preamble Failed
        else if (result.overallStatus === 'connection_failure') newStatus = 'connection_error'; // Target DB Connection Failed
        else if (result.overallStatus === 'validation_failure') newStatus = 'validation_error'; // Target DB Validation Failed
        else if (result.overallStatus === 'partial_success') newStatus = 'connected_issues';
        
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
        setConfigs(prev => prev.map(c => c.id === configToTest.id ? { ...c, status: configToTest.status || 'unknown' } : c)); 
        toast({ title: "DB Test Failed", description: (error as Error).message || "Could not run the DB connection/validation test.", variant: "destructive" });
    }
  };

  const getDbStatusBadge = (status?: DbStatus) => {
    switch (status) {
      case 'connected_validated': return <Badge className="bg-green-100 text-green-700 border-green-300 dark:bg-green-700/30 dark:text-green-300 dark:border-green-600">Validated</Badge>;
      case 'connected_issues': return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-700/30 dark:text-yellow-300 dark:border-yellow-600">Issues</Badge>;
      case 'jump_server_connection_failure': return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-700/30 dark:text-red-300 dark:border-red-600">Jump Server Error</Badge>;
      case 'preamble_failure': return <Badge variant="destructive" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-700/30 dark:text-orange-300 dark:border-orange-600">Preamble Error</Badge>;
      case 'connection_error': return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-700/30 dark:text-red-300 dark:border-red-600">DB Connection Error</Badge>;
      case 'validation_error': return <Badge variant="destructive" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-700/30 dark:text-orange-300 dark:border-orange-600">Validation Error</Badge>;
      case 'testing': return <Badge variant="outline" className="text-blue-600 border-blue-400 dark:text-blue-400 dark:border-blue-500"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Testing...</Badge>;
      case 'unknown': default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const renderDbSshPreambleList = (
    listName: 'sshPreambleSteps' | 'directTestSshPreamble',
    title: string,
    description: string
  ) => (
    <fieldset className="border p-4 rounded-md">
        <legend className="text-sm font-medium px-1 flex justify-between items-center w-full">
            <span>{title}</span>
            <Button variant="outline" size="sm" onClick={() => addDbSshPreambleStep(listName)} className="ml-auto" disabled={isSaving}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add SSH Step
            </Button>
        </legend>
        <p className="text-xs text-muted-foreground mt-1 mb-3">{description}</p>
        <div className="space-y-3">
            {(editingConfig?.[listName] || []).map((step, index) => (
                <Card key={step.id} className="p-3 bg-muted/50 dark:bg-muted/20">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-grow">
                            <Terminal className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                            <Input
                                value={step.name}
                                onChange={(e) => handleDbSshPreambleStepChange(listName, index, 'name', e.target.value)}
                                className="text-sm font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent flex-grow min-w-0"
                                placeholder="SSH Step Name"
                                disabled={isSaving}
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Switch
                                id={`${listName}-enabled-${index}`}
                                checked={step.isEnabled}
                                onCheckedChange={(checked) => handleDbSshPreambleStepChange(listName, index, 'isEnabled', checked)}
                                aria-label="Enable SSH step"
                                disabled={isSaving}
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeDbSshPreambleStep(listName, index)} className="text-destructive hover:text-destructive h-7 w-7" disabled={isSaving}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor={`${listName}-cmd-${index}`} className="text-xs text-muted-foreground">SSH Command</Label>
                        <Textarea
                            id={`${listName}-cmd-${index}`}
                            value={step.command}
                            onChange={(e) => handleDbSshPreambleStepChange(listName, index, 'command', e.target.value)}
                            rows={1}
                            className="font-mono text-xs mt-1"
                            placeholder="e.g., ssh user@bastion.example.com"
                            disabled={isSaving}
                        />
                    </div>
                    <div className="mt-2">
                        <Label htmlFor={`${listName}-expect-${index}`} className="text-xs text-muted-foreground">Expected Output Contains (Optional)</Label>
                        <Input
                            id={`${listName}-expect-${index}`}
                            value={step.expectedOutputContains || ''}
                            onChange={(e) => handleDbSshPreambleStepChange(listName, index, 'expectedOutputContains', e.target.value)}
                            className="font-mono text-xs mt-1"
                            placeholder="e.g., 'Connection established' or 'Login successful'"
                            disabled={isSaving}
                        />
                    </div>
                </Card>
            ))}
            {(editingConfig?.[listName]?.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-2">No SSH preamble steps defined for this section.</p>
            )}
        </div>
    </fieldset>
  );


  return (
    <div className="space-y-8">
      <PageHeader
        title="Database Validation Setup"
        description="Configure DB connections. For Jump Server setups, provide Jump Server SSH details. 'Direct Test SSH Preamble' runs on the Jump Server. 'Scenario SSH Preamble' is for scenario-specific SSH (e.g., tunnels)."
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
                <TableHead>DB Host (from Jump)</TableHead>
                <TableHead>Jump Server</TableHead>
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
                  <TableCell>{config.jumpServerHost ? `${config.jumpServerHost}:${config.jumpServerPort || 22}` : 'Direct'}</TableCell>
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

      <Dialog open={!!editingConfig} onOpenChange={(isOpen) => !isOpen && handleEditConfig(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <DatabaseZap className="h-6 w-6 text-primary" />
                {editingConfig?.id === 'new' ? 'Add New Database Connection' : `Edit Connection: ${editingConfig?.name}`}
            </DialogTitle>
            <DialogDescription>
              Configure Jump Server (if any) and Target Database details.
            </DialogDescription>
          </DialogHeader>
          {editingConfig && (
            <ScrollArea className="max-h-[75vh] pr-2 -mr-6 pl-1">
            <div className="space-y-6 py-4 pr-4">
              <fieldset className="border p-4 rounded-md">
                  <legend className="text-sm font-medium px-1">Connection Name & Type</legend>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <Label htmlFor="db-conn-name">Connection Name</Label>
                        <Input id="db-conn-name" value={editingConfig.name} onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })} placeholder="e.g., Main User DB" disabled={isSaving} />
                    </div>
                    <div>
                        <Label htmlFor="db-type">Target Database Type</Label>
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
                  </div>
              </fieldset>

              <fieldset className="border p-4 rounded-md">
                  <legend className="text-sm font-medium px-1">Jump Server SSH Details (Optional)</legend>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div>
                            <Label htmlFor="jump-server-host">Jump Server Host</Label>
                            <Input id="jump-server-host" value={editingConfig.jumpServerHost || ''} onChange={(e) => setEditingConfig({ ...editingConfig, jumpServerHost: e.target.value })} placeholder="jump.example.com" disabled={isSaving}/>
                        </div>
                        <div>
                            <Label htmlFor="jump-server-port">Jump Server SSH Port</Label>
                            <Input id="jump-server-port" type="number" value={editingConfig.jumpServerPort || 22} onChange={(e) => setEditingConfig({ ...editingConfig, jumpServerPort: parseInt(e.target.value) || 22 })} disabled={isSaving}/>
                        </div>
                        <div>
                            <Label htmlFor="jump-server-user">Jump Server SSH User</Label>
                            <Input id="jump-server-user" value={editingConfig.jumpServerUser || ''} onChange={(e) => setEditingConfig({ ...editingConfig, jumpServerUser: e.target.value })} disabled={isSaving}/>
                        </div>
                        <div>
                            <Label htmlFor="jump-auth-method">Jump Server Auth Method</Label>
                            <Select value={editingConfig.jumpServerAuthMethod || 'key'} onValueChange={(value) => setEditingConfig({ ...editingConfig, jumpServerAuthMethod: value as 'key' | 'password' })} disabled={isSaving}>
                                <SelectTrigger id="jump-auth-method"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                <SelectItem value="key">SSH Key</SelectItem>
                                <SelectItem value="password">Password</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {editingConfig.jumpServerAuthMethod === 'key' ? (
                            <div className="md:col-span-2">
                                <Label htmlFor="jump-ssh-key">Jump Server Private Key</Label>
                                <Textarea id="jump-ssh-key" value={editingConfig.jumpServerPrivateKey || ''} onChange={(e) => setEditingConfig({...editingConfig, jumpServerPrivateKey: e.target.value})} placeholder="Paste private key for jump server" rows={3} disabled={isSaving}/>
                            </div>
                        ) : (
                            <div>
                                <Label htmlFor="jump-ssh-password">Jump Server Password</Label>
                                <Input id="jump-ssh-password" type="password" value={editingConfig.jumpServerPassword || ''} onChange={(e) => setEditingConfig({...editingConfig, jumpServerPassword: e.target.value})} placeholder="Enter jump server SSH password" disabled={isSaving}/>
                            </div>
                        )}
                  </div>
              </fieldset>


              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">Target Database Details (Accessed from Jump Server or Directly)</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <Label htmlFor="db-host">Target DB Hostname/IP</Label>
                        <Input id="db-host" value={editingConfig.host} onChange={(e) => setEditingConfig({ ...editingConfig, host: e.target.value })} placeholder="db.internal.example.com or localhost" disabled={isSaving} />
                    </div>
                    <div>
                        <Label htmlFor="db-port">Target DB Port</Label>
                        <Input id="db-port" type="number" value={editingConfig.port} onChange={(e) => setEditingConfig({ ...editingConfig, port: parseInt(e.target.value) || 3306 })} disabled={isSaving} />
                    </div>
                    <div>
                        <Label htmlFor="db-username">Target DB Username</Label>
                        <Input id="db-username" value={editingConfig.username} onChange={(e) => setEditingConfig({ ...editingConfig, username: e.target.value })} disabled={isSaving} />
                    </div>
                    <div>
                        <Label htmlFor="db-password">Target DB Password</Label>
                        <Input id="db-password" type="password" value={editingConfig.password || ''} onChange={(e) => setEditingConfig({...editingConfig, password: e.target.value})} placeholder="Enter DB password" disabled={isSaving} />
                    </div>
                    <div className="md:col-span-2">
                        <Label htmlFor="db-databaseName">Target Database Name</Label>
                        <Input id="db-databaseName" value={editingConfig.databaseName} onChange={(e) => setEditingConfig({ ...editingConfig, databaseName: e.target.value })} placeholder="e.g., radius_data" disabled={isSaving} />
                    </div>
                </div>
              </fieldset>

              {renderDbSshPreambleList(
                'directTestSshPreamble', // Runs on Jump Server
                'Direct Test SSH Preamble (Simulated on Jump Server)',
                "SSH commands to run *on the Jump Server* before attempting to connect to the Target DB (e.g., check jump server connectivity, setup tunnels from jump server)."
              )}
              
              {renderDbSshPreambleList(
                'sshPreambleSteps', // For Scenarios
                'Scenario SSH Preamble (Simulated)',
                "SSH commands to run *before* scenarios use this DB connection (e.g., for setting up specific tunnels required by the scenario itself)."
              )}
              
              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1 flex justify-between items-center w-full">
                    <span>Validation Sequence (Simulated - for 'Test Connection & Validation')</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => addValidationStep('sql')} disabled={isSaving}><PlusCircle className="mr-2 h-4 w-4" /> Add SQL Step</Button>
                        <Button variant="outline" size="sm" onClick={() => addValidationStep('ssh')} disabled={isSaving}><PlusCircle className="mr-2 h-4 w-4" /> Add SSH (DB Host) Step</Button>
                    </div>
                </legend>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                    Define SQL queries or SSH commands (on the target DB host, typically via jump server) to verify DB state. Runs *after* successful connection to the target DB.
                </p>
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
                      <Label htmlFor={`val-step-cmd-${index}`} className="text-xs text-muted-foreground">{step.type === 'sql' ? 'SQL Query' : 'SSH Command (on Target DB Host)'}</Label>
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

      <Dialog open={!!(testingDbId && (testDbResult || testDbError))} onOpenChange={(isOpen) => {
        if (!isOpen) { setTestingDbId(null); setTestDbResult(null); setTestDbError(null); }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>DB Test Results: {configs.find(c => c.id === testingDbId)?.name}</DialogTitle>
            <DialogDescription>
              Showing results of the DB connection and validation sequence (simulated).
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
                    ['connection_failure', 'validation_failure', 'jump_server_connection_failure', 'preamble_failure'].includes(testDbResult.overallStatus) ? 'destructive' :
                    'secondary'
                } className={cn(
                    testDbResult.overallStatus === 'success' && 'bg-green-500 hover:bg-green-600 text-primary-foreground',
                    testDbResult.overallStatus === 'jump_server_connection_failure' && 'bg-red-700 hover:bg-red-800 text-destructive-foreground',
                    testDbResult.overallStatus === 'preamble_failure' && 'bg-orange-600 hover:bg-orange-700 text-destructive-foreground',
                    testDbResult.overallStatus === 'connection_failure' && 'bg-red-600 hover:bg-red-700 text-destructive-foreground',
                    testDbResult.overallStatus === 'validation_failure' && 'bg-orange-500 hover:bg-orange-600 text-destructive-foreground',
                    testDbResult.overallStatus === 'partial_success' && 'bg-yellow-500 hover:bg-yellow-600 text-primary-foreground'
                )}>{testDbResult.overallStatus.replace(/_/g, ' ').toUpperCase()}</Badge></div>
                
                {/* Display Jump Server Connection Result if available */}
                 {testDbResult.jumpServerConnectionResult && (
                     <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><KeyRound className="h-5 w-5"/>Jump Server Connection</CardTitle></CardHeader>
                     <CardContent>
                        <p className={cn(testDbResult.jumpServerConnectionResult.status === 'success' ? "text-green-600" : "text-red-600")}>
                            Status: <span className="font-semibold">{testDbResult.jumpServerConnectionResult.status.toUpperCase()}</span>
                            {testDbResult.jumpServerConnectionResult.error && <span className="ml-2 text-sm">({testDbResult.jumpServerConnectionResult.error})</span>}
                            {testDbResult.jumpServerConnectionResult.output && <pre className="mt-1 text-xs whitespace-pre-wrap font-mono bg-muted p-2 rounded max-h-20 overflow-y-auto">{testDbResult.jumpServerConnectionResult.output}</pre>}
                        </p>
                     </CardContent></Card>
                 )}


                {/* Display Direct Test SSH Preamble Results (on Jump Server) if available */}
                {testDbResult.directTestSshPreambleResults && testDbResult.directTestSshPreambleResults.length > 0 && (
                     <Card><CardHeader><CardTitle className="text-lg">Jump Server SSH Preamble Steps</CardTitle></CardHeader>
                     <CardContent className="space-y-2">
                    {testDbResult.directTestSshPreambleResults.map((step, idx) => (
                        <Card key={`preamble-${idx}`} className="overflow-hidden">
                            <CardHeader className={cn("p-3 flex flex-row items-center justify-between", step.status === 'success' && 'bg-green-500/10', step.status === 'failure' && 'bg-red-500/10', step.status === 'skipped' && 'bg-gray-500/10')}>
                                <div className="flex items-center gap-2"><h4 className="font-medium">{step.stepName} <Badge variant="outline" className="text-xs">SSH</Badge></h4></div>
                                <Badge variant={step.status === 'success' ? 'default' : step.status === 'failure' ? 'destructive' : 'outline'} className={cn(step.status === 'success' && 'bg-green-600 text-primary-foreground', step.status === 'failure' && 'bg-red-600 text-destructive-foreground')}>{step.status}</Badge>
                            </CardHeader>
                            {(step.output || step.error || step.command) && 
                                <CardContent className="p-3 text-xs bg-muted/30">
                                    <p className="text-muted-foreground font-mono mb-1">Command: <code className="text-foreground bg-background/50 px-1 rounded">{step.command}</code></p>
                                    {step.output && <pre className="whitespace-pre-wrap font-mono bg-background p-2 rounded max-h-40 overflow-y-auto">{step.output}</pre>}
                                    {step.error && <pre className="whitespace-pre-wrap font-mono text-red-600 bg-red-500/10 p-2 rounded mt-1">{step.error}</pre>}
                                </CardContent>
                            }
                        </Card>
                    ))}
                    </CardContent></Card>
                )}

                <Card><CardHeader><CardTitle className="text-lg">Target Database Connection</CardTitle></CardHeader>
                <CardContent>
                    <p className={cn(testDbResult.dbConnectionStatus === 'success' ? "text-green-600" : "text-red-600")}>
                        Status: <span className="font-semibold">{testDbResult.dbConnectionStatus.toUpperCase()}</span>
                        {testDbResult.dbConnectionError && <span className="ml-2 text-sm">({testDbResult.dbConnectionError})</span>}
                    </p>
                </CardContent></Card>
                
                {testDbResult.validationStepResults && testDbResult.validationStepResults.length > 0 && (
                     <Card><CardHeader><CardTitle className="text-lg">Target DB Validation Steps</CardTitle></CardHeader>
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

    