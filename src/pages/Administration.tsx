import React from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, Key, User, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const Administration = () => {
  const navigate = useNavigate();

  const adminFeatures = [
    {
      title: 'Manage Users',
      description: 'Add, edit, or deactivate user accounts',
      icon: Users,
      path: '/administration/users'
    },
    {
      title: 'Control User Access',
      description: 'Manage roles and permissions',
      icon: Shield,
      path: '/administration/access'
    },
    {
      title: 'Change Password',
      description: 'Update your account password',
      icon: Key,
      path: '/administration/password'
    },
    {
      title: 'My Account',
      description: 'View and edit your profile',
      icon: User,
      path: '/administration/account'
    }
  ];

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
          onClick={() => navigate('/accounting')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Menu
        </Button>
      </div>

      {/* Header Section */}
      <div className="bg-blue-600 rounded-lg p-6 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-2">Administration</h1>
            <p className="text-white/80">Manage users, roles, and account settings</p>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminFeatures.map((feature) => (
          <Card
            key={feature.title}
            className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-md"
            onClick={() => navigate(feature.path)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-50">
                  <feature.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                Configure →
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* Logout Card */}
        <Card 
          className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-md bg-red-50"
          onClick={() => navigate('/logout')}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100">
                <LogOut className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Logout</CardTitle>
                <CardDescription>Sign out of your account</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    </motion.div>
  );
};

export default Administration;