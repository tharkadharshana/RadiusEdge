
"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit3, Trash2, Save, DatabaseZap, TestTube2, MoreHorizontal } from 'lucide-react';
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
} from "@/components/ui/dropdown-menu";

interface DbConnectionConfig {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'mssql' | 'sqlite';
  host: string;
  port: number;
  username: string;
  databaseName: string;
  status?: 'connected' | 'disconnected' | 'error';
}

const initialDbConfigs: DbConnectionConfig[] = [
  { id: 'db1', name: 'Primary User DB', type: 'mysql', host: 'db.example.com', port: 3306, username: 'radius_validator', databaseName: 'radius_users', status: 'connected' },
  { id: 'db2', name: 'Session Store (Postgres)', type: 'postgresql', host: 'pg.example.com', port: 5432, username: 'session_checker', databaseName: 'active_sessions', status: 'disconnected' },
];

export default function DatabaseValidationPage() {
  const [configs, setConfigs] = useState<DbConnectionConfig[]>(initialDbConfigs);
  const [editingConfig, setEditingConfig] = useState<DbConnectionConfig | null>(null);

  const handleEditConfig = (config: DbConnectionConfig | null) => {
    setEditingConfig(config ? JSON.parse(JSON.stringify(config)) : null); // Deep copy
  };

  const handleSaveConfig = () => {
    if (editingConfig) {
      if (editingConfig.id === 'new') {
        setConfigs(prev => [...prev, { ...editingConfig, id: `db${Date.now()}` }]);
      } else {
        setConfigs(prev => prev.map(c => c.id === editingConfig.id ? editingConfig : c));
      }
      handleEditConfig(null);
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
      databaseName: '',
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Database Validation Setup"
        description="Configure connections to external databases for validating test results."
        actions={
          <Button onClick={createNewConfig}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add DB Connection
          </Button>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Configured Database Connections</CardTitle>
        </CardHeader>
        <CardContent>
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
                          <TestTube2 className="mr-2 h-4 w-4" /> Test Connection
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

      {/* DB Config Editor Dialog */}
      <Dialog open={!!editingConfig} onOpenChange={(isOpen) => !isOpen && handleEditConfig(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <DatabaseZap className="h-6 w-6 text-primary" />
                {editingConfig?.id === 'new' ? 'Add New Database Connection' : `Edit Connection: ${editingConfig?.name}`}
            </DialogTitle>
            <DialogDescription>
              Provide connection details for your validation database.
            </DialogDescription>
          </DialogHeader>
          {editingConfig && (
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <Label htmlFor="db-name">Connection Name</Label>
                <Input id="db-name" value={editingConfig.name} onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })} placeholder="e.g., Main User DB" />
              </div>
              <div>
                <Label htmlFor="db-type">Database Type</Label>
                <Select value={editingConfig.type} onValueChange={(value) => setEditingConfig({ ...editingConfig, type: value as DbConnectionConfig['type'] })}>
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
                <Input id="db-host" value={editingConfig.host} onChange={(e) => setEditingConfig({ ...editingConfig, host: e.target.value })} placeholder="db.example.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="db-port">Port</Label>
                  <Input id="db-port" type="number" value={editingConfig.port} onChange={(e) => setEditingConfig({ ...editingConfig, port: parseInt(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="db-username">Username</Label>
                  <Input id="db-username" value={editingConfig.username} onChange={(e) => setEditingConfig({ ...editingConfig, username: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="db-password">Password</Label>
                <Input id="db-password" type="password" placeholder="Enter DB password (stored securely)" />
              </div>
              <div>
                <Label htmlFor="db-databaseName">Database Name</Label>
                <Input id="db-databaseName" value={editingConfig.databaseName} onChange={(e) => setEditingConfig({ ...editingConfig, databaseName: e.target.value })} placeholder="e.g., radius_data" />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSaveConfig}><Save className="mr-2 h-4 w-4" /> Save Connection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
