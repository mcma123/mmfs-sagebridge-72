
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getUserInitials, formatUserRole } from '@/lib/utils';

const ProfileSettings: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Load user data on mount
  useEffect(() => {
    if (user) {
      setName(user.displayName || '');
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || name.trim().length === 0) {
      toast({
        title: "Validation Error",
        description: "Name is required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      await updateProfile(name.trim());
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Manage your personal information and profile settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col gap-8 sm:flex-row">
            <div className="flex flex-col items-center gap-2 sm:w-1/3">
              <Avatar className="h-24 w-24 bg-sage-blue text-primary-foreground">
                <AvatarImage alt="User avatar" src="/placeholder.svg" />
                <AvatarFallback className="text-3xl font-semibold">
                  {getUserInitials(user?.displayName || user?.email)}
                </AvatarFallback>
              </Avatar>
              <Badge variant="secondary" className="mt-2">
                {formatUserRole(user?.role)}
              </Badge>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Profile picture coming soon
              </p>
            </div>
            
            <div className="space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  value={user?.id || ''}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <Label>Account Status</Label>
                <div className="flex gap-2">
                  <Badge variant={user?.isActive ? "default" : "secondary"}>
                    {user?.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {user?.lastLoginAt && (
                    <span className="text-sm text-muted-foreground">
                      Last login: {new Date(user.lastLoginAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline">Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProfileSettings;
