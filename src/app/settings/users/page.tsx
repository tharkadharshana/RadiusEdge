
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit3, Trash2, Save, UserPlus, Users, Shield, MoreHorizontal, Loader2 } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export type UserRole = 'admin' | 'editor' | 'viewer' | 'operator';
export type UserStatus = 'active' | 'invited' | 'suspended';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  lastLogin: string; // ISO string
  status: UserStatus;
  // passwordHash is not typically sent to the client
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: "Error", description: "Could not fetch users.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditUser = (user: User | null) => {
    setEditingUser(user ? { ...user } : null);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setIsSaving(true);

    const isNew = editingUser.id === 'new-user-temp-id';
    const url = isNew ? '/api/settings/users' : `/api/settings/users/${editingUser.id}`;
    const method = isNew ? 'POST' : 'PUT';

    // Only send relevant fields for create/update
    const payload: Partial<User> = {
      email: editingUser.email,
      name: editingUser.name,
      role: editingUser.role,
    };
    if (!isNew) {
      payload.status = editingUser.status;
    }


    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isNew ? 'invite' : 'update'} user`);
      }
      const savedUser = await response.json();

      if (isNew) {
        setUsers(prev => [savedUser, ...prev]);
      } else {
        setUsers(prev => prev.map(u => u.id === savedUser.id ? savedUser : u));
      }
      handleEditUser(null);
      toast({ title: "Success", description: `User "${savedUser.name}" ${isNew ? 'invited' : 'updated'}.` });
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    
    setIsLoading(true); // Indicate activity
    try {
      const response = await fetch(`/api/settings/users/${userId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete user');
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast({ title: "User Deleted", description: "User successfully deleted." });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  const createNewUser = () => {
    handleEditUser({
      id: 'new-user-temp-id', // Temporary ID for new user
      email: '',
      name: '',
      role: 'viewer',
      lastLogin: '', // Will be set by backend or remain as default
      status: 'invited', // New users start as invited
    });
  };
  
  const formatLastLogin = (isoString: string) => {
    if (!isoString || new Date(isoString).getTime() === new Date(0).getTime()) return 'Never';
    try {
      return new Date(isoString).toLocaleString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="User Management"
        description="Manage users, roles, and permissions for RadiusEdge."
        actions={
          <Button onClick={createNewUser} disabled={isLoading || isSaving}>
            <UserPlus className="mr-2 h-4 w-4" /> Invite User
          </Button>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !users.length ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading users...</p>
            </div>
          ) : (
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
                        className={cn(
                            'capitalize',
                            user.status === 'active' && 'bg-green-100 text-green-700 border-green-300 dark:bg-green-700/30 dark:text-green-300 dark:border-green-600',
                            user.status === 'suspended' && 'bg-red-100 text-red-700 border-red-300 dark:bg-red-700/30 dark:text-red-300 dark:border-red-600',
                            user.status === 'invited' && 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-700/30 dark:text-blue-300 dark:border-blue-600'
                        )}
                    >
                        {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatLastLogin(user.lastLogin)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isSaving}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditUser(user)} disabled={isSaving}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit User
                        </DropdownMenuItem>
                        {/* <DropdownMenuItem disabled>
                          <Shield className="mr-2 h-4 w-4" /> Manage Permissions
                        </DropdownMenuItem> */}
                        <DropdownMenuSeparator />
                        {/* Conceptual actions - would require PUT requests to update status */}
                        {/* {user.status === 'active' && <DropdownMenuItem className="text-orange-600 focus:text-orange-600 focus:bg-orange-100" onClick={() => handleUpdateUserStatus(user.id, 'suspended')}>Suspend User</DropdownMenuItem>}
                        {user.status === 'suspended' && <DropdownMenuItem className="text-green-600 focus:text-green-600 focus:bg-green-100" onClick={() => handleUpdateUserStatus(user.id, 'active')}>Reactivate User</DropdownMenuItem>}
                        {user.status === 'invited' && <DropdownMenuItem className="text-blue-600 focus:text-blue-600 focus:bg-blue-100">Resend Invitation</DropdownMenuItem>} */}
                        <DropdownMenuItem onClick={() => handleDeleteUser(user.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={isSaving}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
               {!isLoading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No users found. Click "Invite User" to add team members.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {/* User Editor Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(isOpen) => !isOpen && handleEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                {editingUser?.id === 'new-user-temp-id' ? 'Invite New User' : `Edit User: ${editingUser?.name}`}
            </DialogTitle>
            <DialogDescription>
              Set user details and role. 
              {editingUser?.id === 'new-user-temp-id' && " An invitation email would typically be sent."}
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="user-name">Full Name</Label>
                <Input id="user-name" value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} placeholder="e.g., John Doe" disabled={isSaving}/>
              </div>
              <div>
                <Label htmlFor="user-email">Email Address</Label>
                <Input id="user-email" type="email" value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} placeholder="e.g., user@example.com" disabled={isSaving || editingUser.id !== 'new-user-temp-id'} />
                 {editingUser.id !== 'new-user-temp-id' && <p className="text-xs text-muted-foreground mt-1">Email cannot be changed for existing users.</p>}
              </div>
              <div>
                <Label htmlFor="user-role">Role</Label>
                <Select value={editingUser.role} onValueChange={(value) => setEditingUser({ ...editingUser, role: value as UserRole })} disabled={isSaving}>
                  <SelectTrigger id="user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (Full Access)</SelectItem>
                    <SelectItem value="editor">Editor (Manage Scenarios & Packets)</SelectItem>
                    <SelectItem value="operator">Operator (Run Tests)</SelectItem>
                    <SelectItem value="viewer">Viewer (View Results Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingUser.id !== 'new-user-temp-id' && (
                <div>
                    <Label htmlFor="user-status">Status</Label>
                    <Select value={editingUser.status} onValueChange={(value) => setEditingUser({ ...editingUser, status: value as User['status'] })} disabled={isSaving}>
                    <SelectTrigger id="user-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="invited">Invited</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
              )}
              {/* Conceptual: Password reset / send invite checkbox */}
              {/* <div className="flex items-center space-x-2">
                <Checkbox id="send-invite" defaultChecked={editingUser.id === 'new-user-temp-id'} />
                <Label htmlFor="send-invite" className="text-sm font-normal">
                  {editingUser.id === 'new-user-temp-id' ? 'Send invitation email to this user' : 'Notify user of changes'}
                </Label>
              </div> */}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
            <Button onClick={handleSaveUser} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editingUser?.id === 'new-user-temp-id' ? 'Invite User' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
