import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Lock, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DMSLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Demo credentials
    if (email === 'demo@mmfs.com' && password === 'demo123') {
      toast({
        title: 'Login Successful',
        description: 'Welcome to MMFS Document Management System',
      });
      navigate('/dms/dashboard');
    } else {
      toast({
        title: 'Login Failed',
        description: 'Invalid credentials. Try demo@mmfs.com / demo123',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/95 to-primary/90 relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute top-0 right-0 w-1/2 h-full">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-l from-secondary/20 to-transparent transform skew-x-12 origin-top-right"></div>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <motion.img
            src="/banner.png"
            alt="MMFS Banner"
            className="h-20 w-auto mx-auto mb-4 rounded-lg shadow-2xl"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
          />
          <h1 className="text-3xl font-bold text-white mb-2">Document Management System</h1>
          <p className="text-white/80">Sign in to access your projects</p>
        </div>

        <Card className="shadow-2xl border-0">
          <div className="h-2 bg-gradient-to-r from-secondary via-secondary/90 to-secondary/80"></div>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-secondary to-secondary/80">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-primary">Sign In</CardTitle>
            </div>
            <CardDescription>Enter your credentials to access DMS</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="demo@mmfs.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-3 text-sm">
                <p className="font-semibold text-secondary mb-1">Demo Credentials:</p>
                <p className="text-muted-foreground">Email: demo@mmfs.com</p>
                <p className="text-muted-foreground">Password: demo123</p>
              </div>

              <Button
                type="submit"
                className="w-full bg-secondary hover:bg-secondary/90 text-white shadow-lg"
              >
                Sign In
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/')}
                className="text-sm text-primary hover:underline"
              >
                ← Back to MMFS Hub
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default DMSLogin;
