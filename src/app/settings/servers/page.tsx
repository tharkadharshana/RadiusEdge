
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
import { PlusCircle, Edit3, Trash2, Save, Server as ServerIcon, KeyRound, ShieldCheck, MoreHorizontal, Loader2, CheckCircle, XCircle, AlertTriangle, ListChecks, Settings, GripVertical, PlayCircle } from 'lucide-react';
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

type TestStepResult = TestServerConnectionOutput['steps'][0];

type ServerStatus = 'connected' | 'disconnected' | 'unknown' | 'testing' | 'error_ssh' | 'error_config' | 'error_service' | 'issues_found';

interface TestStepConfig {
  id: string;
  name: string;
  command: string;
  isEnabled: boolean;
  isMandatory: boolean;
  type: 'default' | 'custom';
  expectedOutputContains?: string; // New field
}

interface ServerConfig {
  id: string;
  name: string;
  type: 'freeradius' | 'custom' | 'other';
  host: string;
  sshPort: number;
  sshUser: string;
  authMethod: 'key' | 'password';
  privateKey?: string;
  password?: string;
  radiusAuthPort: number;
  radiusAcctPort: number;
  defaultSecret: string;
  nasSpecificSecrets?: Record<string, string>;
  status?: ServerStatus;
  testSteps: TestStepConfig[];
}

const getDefaultTestSteps = (): TestStepConfig[] => [
  { id: 'step_ssh', name: 'SSH Connection Attempt', command: 'ssh ${sshUser}@${host} -p ${sshPort} "echo SSH Connected"', isEnabled: true, isMandatory: true, type: 'default', expectedOutputContains: "SSH Connected" },
  { id: 'step_radclient', name: 'Check for radclient', command: 'which radclient', isEnabled: true, isMandatory: false, type: 'default', expectedOutputContains: "/radclient" },
  { id: 'step_radtest', name: 'Check for radtest', command: 'which radtest', isEnabled: true, isMandatory: false, type: 'default', expectedOutputContains: "/radtest" },
  { id: 'step_config_val', name: 'Validate RADIUS Config', command: '${serverType === "freeradius" ? "freeradius" : "radiusd"} -XC', isEnabled: true, isMandatory: true, type: 'default', expectedOutputContains: "Configuration appears to be OK" },
  { id: 'step_service_status', name: 'Check RADIUS Service Status', command: 'systemctl status ${serverType === "freeradius" ? "freeradius" : "radiusd"}', isEnabled: true, isMandatory: true, type: 'default', expectedOutputContains: "active (running)" },
];


const initialServerConfigs: ServerConfig[] = [
  { 
    id: 'srv1', name: 'EU-Prod-FR-01', type: 'freeradius', host: 'radius-eu.example.com', 
    sshPort: 22, sshUser: 'radius-admin', authMethod: 'key', 
    radiusAuthPort: 1812, radiusAcctPort: 1813, defaultSecret: 'secret123', 
    status: 'unknown', testSteps: getDefaultTestSteps() 
  },
  { 
    id: 'srv2', name: 'US-Staging-Custom', type: 'custom', host: 'staging-us-radius.example.net', 
    sshPort: 22022, sshUser: 'deploy', authMethod: 'password', 
    radiusAuthPort: 11812, radiusAcctPort: 11813, defaultSecret: 'staging_secret', 
    status: 'unknown', testSteps: getDefaultTestSteps()
  },
];

export default function ServerConfigPage() {
  const [configs, setConfigs] = useState<ServerConfig[]>(initialServerConfigs);
  const [editingConfig, setEditingConfig] = useState<ServerConfig | null>(null);
  const [nasSecretKey, setNasSecretKey] = useState('');
  const [nasSecretValue, setNasSecretValue] = useState('');

  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [testConnectionResult, setTestConnectionResult] = useState<TestServerConnectionOutput | null>(null);
  const [testConnectionError, setTestConnectionError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleEditConfig = (config: ServerConfig | null) => {
    setEditingConfig(config ? JSON.parse(JSON.stringify(config)) : null);
    setNasSecretKey('');
    setNasSecretValue('');
  };

  const handleSaveConfig = () => {
    if (editingConfig) {
      const configToSave = { ...editingConfig, status: editingConfig.status || 'unknown' };
      if (editingConfig.id === 'new') {
        setConfigs(prev => [...prev, { ...configToSave, id: `srv${Date.now()}` }]);
      } else {
        setConfigs(prev => prev.map(c => c.id === editingConfig.id ? configToSave : c));
      }
      handleEditConfig(null);
    }
  };

  const createNewConfig = () => {
    handleEditConfig({
      id: 'new',
      name: 'New Server Config',
      type: 'freeradius',
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
      // Ensure type safety for boolean fields
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
  

  const handleTestConnection = async (configToTest: ServerConfig) => {
    setTestingServerId(configToTest.id);
    setTestConnectionResult(null);
    setTestConnectionError(null);
    setConfigs(prev => prev.map(c => c.id === configToTest.id ? { ...c, status: 'testing' } : c));

    try {
      const stepsToExecuteClient: ClientTestStep[] = configToTest.testSteps.map(s => ({ 
          name: s.name,
          command: s.command,
          isEnabled: s.isEnabled,
          isMandatory: s.isMandatory, 
          type: s.type,
          expectedOutputContains: s.expectedOutputContains || undefined, // Ensure it's passed as undefined if empty
      }));

      const input: TestServerConnectionInput = {
        id: configToTest.id,
        host: configToTest.host,
        sshPort: configToTest.sshPort,
        sshUser: configToTest.sshUser,
        authMethod: configToTest.authMethod,
        privateKey: configToTest.privateKey,
        password: configToTest.password,
        serverType: configToTest.type,
        stepsToExecute: stepsToExecuteClient,
      };
      const result = await testServerConnection(input);
      setTestConnectionResult(result);
      
      let newStatus: ServerStatus = 'unknown';
      if (result.overallStatus === 'success') newStatus = 'connected';
      else if (result.overallStatus === 'failure') {
        const sshFailed = result.steps.find(s => s.stepName.toLowerCase().includes('ssh') && s.status === 'failure');
        if (sshFailed) newStatus = 'error_ssh';
        else {
            const configFailed = result.steps.find(s => s.stepName.toLowerCase().includes('validate radius config') && s.status === 'failure');
            if (configFailed) newStatus = 'error_config';
            else newStatus = 'error_service';
        }
      } else if (result.overallStatus === 'partial') newStatus = 'issues_found';
      
      setConfigs(prev => prev.map(c => c.id === configToTest.id ? { ...c, status: newStatus } : c));
      toast({ title: "Connection Test Complete", description: `Test for ${configToTest.name} finished with status: ${result.overallStatus}.` });

    } catch (error) {
      console.error("Error testing connection:", error);
      setTestConnectionError(error instanceof Error ? error.message : "An unknown error occurred during the test.");
      setConfigs(prev => prev.map(c => c.id === configToTest.id ? { ...c, status: 'unknown' } : c));
      toast({ title: "Connection Test Failed", description: "Could not run the connection test.", variant: "destructive" });
    }
  };

  const getStatusBadge = (status?: ServerStatus) => {
    switch (status) {
      case 'connected': return <Badge variant="default" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-700/30 dark:text-green-300 dark:border-green-600">Connected</Badge>;
      case 'disconnected': return <Badge variant="destructive">Disconnected</Badge>;
      case 'testing': return <Badge variant="outline" className="text-blue-600 border-blue-400 dark:text-blue-400 dark:border-blue-500"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Testing...</Badge>;
      case 'error_ssh': return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-700/30 dark:text-red-300 dark:border-red-600">SSH Error</Badge>;
      case 'error_config': return <Badge variant="destructive" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-700/30 dark:text-orange-300 dark:border-orange-600">Config Error</Badge>;
      case 'error_service': return <Badge variant="destructive" className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-700/30 dark:text-yellow-300 dark:border-yellow-600">Service Error</Badge>;
      case 'issues_found': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-700/30 dark:text-yellow-300 dark:border-yellow-600">Issues Found</Badge>;
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
          <Button onClick={createNewConfig}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Server
          </Button>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Configured Servers</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <TableCell><Badge variant="outline">{config.type}</Badge></TableCell>
                  <TableCell>{getStatusBadge(config.status)}</TableCell>
                  <TableCell className="text-right">
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={testingServerId === config.id}>
                          <span className="sr-only">Open menu</span>
                          {testingServerId === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditConfig(config)} disabled={!!testingServerId}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTestConnection(config)} disabled={!!testingServerId}>
                          <PlayCircle className="mr-2 h-4 w-4" /> Test Connection
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={!!testingServerId}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Server Config Editor Dialog */}
      <Dialog open={!!editingConfig} onOpenChange={(isOpen) => !isOpen && handleEditConfig(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <ServerIcon className="h-6 w-6 text-primary" />
                {editingConfig?.id === 'new' ? 'Add New Server Configuration' : `Edit Server: ${editingConfig?.name}`}
            </DialogTitle>
            <DialogDescription>
              Provide connection details and customize the (simulated) test sequence.
            </DialogDescription>
          </DialogHeader>
          {editingConfig && (
            <ScrollArea className="max-h-[70vh] pr-2 -mr-6 pl-1"> 
            <div className="space-y-6 py-4 pr-4"> 
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="server-name">Configuration Name</Label>
                  <Input id="server-name" value={editingConfig.name} onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })} placeholder="e.g., EU-Prod-FR-01" />
                </div>
                <div>
                  <Label htmlFor="server-type">Server Type</Label>
                  <Select value={editingConfig.type} onValueChange={(value) => setEditingConfig({ ...editingConfig, type: value as ServerConfig['type'] })}>
                    <SelectTrigger id="server-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="freeradius">FreeRADIUS</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="server-host">Hostname or IP Address (for RADIUS client)</Label>
                <Input id="server-host" value={editingConfig.host} onChange={(e) => setEditingConfig({ ...editingConfig, host: e.target.value })} placeholder="radius.example.com" />
              </div>

              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">SSH Details (for simulated tests)</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <Label htmlFor="ssh-port">SSH Port</Label>
                        <Input id="ssh-port" type="number" value={editingConfig.sshPort} onChange={(e) => setEditingConfig({ ...editingConfig, sshPort: parseInt(e.target.value) || 22 })} />
                    </div>
                    <div>
                        <Label htmlFor="ssh-user">SSH Username</Label>
                        <Input id="ssh-user" value={editingConfig.sshUser} onChange={(e) => setEditingConfig({ ...editingConfig, sshUser: e.target.value })} />
                    </div>
                     <div>
                        <Label htmlFor="auth-method">Authentication Method</Label>
                        <Select value={editingConfig.authMethod} onValueChange={(value) => setEditingConfig({ ...editingConfig, authMethod: value as ServerConfig['authMethod'] })}>
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
                            <Textarea id="ssh-key" value={editingConfig.privateKey || ''} onChange={(e) => setEditingConfig({...editingConfig, privateKey: e.target.value})} placeholder="Paste your private key here (stored locally, used for simulation)" rows={3}/>
                        </div>
                    ) : (
                         <div>
                            <Label htmlFor="ssh-password">SSH Password</Label>
                            <Input id="ssh-password" type="password" value={editingConfig.password || ''} onChange={(e) => setEditingConfig({...editingConfig, password: e.target.value})} placeholder="Enter SSH password (for simulation)"/>
                        </div>
                    )}
                </div>
              </fieldset>

              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">RADIUS Ports & Secrets</legend>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <Label htmlFor="radius-auth-port">RADIUS Auth Port</Label>
                        <Input id="radius-auth-port" type="number" value={editingConfig.radiusAuthPort} onChange={(e) => setEditingConfig({ ...editingConfig, radiusAuthPort: parseInt(e.target.value) || 1812 })} />
                    </div>
                    <div>
                        <Label htmlFor="radius-acct-port">RADIUS Acct Port</Label>
                        <Input id="radius-acct-port" type="number" value={editingConfig.radiusAcctPort} onChange={(e) => setEditingConfig({ ...editingConfig, radiusAcctPort: parseInt(e.target.value) || 1813 })} />
                    </div>
                </div>
                <div className="mt-4">
                    <Label htmlFor="default-secret">Default Shared Secret</Label>
                    <Input id="default-secret" type="password" value={editingConfig.defaultSecret} onChange={(e) => setEditingConfig({ ...editingConfig, defaultSecret: e.target.value })} />
                </div>
              </fieldset>
              
              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">NAS-Specific Secrets (Optional)</legend>
                <div className="space-y-2 mt-2">
                    {Object.entries(editingConfig.nasSpecificSecrets || {}).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                            <Input value={key} readOnly className="font-mono"/>
                            <Input type="password" value={value} readOnly className="font-mono"/>
                            <Button variant="ghost" size="icon" onClick={() => handleNasSecretChange(key, '', 'remove')} className="text-destructive h-8 w-8">
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                        </div>
                    ))}
                     <div className="flex items-end gap-2 pt-2">
                        <div className="flex-1"><Label htmlFor="nas-key" className="text-xs">NAS Identifier (IP/Name)</Label><Input id="nas-key" value={nasSecretKey} onChange={(e) => setNasSecretKey(e.target.value)} placeholder="e.g., 10.0.0.1 or nas-01"/></div>
                        <div className="flex-1"><Label htmlFor="nas-value" className="text-xs">Secret</Label><Input id="nas-value" type="text" value={nasSecretValue} onChange={(e) => setNasSecretValue(e.target.value)} placeholder="Secret for this NAS"/></div>
                        <Button onClick={addNasSecretEntry} size="sm"><PlusCircle className="h-4 w-4"/></Button>
                    </div>
                </div>
              </fieldset>

              <fieldset className="border p-4 rounded-md">
                  <legend className="text-sm font-medium px-1 flex justify-between items-center w-full">
                    <span>Connection Test Sequence (Simulated)</span>
                    <Button variant="outline" size="sm" onClick={addCustomTestStep} className="ml-auto">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Custom Step
                    </Button>
                  </legend>
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
                                    />
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                     {step.isMandatory && <Badge variant="secondary" className="text-xs whitespace-nowrap">Mandatory</Badge>}
                                    <Switch 
                                        id={`step-enabled-${index}`}
                                        checked={step.isEnabled} 
                                        onCheckedChange={(checked) => handleTestStepChange(index, 'isEnabled', checked)}
                                        disabled={step.isMandatory}
                                        aria-label="Enable step"
                                    />
                                    {!step.isMandatory && (
                                        <Button variant="ghost" size="icon" onClick={() => removeTestStep(index)} className="text-destructive hover:text-destructive h-7 w-7">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <Label htmlFor={`step-cmd-${index}`} className="text-xs text-muted-foreground">Simulated Command</Label>
                                <Textarea 
                                    id={`step-cmd-${index}`}
                                    value={step.command} 
                                    onChange={(e) => handleTestStepChange(index, 'command', e.target.value)} 
                                    rows={1} 
                                    className="font-mono text-xs mt-1"
                                    placeholder="e.g., which radclient"
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
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    If provided, step succeeds if simulated output includes this text. Otherwise, AI decides.
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
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSaveConfig}><Save className="mr-2 h-4 w-4" /> Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Connection Result Dialog */}
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
              Showing (simulated) results of the connection and setup checks. 
              <span className="font-semibold text-destructive"> This is a simulation; no actual SSH or commands were run on your server.</span>
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
                      step.status === 'skipped' && 'bg-gray-500/10 dark:bg-gray-600/20',
                      step.status === 'running' && 'bg-blue-500/10 dark:bg-blue-600/20 animate-pulse',
                      step.status === 'pending' && 'bg-muted/50 dark:bg-muted/20'
                    )}>
                      <div className="flex items-center gap-2">
                        {step.status === 'success' && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />}
                        {step.status === 'failure' && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
                        {step.status === 'skipped' && <AlertTriangle className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
                        {step.status === 'running' && <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />}
                        {step.status === 'pending' && <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />}
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
                            {step.command && <p className="text-muted-foreground font-mono mb-1">Simulated command: <code className="text-foreground bg-background/50 px-1 rounded dark:bg-background/20">{step.command}</code></p>}
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

