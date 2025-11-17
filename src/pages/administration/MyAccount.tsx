import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Mail, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

const profileSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email address'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const MyAccount = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, updateProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: '',
      email: '',
    },
  });

  // Update form when user data loads
  useEffect(() => {
    if (user) {
      reset({
        displayName: user.displayName || '',
        email: user.email || '',
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      await updateProfile(data.displayName);

      toast({
        title: 'Success',
        description: 'Profile has been updated successfully',
      });

      // Reset form dirty state
      reset(data);
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return '??';
    if (user.displayName) {
      const names = user.displayName.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      }
      return user.displayName.substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Show error if no user
  if (!user) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to load user profile. Please try logging in again.
          </AlertDescription>
        </Alert>
      </div>
    );
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
        <h1 className="text-2xl font-semibold text-white mb-2">My Account</h1>
        <p className="text-white/80">View and update your profile information</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Profile Picture */}
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-2xl bg-blue-100 text-blue-600">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{user.displayName || 'No name set'}</h2>
              <p className="text-gray-500 capitalize">{user.role || 'User'}</p>
              <p className="text-xs text-gray-400 mt-1">
                Account Status: <span className={user.isActive ? 'text-green-600' : 'text-red-600'}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </p>
            </div>
          </div>

          <Separator />

          {/* Personal Information */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Display Name Field */}
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="displayName"
                    {...register('displayName')}
                    className={`pl-10 ${errors.displayName ? 'border-red-500' : ''}`}
                    placeholder="Enter your display name"
                  />
                </div>
                {errors.displayName && (
                  <p className="text-sm text-red-500">{errors.displayName.message}</p>
                )}
              </div>

              {/* Email Field (Read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="email"
                    {...register('email')}
                    className="pl-10 bg-gray-50 cursor-not-allowed"
                    readOnly
                    disabled
                  />
                </div>
                <p className="text-xs text-gray-500">Email address cannot be changed</p>
              </div>
            </div>

            {/* Account Information */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Account Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">User ID:</span>
                  <span className="ml-2 font-medium">#{user.id}</span>
                </div>
                <div>
                  <span className="text-gray-500">Role:</span>
                  <span className="ml-2 font-medium capitalize">{user.role}</span>
                </div>
                {user.createdAt && (
                  <div>
                    <span className="text-gray-500">Member Since:</span>
                    <span className="ml-2 font-medium">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {user.lastLoginAt && (
                  <div>
                    <span className="text-gray-500">Last Login:</span>
                    <span className="ml-2 font-medium">
                      {new Date(user.lastLoginAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Password Change Note */}
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Password Changes:</strong> Contact your system administrator to reset your password.
              </AlertDescription>
            </Alert>
          </div>

          <Separator />

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/administration')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!isDirty || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default MyAccount; 