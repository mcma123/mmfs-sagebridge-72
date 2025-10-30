import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const UserAccess = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Mock roles and permissions data
  const roles = [
    {
      id: 1,
      name: 'Administrator',
      description: 'Full system access',
    },
    {
      id: 2,
      name: 'Manager',
      description: 'Department management access',
    },
    {
      id: 3,
      name: 'User',
      description: 'Basic user access',
    },
  ];

  const modules = [
    {
      id: 1,
      name: 'Dashboard',
      permissions: ['view', 'export'],
    },
    {
      id: 2,
      name: 'Entities',
      permissions: ['view', 'create', 'edit', 'delete'],
    },
    {
      id: 3,
      name: 'Debit/Credit Notes',
      permissions: ['view', 'create', 'edit', 'delete'],
    },
    {
      id: 4,
      name: 'Payment Reconciliation',
      permissions: ['view', 'create', 'edit', 'delete'],
    },
    {
      id: 5,
      name: 'Banking',
      permissions: ['view', 'create', 'edit', 'delete', 'export'],
    },
    {
      id: 6,
      name: 'Accounting',
      permissions: ['view', 'create', 'edit', 'delete', 'export'],
    },
    {
      id: 7,
      name: 'Reports',
      permissions: ['view', 'export'],
    },
    {
      id: 8,
      name: 'Administration',
      permissions: ['view', 'manage_users', 'manage_roles', 'system_settings'],
    },
    {
      id: 9,
      name: 'Settings',
      permissions: ['view', 'edit'],
    },
  ];

  const [selectedRole, setSelectedRole] = React.useState('Administrator');
  const [permissions, setPermissions] = React.useState<Record<string, string[]>>({
    Administrator: ['view', 'create', 'edit', 'delete', 'export', 'manage_users', 'manage_roles', 'system_settings'],
    Manager: ['view', 'create', 'edit', 'export'],
    User: ['view'],
  });

  const handlePermissionChange = (module: string, permission: string, checked: boolean) => {
    setPermissions(prev => {
      const rolePermissions = [...(prev[selectedRole] || [])];
      const permissionKey = `${module.toLowerCase()}_${permission}`;
      
      if (checked) {
        rolePermissions.push(permissionKey);
      } else {
        const index = rolePermissions.indexOf(permissionKey);
        if (index > -1) {
          rolePermissions.splice(index, 1);
        }
      }

      return {
        ...prev,
        [selectedRole]: rolePermissions,
      };
    });
  };

  const handleSave = () => {
    // TODO: Implement save logic
    console.log('Saving permissions:', permissions);
    
    toast({
      title: 'Success',
      description: 'User access settings have been saved successfully',
      variant: 'default',
    });
  };

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
        <h1 className="text-2xl font-semibold text-white mb-2">Control User Access</h1>
        <p className="text-white/80">Manage roles and permissions for different user types</p>
      </div>

      {/* Role Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="role">Select Role</Label>
              <Select
                value={selectedRole}
                onValueChange={setSelectedRole}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>

          {/* Permissions Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Permissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((module) => (
                <TableRow key={module.id}>
                  <TableCell className="font-medium">{module.name}</TableCell>
                  <TableCell>
                    <div className="flex gap-6">
                      {module.permissions.map((permission) => {
                        const permissionKey = `${module.name.toLowerCase()}_${permission}`;
                        return (
                          <div key={permission} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${module.id}-${permission}`}
                              checked={permissions[selectedRole]?.includes(permissionKey)}
                              onCheckedChange={(checked) => 
                                handlePermissionChange(module.name, permission, checked as boolean)
                              }
                            />
                            <Label
                              htmlFor={`${module.id}-${permission}`}
                              className="capitalize"
                            >
                              {permission.replace('_', ' ')}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </motion.div>
  );
};

export default UserAccess;