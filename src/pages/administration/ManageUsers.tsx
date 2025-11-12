import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Search, MoreVertical, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { listUsers, deactivateUser, deleteUser, resetUserPassword } from '@/lib/api/users';
import type { User } from '@/lib/api/users';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const ManageUsers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: number; name: string; email: string } | null>(null);
  const [passwordResetDialogOpen, setPasswordResetDialogOpen] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<{ id: number; name: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  async function fetchUsers() {
    setLoading(true); setError(null);
    try {
      const data = await listUsers();
      const items = (data.items || []).map((u: User) => ({
        id: u.id,
        name: u.display_name || '',
        email: u.email,
        roles: u.roles,
        status: u.is_active ? 'Active' : 'Inactive',
        lastLogin: u.last_login_at || '-',
      }));
      setUsers(items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
      toast({
        title: 'Error',
        description: err?.message || 'Failed to load users',
        variant: 'destructive',
      });
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleDeactivateUser(id: number) {
    try {
      await deactivateUser(id);
      toast({
        title: 'Success',
        description: 'User has been deactivated successfully',
      });
      await fetchUsers();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to deactivate user',
        variant: 'destructive',
      });
    }
  }

  function openDeleteDialog(user: { id: number; name: string; email: string }) {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;

    try {
      await deleteUser(userToDelete.id);
      toast({
        title: 'Success',
        description: 'User has been deleted successfully',
      });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      await fetchUsers();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to delete user',
        variant: 'destructive',
      });
    }
  }

  function openPasswordResetDialog(user: { id: number; name: string; email: string }) {
    setUserToResetPassword(user);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordResetDialogOpen(true);
  }

  async function handlePasswordReset() {
    if (!userToResetPassword) return;

    // Validation
    setPasswordError('');

    if (!newPassword) {
      setPasswordError('Password is required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      await resetUserPassword(userToResetPassword.id, newPassword);
      toast({
        title: 'Success',
        description: 'Password has been reset successfully',
      });
      setPasswordResetDialogOpen(false);
      setUserToResetPassword(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to reset password',
        variant: 'destructive',
      });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-6"
    >
      {/* Back Button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-2 text-sm font-medium"
          onClick={() => navigate('/administration')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Administration
        </Button>
      </div>

      {/* Header Section */}
      <div className="bg-blue-600 rounded-lg p-6 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-2">Manage Users</h1>
            <p className="text-white/80">Add, edit, or deactivate user accounts</p>
          </div>
          <Button 
            className="bg-white text-blue-600 hover:bg-white/90 hover:text-blue-700 shadow-md"
            onClick={() => navigate('/administration/users/add')}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search users..."
            className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20"
          />
        </div>
        <Button variant="outline" className="border-gray-200">
          Filter
        </Button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{Array.isArray(user.roles) ? user.roles.join(', ') : '-'}</TableCell>
                <TableCell>
                  <Badge 
                    variant={user.status === 'Active' ? 'default' : 'secondary'}
                    className={user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}
                  >
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell>{user.lastLogin}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/administration/users/add`, { state: { editUser: user } })}>
                        Edit User
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openPasswordResetDialog(user)}>
                        Change Password
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-orange-600"
                        onClick={() => handleDeactivateUser(user.id)}
                      >
                        Deactivate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => openDeleteDialog(user)}
                      >
                        Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.name || userToDelete?.email}</strong>?
              <br /><br />
              This action cannot be undone. The user will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Reset Dialog */}
      <Dialog open={passwordResetDialogOpen} onOpenChange={setPasswordResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for <strong>{userToResetPassword?.name || userToResetPassword?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={passwordError ? 'border-red-500' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={passwordError ? 'border-red-500' : ''}
              />
            </div>
            {passwordError && (
              <p className="text-sm text-red-500">{passwordError}</p>
            )}
            <p className="text-sm text-gray-500">
              Password must be at least 8 characters long.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPasswordResetDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePasswordReset}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default ManageUsers;