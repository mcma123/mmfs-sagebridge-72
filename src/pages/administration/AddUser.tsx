import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/components/ui/use-toast';
import { createUser, updateUser, type CreateUserData, type UpdateUserData } from '@/lib/api/users';

// Schema for creating a new user (password required)
const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'accountant', 'editor', 'viewer']),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Schema for editing a user (password optional)
const editUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'accountant', 'editor', 'viewer']),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  // If password is provided, it must be at least 8 characters and match confirmation
  if (data.password && data.password.length > 0) {
    if (data.password.length < 8) return false;
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Password must be at least 8 characters and passwords must match",
  path: ["confirmPassword"],
});

type UserFormData = z.infer<typeof createUserSchema>;

const AddUser = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editUser = (location.state as any)?.editUser as { id: number, name: string, email: string, roles: string[] } | undefined;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<UserFormData>({
    resolver: zodResolver(editUser ? editUserSchema : createUserSchema),
    defaultValues: {
      role: (editUser?.roles?.[0] as any) || 'viewer',
      name: editUser?.name || '',
      email: editUser?.email || '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: UserFormData) => {
    setIsSubmitting(true);
    try {
      if (editUser) {
        // Update existing user
        const updateData: UpdateUserData = {
          name: data.name,
          email: data.email,
          roles: [data.role],
        };
        // Only include password if it's provided
        if (data.password && data.password.length > 0) {
          updateData.password = data.password;
        }
        await updateUser(editUser.id, updateData);
        toast({
          title: 'Success',
          description: 'User updated successfully'
        });
      } else {
        // Create new user
        const createData: CreateUserData = {
          name: data.name,
          email: data.email,
          password: data.password!,
          roles: [data.role],
        };
        await createUser(createData);
        toast({
          title: 'Success',
          description: 'User has been created successfully'
        });
      }
      navigate('/administration/users');
    } catch (error: any) {
      let description = error?.message || 'Failed to process request. Please try again.';

      // Handle specific error codes
      if (error.code === 'DUPLICATE_EMAIL' || error.status === 409) {
        description = 'This email address is already in use. Please use a different email.';
      } else if (error.status === 401 || error.status === 403) {
        description = 'You do not have permission to perform this action.';
      }

      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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
          onClick={() => navigate('/administration/users')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Button>
      </div>

      {/* Header Section */}
      <div className="bg-blue-600 rounded-lg p-6 shadow-lg">
        <h1 className="text-2xl font-semibold text-white mb-2">{editUser ? 'Edit User' : 'Add New User'}</h1>
        <p className="text-white/80">{editUser ? 'Update user information, role, or password' : 'Create a new user account with specific roles and permissions'}</p>
      </div>

      {/* Form Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Enter full name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="Enter email address"
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Role Field */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                onValueChange={(value) => setValue('role', value as UserFormData['role'])}
                defaultValue={(editUser?.roles?.[0] as any) || 'viewer'}
              >
                <SelectTrigger className={errors.role ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-red-500">{errors.role.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">
                Password {editUser && <span className="text-gray-500 font-normal text-xs">(optional)</span>}
              </Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder={editUser ? "Leave blank to keep current password" : "Enter password"}
                className={errors.password ? 'border-red-500' : ''}
              />
              {editUser && !errors.password && (
                <p className="text-sm text-gray-500">Leave blank to keep the current password</p>
              )}
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
                placeholder="Confirm password"
                className={errors.confirmPassword ? 'border-red-500' : ''}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/administration/users')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : (editUser ? 'Update User' : 'Create User')}
            </Button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default AddUser;