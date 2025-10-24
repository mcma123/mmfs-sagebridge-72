import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, LayoutDashboard, ArrowRight } from 'lucide-react';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  const systems = [
    {
      title: 'Accounting System',
      description: 'Marine insurance accounting with GL, Trial Balance, and more',
      icon: LayoutDashboard,
      path: '/login',
      available: true,
    },
    {
      title: 'Document Management System',
      description: 'Projects, progress tracking, and centralized document control',
      icon: FileText,
      path: '/dms/login',
      available: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/95 to-primary/90">
      <div className="container mx-auto px-6 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          {/* Logo and Header */}
          <div className="flex flex-col items-center gap-6 mb-8">
            <motion.img
              src="/banner.png"
              alt="MMFS Banner"
              className="h-24 w-auto rounded-lg shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            />
            <div>
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight">
                MMFS HUB
              </h1>
              <div className="h-1.5 w-32 bg-secondary mx-auto rounded-full"></div>
            </div>
          </div>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto font-light"
          >
            Your centralized platform for financial management and business operations
          </motion.p>
        </motion.div>

        {/* System Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {systems.map((system, index) => {
            const Icon = system.icon;
            return (
              <motion.div
                key={system.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
              >
                <Card
                  onClick={() => navigate(system.path)}
                  className="group hover:shadow-xl transition-shadow bg-white/95 border-0 shadow-lg cursor-pointer"
                >
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-secondary to-secondary/80">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-primary">
                          {system.title}
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                          {system.available ? 'Available' : 'Coming Soon'}
                        </CardDescription>
                      </div>
                    </div>
                    {!system.available && (
                      <span className="inline-block px-3 py-1 text-xs font-semibold text-secondary bg-secondary/10 rounded-full mt-2">
                        Coming Soon
                      </span>
                    )}
                  </CardHeader>
                  
                  <CardContent>
                    <CardDescription className="text-base text-muted-foreground leading-relaxed">
                      {system.description}
                    </CardDescription>
                    
                    {system.available && (
                      <div className="mt-6 flex items-center gap-2 text-primary font-semibold group-hover:gap-4 transition-all duration-300">
                        <span>Access System</span>
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center mt-16 text-white/70"
        >
          <p>© {new Date().getFullYear()} MMFS. All rights reserved.</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Landing;
