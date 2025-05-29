
"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit3, Trash2, Save, UserPlus, Users, Shield, MoreHorizontal } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserRole = 'admin' | 'editor' | 'viewer' | 'operator';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  lastLogin: string;
  status: 'active' | 'invited' | 'suspended';
}

const initialUsers: User[] = [
  { id: 'usr1', email: 'admin@radiusedge.com', name: 'Admin User', role: 'admin', lastLogin: '2024-07-21 10:00', status: 'active' },
  { id: 'usr2', email: 'editor@radiusedge.com', name: 'Scenario Editor', role: 'editor', lastLogin: '2024-07-20 15:30', status: 'active' },
  { id: 'usr3', email: 'viewer@radiusedge.com', name: 'Results Viewer', role: 'viewer', lastLogin: '2024-07-19 09:15', status: 'invited' },
  { id: 'usr4', email: 'operator@radiusedge.com', name: 'Test Operator', role: 'operator', lastLogin: '2024-07-21 11:00', status: 'suspended' },
];

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleEditUser = (user: User | null) => {
    setEditingUser(user ? { ...user } : null);
  };

  const handleSaveUser = () => {
    if (editingUser) {
      if (editingUser.id === 'new') {
        setUsers(prev => [...prev, { ...editingUser, id: `usr${Date.now()}`, lastLogin: 'Never (Invited)', status: 'invited' }]);
      } else {
        setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
      }
      handleEditUser(null);
    }
  };

  const createNewUser = () => {
    handleEditUser({
      id: 'new',
      email: '',
      name: '',
      role: 'viewer',
      lastLogin: '',
      status: 'invited',
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="User Management"
        description="Manage users, roles, and permissions for RadiusEdge."
        actions={
          <Button onClick={createNewUser}>
            <UserPlus className="mr-2 h-4 w-4" /> Invite User
          </Button>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{user.role}</Badge></TableCell>
                  <TableCell>
                    <Badge 
                        variant={user.status === 'active' ? 'default' : user.status === 'suspended' ? 'destructive' : 'outline'}
                        className={
                            user.status === 'active' ? 'bg-green-100 text-green-700 border-green-300' :
                            user.status === 'suspended' ? 'bg-red-100 text-red-700 border-red-300' :
                            'bg-blue-100 text-blue-700 border-blue-300'
                        }
                    >
                        {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.lastLogin}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditUser(user)}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Shield className="mr-2 h-4 w-4" /> Manage Permissions
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.status === 'active' && <DropdownMenuItem className="text-orange-600 focus:text-orange-600 focus:bg-orange-100">Suspend User</DropdownMenuItem>}
                        {user.status === 'suspended' && <DropdownMenuItem className="text-green-600 focus:text-green-600 focus:bg-green-100">Reactivate User</DropdownMenuItem>}
                        {user.status === 'invited' && <DropdownMenuItem className="text-blue-600 focus:text-blue-600 focus:bg-blue-100">Resend Invitation</DropdownMenuItem>}
                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                          <Trash2 className="mr-2 h-4 w-4" /> Remove User
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

      {/* User Editor Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(isOpen) => !isOpen && handleEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                {editingUser?.id === 'new' ? 'Invite New User' : `Edit User: ${editingUser?.name}`}
            </DialogTitle>
            <DialogDescription>
              Set user details and role. An invitation email will be sent if new.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="user-name">Full Name</Label>
                <Input id="user-name" value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} placeholder="e.g., John Doe" />
              </div>
              <div>
                <Label htmlFor="user-email">Email Address</Label>
                <Input id="user-email" type="email" value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} placeholder="e.g., user@example.com" />
              </div>
              <div>
                <Label htmlFor="user-role">Role</Label>
                <Select value={editingUser.role} onValueChange={(value) => setEditingUser({ ...editingUser, role: value as UserRole })}>
                  <SelectTrigger id="user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (Full Access)</SelectItem>
                    <SelectItem value="editor">Editor (Manage Scenarios & Packets)</SelectItem>
                    <SelectItem value="operator">Operator (Run Tests)</SelectItem>
                    <SelectItem value="viewer">Viewer (View Results Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingUser.id !== 'new' && (
                <div>
                    <Label htmlFor="user-status">Status</Label>
                    <Select value={editingUser.status} onValueChange={(value) => setEditingUser({ ...editingUser, status: value as User['status'] })}>
                    <SelectTrigger id="user-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="invited">Invited</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox id="send-invite" defaultChecked={editingUser.id === 'new'} />
                <Label htmlFor="send-invite" className="text-sm font-normal">
                  {editingUser.id === 'new' ? 'Send invitation email to this user' : 'Notify user of changes'}
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSaveUser}><Save className="mr-2 h-4 w-4" /> {editingUser?.id === 'new' ? 'Send Invitation' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
