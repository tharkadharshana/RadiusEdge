
"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit3, Trash2, Save, Server as ServerIcon, KeyRound, ShieldCheck, MoreHorizontal } from 'lucide-react';
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

interface ServerConfig {
  id: string;
  name: string;
  type: 'freeradius' | 'custom' | 'other';
  host: string;
  sshPort: number;
  sshUser: string;
  authMethod: 'key' | 'password';
  radiusAuthPort: number;
  radiusAcctPort: number;
  defaultSecret: string;
  nasSpecificSecrets?: Record<string, string>; // e.g., { "nas-01": "secret" }
  status?: 'connected' | 'disconnected' | 'unknown'; // Added for display
}

const initialServerConfigs: ServerConfig[] = [
  { id: 'srv1', name: 'EU-Prod-FR-01', type: 'freeradius', host: 'radius-eu.example.com', sshPort: 22, sshUser: 'radius-admin', authMethod: 'key', radiusAuthPort: 1812, radiusAcctPort: 1813, defaultSecret: 'secret123', status: 'connected' },
  { id: 'srv2', name: 'US-Staging-Custom', type: 'custom', host: 'staging-us-radius.example.net', sshPort: 22022, sshUser: 'deploy', authMethod: 'password', radiusAuthPort: 11812, radiusAcctPort: 11813, defaultSecret: 'staging_secret', status: 'disconnected' },
];

export default function ServerConfigPage() {
  const [configs, setConfigs] = useState<ServerConfig[]>(initialServerConfigs);
  const [editingConfig, setEditingConfig] = useState<ServerConfig | null>(null);
  const [nasSecretKey, setNasSecretKey] = useState('');
  const [nasSecretValue, setNasSecretValue] = useState('');

  const handleEditConfig = (config: ServerConfig | null) => {
    setEditingConfig(config ? JSON.parse(JSON.stringify(config)) : null); // Deep copy
    setNasSecretKey('');
    setNasSecretValue('');
  };

  const handleSaveConfig = () => {
    if (editingConfig) {
      if (editingConfig.id === 'new') {
        setConfigs(prev => [...prev, { ...editingConfig, id: `srv${Date.now()}` }]);
      } else {
        setConfigs(prev => prev.map(c => c.id === editingConfig.id ? editingConfig : c));
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
      radiusAuthPort: 1812,
      radiusAcctPort: 1813,
      defaultSecret: '',
      nasSpecificSecrets: {},
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
                  <TableCell>
                    <Badge variant={config.status === 'connected' ? 'default' : 'destructive'} className={config.status === 'connected' ? 'bg-green-500/20 text-green-700 border-green-400' : 'bg-red-500/20 text-red-700 border-red-400'}>
                      {config.status || 'unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditConfig(config)}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <ShieldCheck className="mr-2 h-4 w-4" /> Test Connection
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Server Config Editor Dialog */}
      <Dialog open={!!editingConfig} onOpenChange={(isOpen) => !isOpen && handleEditConfig(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <ServerIcon className="h-6 w-6 text-primary" />
                {editingConfig?.id === 'new' ? 'Add New Server Configuration' : `Edit Server: ${editingConfig?.name}`}
            </DialogTitle>
            <DialogDescription>
              Provide connection details for your RADIUS server.
            </DialogDescription>
          </DialogHeader>
          {editingConfig && (
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
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
                <Label htmlFor="server-host">Hostname or IP Address</Label>
                <Input id="server-host" value={editingConfig.host} onChange={(e) => setEditingConfig({ ...editingConfig, host: e.target.value })} placeholder="radius.example.com" />
              </div>

              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">SSH Details (for radclient execution)</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <Label htmlFor="ssh-port">SSH Port</Label>
                        <Input id="ssh-port" type="number" value={editingConfig.sshPort} onChange={(e) => setEditingConfig({ ...editingConfig, sshPort: parseInt(e.target.value) })} />
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
                    {editingConfig.authMethod === 'key' && (
                        <div>
                            <Label htmlFor="ssh-key">SSH Private Key</Label>
                            <Textarea id="ssh-key" placeholder="Paste your private key here (will be stored encrypted)" rows={3}/>
                            <p className="text-xs text-muted-foreground mt-1">Or upload key file (not implemented)</p>
                        </div>
                    )}
                    {editingConfig.authMethod === 'password' && (
                         <div>
                            <Label htmlFor="ssh-password">SSH Password</Label>
                            <Input id="ssh-password" type="password" placeholder="Enter SSH password"/>
                        </div>
                    )}
                </div>
              </fieldset>

              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">RADIUS Ports & Secrets</legend>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <Label htmlFor="radius-auth-port">RADIUS Auth Port</Label>
                        <Input id="radius-auth-port" type="number" value={editingConfig.radiusAuthPort} onChange={(e) => setEditingConfig({ ...editingConfig, radiusAuthPort: parseInt(e.target.value) })} />
                    </div>
                    <div>
                        <Label htmlFor="radius-acct-port">RADIUS Acct Port</Label>
                        <Input id="radius-acct-port" type="number" value={editingConfig.radiusAcctPort} onChange={(e) => setEditingConfig({ ...editingConfig, radiusAcctPort: parseInt(e.target.value) })} />
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
                        <div className="flex-1"><Label htmlFor="nas-value" className="text-xs">Secret</Label><Input id="nas-value" type="password" value={nasSecretValue} onChange={(e) => setNasSecretValue(e.target.value)} placeholder="Secret for this NAS"/></div>
                        <Button onClick={addNasSecretEntry} size="sm"><PlusCircle className="h-4 w-4"/></Button>
                    </div>
                </div>
              </fieldset>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSaveConfig}><Save className="mr-2 h-4 w-4" /> Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
