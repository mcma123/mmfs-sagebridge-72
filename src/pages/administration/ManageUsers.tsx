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

const ManageUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchUsers() {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/v1/administration/users', {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      });
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      const items = (data.items || []).map((u: any) => ({
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
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchUsers(); }, []);

  async function deactivateUser(id: number) {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/v1/administration/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ is_active: false }),
      });
      if (!res.ok) throw new Error('Failed to deactivate');
      await fetchUsers();
    } catch (err) {
      console.error(err);
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
                      <DropdownMenuItem onClick={() => navigate(`/administration/users/add`, { state: { editUser: user } })}>Edit User</DropdownMenuItem>
                      <DropdownMenuItem>Change Password</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => deactivateUser(user.id)}>Deactivate</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
};

export default ManageUsers;