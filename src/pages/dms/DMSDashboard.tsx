import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DMSLayout from '@/components/layout/DMSLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderKanban, TrendingUp, FileText, CheckSquare, ArrowRight } from 'lucide-react';

const DMSDashboard: React.FC = () => {
  const navigate = useNavigate();

  const modules = [
    {
      title: 'Project Management',
      description: 'Central hub for all client placements and reinsurance deals',
      icon: FolderKanban,
      route: '/dms/projects',
      stats: { label: 'Active Projects', value: '3' },
      gradient: 'from-primary to-primary/90',
    },
    {
      title: 'Progress Tracker',
      description: 'Visual tracking so everyone knows project status at a glance',
      icon: TrendingUp,
      route: '/dms/progress',
      stats: { label: 'On Track', value: '75%' },
      gradient: 'from-primary to-primary/90',
      featured: true,
    },
    {
      title: 'Document Management',
      description: 'Store and organize all files related to each project',
      icon: FileText,
      route: '/dms/documents',
      stats: { label: 'Total Documents', value: '85' },
      gradient: 'from-primary to-primary/90',
    },
    {
      title: 'Task Board',
      description: 'Simple task management linked to projects',
      icon: CheckSquare,
      route: '/dms/tasks',
      stats: { label: 'Pending Tasks', value: '7' },
      gradient: 'from-primary to-primary/90',
    },
  ];

  return (
    <DMSLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-8"
      >
        {/* Welcome Section */}
        <div>
          <h1 className="text-4xl font-bold text-primary mb-2">Welcome to DMS</h1>
          <p className="text-muted-foreground text-lg">
            Manage your projects, documents, and tasks in one centralized platform
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((module, index) => {
            const Icon = module.icon;
            return (
              <motion.div
                key={module.title}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl border-0 overflow-hidden h-full ${
                    module.featured ? 'ring-2 ring-secondary ring-offset-2' : ''
                  }`}
                  onClick={() => navigate(module.route)}
                >
                  <div className={`h-2 bg-gradient-to-r ${module.gradient}`}></div>
                  
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-4 rounded-xl bg-gradient-to-br ${module.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="h-8 w-8 text-primary-foreground" />
                      </div>
                      {module.featured && (
                        <span className="px-3 py-1 text-xs font-bold text-secondary bg-secondary/10 rounded-full">
                          ⭐ MOST IMPORTANT
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-2xl font-bold text-primary">
                      {module.title}
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                      {module.description}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">{module.stats.label}</p>
                        <p className="text-3xl font-bold text-primary">{module.stats.value}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-primary font-semibold group-hover:gap-4 transition-all duration-300">
                      <span>Open Module</span>
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Quick Stats */}
        <Card className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground border-0">
          <CardHeader>
            <CardTitle className="text-primary-foreground">System Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-primary-foreground/70 text-sm">Total Projects</p>
                <p className="text-4xl font-bold">12</p>
              </div>
              <div>
                <p className="text-primary-foreground/70 text-sm">Documents</p>
                <p className="text-4xl font-bold">85</p>
              </div>
              <div>
                <p className="text-primary-foreground/70 text-sm">Active Tasks</p>
                <p className="text-4xl font-bold">7</p>
              </div>
              <div>
                <p className="text-primary-foreground/70 text-sm">Team Members</p>
                <p className="text-4xl font-bold">5</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </DMSLayout>
  );
};

export default DMSDashboard;
