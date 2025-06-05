
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
import { PlusCircle, Edit3, Trash2, Save, Server as ServerIcon, KeyRound, ShieldCheck, MoreHorizontal, Loader2, CheckCircle, XCircle, AlertTriangle, ListChecks, Settings, GripVertical, PlayCircle, Terminal } from 'lucide-react';
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
import { testServerConnection, TestServerConnectionInput, TestServerConnectionOutput, ClientTestStep } from '@/ai/flows/test-server-connection-flow';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

export type ServerStatus = 'connected' | 'disconnected' | 'unknown' | 'testing' | 'error_ssh' | 'error_config' | 'error_service' | 'issues_found';

export interface TestStepConfig {
  id: string;
  name: string;
  command: string;
  isEnabled: boolean;
  isMandatory: boolean;
  type: 'default' | 'custom';
  expectedOutputContains?: string;
}

export interface SshExecutionStep {
  id: string;
  name: string;
  command: string;
  isEnabled: boolean;
  expectedOutputContains?: string;
}

export interface ServerConfig {
  id: string;
  name: string;
  type: 'freeradius' | 'radiusd' | 'custom';
  customServerType?: string;
  host: string;
  sshPort: number;
  sshUser: string;
  authMethod: 'key' | 'password';
  privateKey?: string;
  password?: string;
  radiusAuthPort: number;
  radiusAcctPort: number;
  defaultSecret: string;
  nasSpecificSecrets: Record<string, string>;
  status: ServerStatus;
  testSteps: TestStepConfig[];
  scenarioExecutionSshCommands: SshExecutionStep[];
  connectionTestSshPreamble?: SshExecutionStep[];
}

const getDefaultTestSteps = (): TestStepConfig[] => [
  { id: 'step_ssh', name: 'SSH Connection Attempt', command: 'echo SSH Connected', isEnabled: true, isMandatory: true, type: 'default', expectedOutputContains: "SSH Connected" },
  { id: 'step_radclient', name: 'Check for radclient', command: 'command -v radclient || which radclient', isEnabled: true, isMandatory: false, type: 'default', expectedOutputContains: "radclient" },
  { id: 'step_radtest', name: 'Check for radtest', command: 'command -v radtest || which radtest', isEnabled: true, isMandatory: false, type: 'default', expectedOutputContains: "radtest" },
  { id: 'step_config_val', name: 'Validate RADIUS Config', command: '${serverType === "freeradius" ? "freeradius -XC 2>&1 || radiusd -XC 2>&1" : "radiusd -XC 2>&1"}', isEnabled: true, isMandatory: true, type: 'default', expectedOutputContains: "appears to be OK" },
  { id: 'step_service_status', name: 'Check RADIUS Service Status', command: '${serverType === "freeradius" ? "systemctl status freeradius 2>&1 || service freeradius status 2>&1" : "systemctl status radiusd 2>&1 || service radiusd status 2>&1"}', isEnabled: true, isMandatory: true, type: 'default', expectedOutputContains: "active" },
];

const getDefaultScenarioSshPreamble = (): SshExecutionStep[] => [
    { id: `ssh_preamble_${Date.now()}_1`, name: 'Example: Connect to Jump Host', command: 'ssh user@jump.example.com', isEnabled: false, expectedOutputContains: "Connected to jump.example.com" },
    { id: `ssh_preamble_${Date.now()}_2`, name: 'Example: SSH to Target from Jump', command: 'ssh admin@${host}', isEnabled: false, expectedOutputContains: "Connected to admin@${host}" },
];

const getDefaultConnectionTestSshPreamble = (): SshExecutionStep[] => [
    { id: `conn_ssh_preamble_${Date.now()}`, name: 'Example: Pre-Test SSH Command', command: 'echo "Preamble for connection test"', isEnabled: false, expectedOutputContains: "Preamble for connection test" },
];


export default function ServerConfigPage() {
  const [configs, setConfigs] = useState<ServerConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<ServerConfig | null>(null);
  const [nasSecretKey, setNasSecretKey] = useState('');
  const [nasSecretValue, setNasSecretValue] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [testConnectionResult, setTestConnectionResult] = useState<TestServerConnectionOutput | null>(null);
  const [testConnectionError, setTestConnectionError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchConfigs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/servers');
      if (!response.ok) throw new Error('Failed to fetch server configurations');
      const data: ServerConfig[] = await response.json();
      setConfigs(data);
    } catch (error) {
      console.error("Error fetching server configs:", error);
      toast({ title: "Error", description: (error as Error).message || "Could not fetch server configurations.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditConfig = (config: ServerConfig | null) => {
    setEditingConfig(config ? JSON.parse(JSON.stringify(config)) : null);
    setNasSecretKey('');
    setNasSecretValue('');
  };

  const handleSaveConfig = async () => {
    if (!editingConfig) return;
    setIsSaving(true);

    const isNew = editingConfig.id === 'new';
    const url = isNew ? '/api/settings/servers' : `/api/settings/servers/${editingConfig.id}`;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingConfig),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isNew ? 'create' : 'update'} server configuration`);
      }
      const savedConfig: ServerConfig = await response.json();

      if (isNew) {
        setConfigs(prev => [savedConfig, ...prev]);
      } else {
        setConfigs(prev => prev.map(c => c.id === savedConfig.id ? savedConfig : c));
      }
      handleEditConfig(null);
      toast({ title: "Success", description: `Server configuration "${savedConfig.name}" ${isNew ? 'created' : 'updated'} successfully.` });
    } catch (error) {
      console.error("Error saving server config:", error);
      toast({ title: "Error", description: (error as Error).message || "Could not save server configuration.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!window.confirm("Are you sure you want to delete this server configuration?")) return;
    
    setIsLoading(true); 
    try {
      const response = await fetch(`/api/settings/servers/${configId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete server configuration');
      }
      setConfigs(prev => prev.filter(c => c.id !== configId));
      toast({ title: "Success", description: "Server configuration deleted successfully." });
    } catch (error) {
      console.error("Error deleting server config:", error);
      toast({ title: "Error", description: (error as Error).message || "Could not delete server configuration.", variant: "destructive" });
    } finally {
      setIsLoading(false); 
    }
  };


  const createNewConfig = () => {
    handleEditConfig({
      id: 'new', 
      name: 'New Server Config',
      type: 'freeradius',
      customServerType: '',
      host: '',
      sshPort: 22,
      sshUser: 'root',
      authMethod: 'key',
      privateKey: '',
      password: '',
      radiusAuthPort: 1812,
      radiusAcctPort: 1813,
      defaultSecret: '',
      nasSpecificSecrets: {},
      status: 'unknown',
      testSteps: getDefaultTestSteps(),
      scenarioExecutionSshCommands: getDefaultScenarioSshPreamble(),
      connectionTestSshPreamble: getDefaultConnectionTestSshPreamble(),
    });
  };

  const handleNasSecretChange = (key: string, value: string, action: 'update' | 'remove') => {
    if (editingConfig) {
        const updatedSecrets = { ...(editingConfig.nasSpecificSecrets || {}) };
        if (action === 'update') {
            updatedSecrets[key] = value;
        } else if (action === 'remove') {
            delete updatedSecrets[key];
        }
        setEditingConfig({ ...editingConfig, nasSpecificSecrets: updatedSecrets });
    }
  };
  
  const addNasSecretEntry = () => {
      if (editingConfig && nasSecretKey) {
          handleNasSecretChange(nasSecretKey, nasSecretValue, 'update');
          setNasSecretKey('');
          setNasSecretValue('');
      }
  };

  const handleTestStepChange = (index: number, field: keyof TestStepConfig, value: any) => {
    if (editingConfig) {
      const updatedTestSteps = [...editingConfig.testSteps];
      if (field === 'isEnabled' || field === 'isMandatory') {
        (updatedTestSteps[index] as any)[field] = Boolean(value);
      } else {
        (updatedTestSteps[index] as any)[field] = value;
      }
      setEditingConfig({ ...editingConfig, testSteps: updatedTestSteps });
    }
  };

  const addCustomTestStep = () => {
    if (editingConfig) {
      const newStep: TestStepConfig = {
        id: `custom_step_${Date.now()}`,
        name: 'New Custom Step',
        command: '',
        isEnabled: true,
        isMandatory: false,
        type: 'custom',
        expectedOutputContains: '',
      };
      setEditingConfig({ ...editingConfig, testSteps: [...editingConfig.testSteps, newStep] });
    }
  };

  const removeTestStep = (index: number) => {
    if (editingConfig && !editingConfig.testSteps[index].isMandatory) {
      const updatedTestSteps = editingConfig.testSteps.filter((_, i) => i !== index);
      setEditingConfig({ ...editingConfig, testSteps: updatedTestSteps });
    }
  };
  
  // Generic SshExecutionStep handler
  const handleSshStepChange = (
    listName: 'scenarioExecutionSshCommands' | 'connectionTestSshPreamble',
    index: number,
    field: keyof SshExecutionStep,
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

  const addSshStep = (listName: 'scenarioExecutionSshCommands' | 'connectionTestSshPreamble') => {
    if (editingConfig) {
      const newStep: SshExecutionStep = {
        id: `ssh_custom_${listName}_${Date.now()}`,
        name: 'New SSH Step',
        command: '',
        isEnabled: true,
        expectedOutputContains: '',
      };
      const currentList = editingConfig[listName] || [];
      setEditingConfig({ ...editingConfig, [listName]: [...currentList, newStep] });
    }
  };

  const removeSshStep = (listName: 'scenarioExecutionSshCommands' | 'connectionTestSshPreamble', index: number) => {
    if (editingConfig) {
      const currentList = editingConfig[listName] || [];
      const updatedSteps = currentList.filter((_, i) => i !== index);
      setEditingConfig({ ...editingConfig, [listName]: updatedSteps });
    }
  };

  const renderSshStepList = (
    listName: 'scenarioExecutionSshCommands' | 'connectionTestSshPreamble',
    title: string,
    description: string
  ) => (
    <fieldset className="border p-4 rounded-md">
      <legend className="text-sm font-medium px-1 flex justify-between items-center w-full">
        <span>{title}</span>
        <Button variant="outline" size="sm" onClick={() => addSshStep(listName)} className="ml-auto" disabled={isSaving}>
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
                  onChange={(e) => handleSshStepChange(listName, index, 'name', e.target.value)}
                  className="text-sm font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent flex-grow min-w-0"
                  placeholder="SSH Step Name"
                  disabled={isSaving}
                />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch
                  id={`${listName}-enabled-${index}`}
                  checked={step.isEnabled}
                  onCheckedChange={(checked) => handleSshStepChange(listName, index, 'isEnabled', checked)}
                  aria-label="Enable SSH step"
                  disabled={isSaving}
                />
                <Button variant="ghost" size="icon" onClick={() => removeSshStep(listName, index)} className="text-destructive hover:text-destructive h-7 w-7" disabled={isSaving}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor={`${listName}-cmd-${index}`} className="text-xs text-muted-foreground">SSH Command</Label>
              <Textarea
                id={`${listName}-cmd-${index}`}
                value={step.command}
                onChange={(e) => handleSshStepChange(listName, index, 'command', e.target.value)}
                rows={1}
                className="font-mono text-xs mt-1"
                placeholder="e.g., ssh user@jump.server.com"
                disabled={isSaving}
              />
            </div>
            <div className="mt-2">
                <Label htmlFor={`${listName}-expect-${index}`} className="text-xs text-muted-foreground">Expected Output Contains (Optional)</Label>
                <Input
                    id={`${listName}-expect-${index}`}
                    value={step.expectedOutputContains || ''}
                    onChange={(e) => handleSshStepChange(listName, index, 'expectedOutputContains', e.target.value)}
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

  const handleTestConnection = async (configToTest: ServerConfig) => {
    setTestingServerId(configToTest.id);
    setTestConnectionResult(null);
    setTestConnectionError(null);
    setConfigs(prev => prev.map(c => c.id === configToTest.id ? { ...c, status: 'testing' as ServerStatus } : c));

    try {
      const stepsToExecuteClient: ClientTestStep[] = configToTest.testSteps.map(s => ({ 
          name: s.name, command: s.command, isEnabled: s.isEnabled,
          isMandatory: s.isMandatory, type: s.type,
          expectedOutputContains: s.expectedOutputContains || undefined,
      }));
      
      const connectionPreambleClientSteps: ClientTestStep[] | undefined = configToTest.connectionTestSshPreamble?.map(s => ({
          name: s.name, command: s.command, isEnabled: s.isEnabled,
          isMandatory: false, // Preamble steps are not typically mandatory in the same way as test steps
          type: 'custom', // Treat preamble steps as custom for the flow
          expectedOutputContains: s.expectedOutputContains || undefined,
      }));

      const input: TestServerConnectionInput = {
        id: configToTest.id, host: configToTest.host, sshPort: configToTest.sshPort,
        sshUser: configToTest.sshUser, authMethod: configToTest.authMethod,
        privateKey: configToTest.privateKey, password: configToTest.password,
        serverType: configToTest.type, 
        customServerType: configToTest.customServerType,
        connectionTestSshPreamble: connectionPreambleClientSteps,
        stepsToExecute: stepsToExecuteClient,
      };
      const result = await testServerConnection(input);
      setTestConnectionResult(result);
      
      let newStatus: ServerStatus = 'unknown';
      if (result.overallStatus === 'success') newStatus = 'connected';
      else if (result.overallStatus === 'failure') {
        const sshFailed = result.steps.find(s => s.stepName.toLowerCase().includes('ssh connection attempt') && s.status === 'failure');
        if (sshFailed) newStatus = 'error_ssh';
        else {
            const configFailed = result.steps.find(s => s.stepName.toLowerCase().includes('validate radius config') && s.status === 'failure');
            if (configFailed) newStatus = 'error_config';
            else newStatus = 'error_service'; // Generic if not SSH or config validation
        }
      } else if (result.overallStatus === 'partial') newStatus = 'issues_found';
      
      const updatedConfigForSave = { ...configToTest, status: newStatus };
      const response = await fetch(`/api/settings/servers/${configToTest.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedConfigForSave),
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update server status after test');
      }
      const savedConfigWithStatus: ServerConfig = await response.json();
      setConfigs(prev => prev.map(c => c.id === savedConfigWithStatus.id ? savedConfigWithStatus : c));
      toast({ title: "Connection Test Complete", description: `Test for ${configToTest.name} finished. Status: ${newStatus.replace('_', ' ')}.` });

    } catch (error) {
      console.error("Error testing connection or saving status:", error);
      setTestConnectionError(error instanceof Error ? error.message : "An unknown error occurred during the test.");
      setConfigs(prev => prev.map(c => c.id === configToTest.id ? { ...c, status: configToTest.status || 'unknown' } : c));
      toast({ title: "Connection Test Failed", description: (error as Error).message || "Could not run the connection test or save status.", variant: "destructive" });
    }
  };

  const getStatusBadge = (status?: ServerStatus) => {
    switch (status) {
      case 'connected': return <Badge className="bg-green-100 text-green-700 border-green-300 dark:bg-green-700/30 dark:text-green-300 dark:border-green-600">Connected</Badge>;
      case 'disconnected': return <Badge variant="destructive">Disconnected</Badge>;
      case 'testing': return <Badge variant="outline" className="text-blue-600 border-blue-400 dark:text-blue-400 dark:border-blue-500"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Testing...</Badge>;
      case 'error_ssh': return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-700/30 dark:text-red-300 dark:border-red-600">SSH Error</Badge>;
      case 'error_config': return <Badge variant="destructive" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-700/30 dark:text-orange-300 dark:border-orange-600">Config Error</Badge>;
      case 'error_service': return <Badge variant="destructive" className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-700/30 dark:text-yellow-300 dark:border-yellow-600">Service Error</Badge>;
      case 'issues_found': return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-700/30 dark:text-yellow-300 dark:border-yellow-600">Issues Found</Badge>;
      case 'unknown':
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };


  return (
    <div className="space-y-8">
      <PageHeader
        title="Server Configuration"
        description="Manage connections to your RADIUS servers for testing."
        actions={
          <Button onClick={createNewConfig} disabled={isLoading || isSaving}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Server
          </Button>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Configured Servers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !configs.length ? (
             <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading server configurations...</p>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.name}</TableCell>
                  <TableCell>{config.host}:{config.radiusAuthPort}</TableCell>
                  <TableCell><Badge variant="outline">{config.type === 'custom' ? config.customServerType || 'Custom' : config.type}</Badge></TableCell>
                  <TableCell>{getStatusBadge(config.status)}</TableCell>
                  <TableCell className="text-right">
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={testingServerId === config.id || isSaving}>
                          <span className="sr-only">Open menu</span>
                          {testingServerId === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditConfig(config)} disabled={!!testingServerId || isSaving}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTestConnection(config)} disabled={!!testingServerId || isSaving}>
                          <PlayCircle className="mr-2 h-4 w-4" /> Test Connection
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteConfig(config.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={!!testingServerId || isSaving}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
               {!isLoading && configs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No server configurations found. Click "Add Server" to create one.
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
                <ServerIcon className="h-6 w-6 text-primary" />
                {editingConfig?.id === 'new' ? 'Add New Server Configuration' : `Edit Server: ${editingConfig?.name}`}
            </DialogTitle>
            <DialogDescription>
              Provide connection details and customize test sequences. Placeholders like `${"${host}"}` can be used in commands.
            </DialogDescription>
          </DialogHeader>
          {editingConfig && (
            <ScrollArea className="max-h-[70vh] pr-2 -mr-6 pl-1"> 
            <div className="space-y-6 py-4 pr-4"> 
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="server-name">Configuration Name</Label>
                  <Input id="server-name" value={editingConfig.name} onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })} placeholder="e.g., EU-Prod-FR-01" disabled={isSaving} />
                </div>
                <div>
                  <Label htmlFor="server-type">Server Type</Label>
                  <Select value={editingConfig.type} onValueChange={(value) => setEditingConfig({ ...editingConfig, type: value as ServerConfig['type'] })} disabled={isSaving}>
                    <SelectTrigger id="server-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="freeradius">FreeRADIUS</SelectItem>
                      <SelectItem value="radiusd">radiusd (Generic)</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingConfig.type === 'custom' && (
                    <div className="md:col-span-2">
                        <Label htmlFor="custom-server-type">Custom Server Type Name</Label>
                        <Input id="custom-server-type" value={editingConfig.customServerType || ''} onChange={(e) => setEditingConfig({ ...editingConfig, customServerType: e.target.value })} placeholder="e.g., MyRadiusImpl" disabled={isSaving}/>
                    </div>
                )}
              </div>
              
              <div>
                <Label htmlFor="server-host">Hostname or IP Address (for RADIUS client)</Label>
                <Input id="server-host" value={editingConfig.host} onChange={(e) => setEditingConfig({ ...editingConfig, host: e.target.value })} placeholder="radius.example.com" disabled={isSaving} />
              </div>

              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">SSH Details</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <Label htmlFor="ssh-port">SSH Port</Label>
                        <Input id="ssh-port" type="number" value={editingConfig.sshPort} onChange={(e) => setEditingConfig({ ...editingConfig, sshPort: parseInt(e.target.value) || 22 })} disabled={isSaving} />
                    </div>
                    <div>
                        <Label htmlFor="ssh-user">SSH Username</Label>
                        <Input id="ssh-user" value={editingConfig.sshUser} onChange={(e) => setEditingConfig({ ...editingConfig, sshUser: e.target.value })} disabled={isSaving} />
                    </div>
                     <div>
                        <Label htmlFor="auth-method">Authentication Method</Label>
                        <Select value={editingConfig.authMethod} onValueChange={(value) => setEditingConfig({ ...editingConfig, authMethod: value as ServerConfig['authMethod'] })} disabled={isSaving}>
                            <SelectTrigger id="auth-method"><SelectValue /></SelectTrigger>
                            <SelectContent>
                            <SelectItem value="key">SSH Key</SelectItem>
                            <SelectItem value="password">Password</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {editingConfig.authMethod === 'key' ? (
                        <div className="md:col-span-2">
                            <Label htmlFor="ssh-key">SSH Private Key</Label>
                            <Textarea id="ssh-key" value={editingConfig.privateKey || ''} onChange={(e) => setEditingConfig({...editingConfig, privateKey: e.target.value})} placeholder="Paste your private key here" rows={3} disabled={isSaving}/>
                        </div>
                    ) : (
                         <div>
                            <Label htmlFor="ssh-password">SSH Password</Label>
                            <Input id="ssh-password" type="password" value={editingConfig.password || ''} onChange={(e) => setEditingConfig({...editingConfig, password: e.target.value})} placeholder="Enter SSH password" disabled={isSaving}/>
                        </div>
                    )}
                </div>
              </fieldset>
              
              {renderSshStepList(
                'connectionTestSshPreamble',
                'Connection Test SSH Preamble (Simulated)',
                "SSH commands to run *before* the Connection Test Sequence (e.g., for bastion hosts, setup). Uses Server SSH Details."
              )}

              {renderSshStepList(
                'scenarioExecutionSshCommands',
                'Scenario Execution SSH Preamble (Simulated)',
                "SSH commands to run *before* scenarios target this server (e.g., for jump hosts, tunnels). Uses Server SSH Details."
              )}
              

              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">RADIUS Ports & Secrets</legend>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <Label htmlFor="radius-auth-port">RADIUS Auth Port</Label>
                        <Input id="radius-auth-port" type="number" value={editingConfig.radiusAuthPort} onChange={(e) => setEditingConfig({ ...editingConfig, radiusAuthPort: parseInt(e.target.value) || 1812 })} disabled={isSaving} />
                    </div>
                    <div>
                        <Label htmlFor="radius-acct-port">RADIUS Acct Port</Label>
                        <Input id="radius-acct-port" type="number" value={editingConfig.radiusAcctPort} onChange={(e) => setEditingConfig({ ...editingConfig, radiusAcctPort: parseInt(e.target.value) || 1813 })} disabled={isSaving} />
                    </div>
                </div>
                <div className="mt-4">
                    <Label htmlFor="default-secret">Default Shared Secret</Label>
                    <Input id="default-secret" type="password" value={editingConfig.defaultSecret} onChange={(e) => setEditingConfig({ ...editingConfig, defaultSecret: e.target.value })} disabled={isSaving} />
                </div>
              </fieldset>
              
              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">NAS-Specific Secrets (Optional)</legend>
                <div className="space-y-2 mt-2">
                    {Object.entries(editingConfig.nasSpecificSecrets || {}).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                            <Input value={key} readOnly className="font-mono"/>
                            <Input type="password" value={value} readOnly className="font-mono"/>
                            <Button variant="ghost" size="icon" onClick={() => handleNasSecretChange(key, '', 'remove')} className="text-destructive h-8 w-8" disabled={isSaving}>
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                        </div>
                    ))}
                     <div className="flex items-end gap-2 pt-2">
                        <div className="flex-1"><Label htmlFor="nas-key" className="text-xs">NAS Identifier (IP/Name)</Label><Input id="nas-key" value={nasSecretKey} onChange={(e) => setNasSecretKey(e.target.value)} placeholder="e.g., 10.0.0.1 or nas-01" disabled={isSaving}/></div>
                        <div className="flex-1"><Label htmlFor="nas-value" className="text-xs">Secret</Label><Input id="nas-value" type="text" value={nasSecretValue} onChange={(e) => setNasSecretValue(e.target.value)} placeholder="Secret for this NAS" disabled={isSaving}/></div>
                        <Button onClick={addNasSecretEntry} size="sm" disabled={isSaving}><PlusCircle className="h-4 w-4"/></Button>
                    </div>
                </div>
              </fieldset>

              <fieldset className="border p-4 rounded-md">
                  <legend className="text-sm font-medium px-1 flex justify-between items-center w-full">
                    <span>Connection Test Sequence (Simulated)</span>
                    <Button variant="outline" size="sm" onClick={addCustomTestStep} className="ml-auto" disabled={isSaving}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Custom Step
                    </Button>
                  </legend>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                      Define SSH commands to verify server readiness (e.g., check config, service status, tools). Runs *after* Connection Test SSH Preamble.
                  </p>
                  <div className="space-y-3 mt-3">
                    {editingConfig.testSteps.map((step, index) => (
                        <Card key={step.id} className="p-3 bg-muted/50 relative group dark:bg-muted/20">
                             <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 flex-grow">
                                     <Settings className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                                    <Input 
                                        value={step.name} 
                                        onChange={(e) => handleTestStepChange(index, 'name', e.target.value)} 
                                        className="text-sm font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent flex-grow min-w-0"
                                        placeholder="Step Name"
                                        disabled={isSaving}
                                    />
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                     {step.isMandatory && <Badge variant="secondary" className="text-xs whitespace-nowrap">Mandatory</Badge>}
                                    <Switch 
                                        id={`step-enabled-${index}`}
                                        checked={step.isEnabled} 
                                        onCheckedChange={(checked) => handleTestStepChange(index, 'isEnabled', checked)}
                                        disabled={step.isMandatory || isSaving}
                                        aria-label="Enable step"
                                    />
                                    {!step.isMandatory && (
                                        <Button variant="ghost" size="icon" onClick={() => removeTestStep(index)} className="text-destructive hover:text-destructive h-7 w-7" disabled={isSaving}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <Label htmlFor={`step-cmd-${index}`} className="text-xs text-muted-foreground">Command</Label>
                                <Textarea 
                                    id={`step-cmd-${index}`}
                                    value={step.command} 
                                    onChange={(e) => handleTestStepChange(index, 'command', e.target.value)} 
                                    rows={1} 
                                    className="font-mono text-xs mt-1"
                                    placeholder="e.g., which radclient"
                                    disabled={isSaving}
                                />
                            </div>
                             <div className="mt-2">
                                <Label htmlFor={`step-expect-${index}`} className="text-xs text-muted-foreground">Expected Output Contains (Optional)</Label>
                                <Input
                                    id={`step-expect-${index}`}
                                    value={step.expectedOutputContains || ''}
                                    onChange={(e) => handleTestStepChange(index, 'expectedOutputContains', e.target.value)}
                                    className="font-mono text-xs mt-1"
                                    placeholder="e.g., 'active (running)' or '/usr/bin/radclient'"
                                    disabled={isSaving}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    If provided, (simulated) step succeeds if output includes this text.
                                </p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Use placeholders: `${"${host}"}`, `${"${sshUser}"}`, `${"${sshPort}"}`, `${"${serverType}"}` in commands.
                            </p>
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
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!(testingServerId && (testConnectionResult || testConnectionError))} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setTestingServerId(null); 
          setTestConnectionResult(null);
          setTestConnectionError(null);
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Connection Test Results: {configs.find(c => c.id === testingServerId)?.name}</DialogTitle>
            <DialogDescription>
              Showing results of the connection and setup checks. 
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4 py-4">
            {testConnectionError && (
              <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-md">
                <h3 className="font-semibold flex items-center gap-2"><AlertTriangle />Error Running Test:</h3>
                <p>{testConnectionError}</p>
              </div>
            )}
            {testConnectionResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Overall Status:</span>
                  {testConnectionResult.overallStatus === 'success' && <Badge className="bg-green-500 hover:bg-green-600 text-primary-foreground">Success</Badge>}
                  {testConnectionResult.overallStatus === 'failure' && <Badge variant="destructive">Failure</Badge>}
                  {testConnectionResult.overallStatus === 'partial' && <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-secondary-foreground">Partial Success</Badge>}
                   {testConnectionResult.overallStatus === 'testing' && <Badge variant="outline" className="text-blue-600 border-blue-400 dark:text-blue-400 dark:border-blue-500"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Testing...</Badge>}
                </div>
                {testConnectionResult.steps.map((step, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardHeader className={cn("p-3 flex flex-row items-center justify-between",
                      step.status === 'success' && 'bg-green-500/10 dark:bg-green-600/20',
                      step.status === 'failure' && 'bg-red-500/10 dark:bg-red-600/20',
                      step.status === 'skipped' && 'bg-gray-500/10 dark:bg-gray-600/20'
                    )}>
                      <div className="flex items-center gap-2">
                        {step.status === 'success' && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />}
                        {step.status === 'failure' && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
                        {step.status === 'skipped' && <AlertTriangle className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
                        <CardTitle className="text-md">{step.stepName}</CardTitle>
                      </div>
                      <Badge variant={
                        step.status === 'success' ? 'default' :
                        step.status === 'failure' ? 'destructive' :
                        'outline'
                      } className={cn(
                        step.status === 'success' && 'bg-green-600 text-white dark:bg-green-500 dark:text-primary-foreground',
                        step.status === 'failure' && 'bg-red-600 text-white dark:bg-red-500 dark:text-destructive-foreground',
                        step.status === 'skipped' && 'bg-gray-600 text-white dark:bg-gray-500 dark:text-primary-foreground'
                      )}>{step.status}</Badge>
                    </CardHeader>
                    {(step.output || step.error || step.command) && (
                        <CardContent className="p-3 text-xs bg-muted/30 dark:bg-muted/10">
                            {step.command && <p className="text-muted-foreground font-mono mb-1">Command: <code className="text-foreground bg-background/50 px-1 rounded dark:bg-background/20">{step.command}</code></p>}
                            {step.output && <pre className="whitespace-pre-wrap font-mono bg-background p-2 rounded max-h-40 overflow-y-auto dark:bg-background/20">{step.output}</pre>}
                            {step.error && <pre className="whitespace-pre-wrap font-mono text-red-600 dark:text-red-400 bg-red-500/10 p-2 rounded mt-1 max-h-40 overflow-y-auto dark:bg-red-600/20">{step.error}</pre>}
                        </CardContent>
                    )}
                  </Card>
                ))}
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

    