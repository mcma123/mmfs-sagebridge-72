import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, LayoutDashboard, ArrowRight } from 'lucide-react';
import mmfsLogo from '@/assets/mmfs-logo.jpg';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  const systems = [
    {
      title: 'Accounting System',
      description: 'Comprehensive financial management and accounting tools for your business operations.',
      icon: LayoutDashboard,
      route: '/login',
      gradient: 'from-primary via-primary/90 to-primary/80',
      available: true
    },
    {
      title: 'Document Management System',
      description: 'Efficient document organization, storage, and retrieval system.',
      icon: FileText,
      route: '/dms/login',
      gradient: 'from-secondary via-secondary/90 to-secondary/80',
      available: true
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/95 to-primary/90 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-1/2 h-full">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-l from-secondary/20 to-transparent transform skew-x-12 origin-top-right"></div>
      </div>
      
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-secondary/5 rounded-full blur-2xl"></div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          {/* Logo and Header */}
          <div className="flex flex-col items-center gap-6 mb-8">
            <motion.img
              src={mmfsLogo}
              alt="MMFS Logo"
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
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.2, duration: 0.6 }}
              >
                <Card
                  className={`group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl border-0 bg-white/95 backdrop-blur-sm overflow-hidden h-full ${
                    !system.available ? 'opacity-75' : ''
                  }`}
                  onClick={() => system.available && navigate(system.route)}
                >
                  <div className={`h-2 bg-gradient-to-r ${system.gradient}`}></div>
                  
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className={`p-4 rounded-xl bg-gradient-to-br ${system.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="h-8 w-8 text-white" />
                      </div>
                      {system.available && (
                        <ArrowRight className="h-6 w-6 text-primary group-hover:translate-x-2 transition-transform duration-300" />
                      )}
                    </div>
                    <CardTitle className="text-2xl font-bold text-primary mt-4">
                      {system.title}
                    </CardTitle>
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
          transition={{ delay: 1, duration: 0.6 }}
          className="text-center mt-16 text-white/70"
        >
          <p className="text-sm">
            © 2025 MMFS. All rights reserved.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Landing;
