import React, { useState } from 'react';
import { motion } from 'framer-motion';
import DMSLayout from '@/components/layout/DMSLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Grid3x3, List, Kanban, Flag } from 'lucide-react';

const Projects: React.FC = () => {
  const [view, setView] = useState<'grid' | 'list' | 'kanban'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const mockProjects = [
    {
      id: 'MZ-2025-FAC-002',
      country: '🇲🇿 Mozambique',
      client: 'Maamba Collieries Limited',
      name: 'Marine Cargo Insurance',
      type: 'Facultative',
      coverage: 'Marine Cargo',
      value: '$2,500,000',
      dueDate: '2025-03-15',
      status: 'Active',
      progress: 75,
    },
    {
      id: 'ZA-2025-TRT-001',
      country: '🇿🇦 South Africa',
      client: 'TransAxis Reinsurance',
      name: 'Property Treaty',
      type: 'Treaty',
      coverage: 'Property',
      value: '$5,000,000',
      dueDate: '2025-04-20',
      status: 'In Progress',
      progress: 45,
    },
    {
      id: 'ZM-2025-FAC-003',
      country: '🇿🇲 Zambia',
      client: 'Construction Corp',
      name: 'Construction All Risk',
      type: 'Facultative',
      coverage: 'Construction',
      value: '$3,200,000',
      dueDate: '2025-02-28',
      status: 'Pending Approval',
      progress: 60,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Pending Approval':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <DMSLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Project Management</h1>
            <p className="text-muted-foreground mt-1">Manage all client placements and reinsurance deals</p>
          </div>
          <Button className="bg-secondary hover:bg-secondary/90 gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        {/* Filters & View Toggle */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects by name, client, or reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={view === 'grid' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setView('grid')}
                  className={view === 'grid' ? 'bg-secondary hover:bg-secondary/90' : ''}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={view === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setView('list')}
                  className={view === 'list' ? 'bg-secondary hover:bg-secondary/90' : ''}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={view === 'kanban' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setView('kanban')}
                  className={view === 'kanban' ? 'bg-secondary hover:bg-secondary/90' : ''}
                >
                  <Kanban className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        {view === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer border-t-4 border-t-secondary">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {project.id}
                      </Badge>
                      <Badge className={getStatusColor(project.status)}>
                        {project.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <CardDescription className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Flag className="h-3 w-3" />
                        <span>{project.country}</span>
                      </div>
                      <div className="text-sm">{project.client}</div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <div className="font-medium">{project.type}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Value:</span>
                        <div className="font-medium">{project.value}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Coverage:</span>
                        <div className="font-medium">{project.coverage}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Due:</span>
                        <div className="font-medium">{project.dueDate}</div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold">{project.progress}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getProgressColor(project.progress)} transition-all duration-300`}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {view === 'list' && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Reference</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Country</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Client</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Project</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Value</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockProjects.map((project) => (
                      <tr key={project.id} className="border-b hover:bg-muted/30 cursor-pointer">
                        <td className="px-4 py-3 font-mono text-sm">{project.id}</td>
                        <td className="px-4 py-3 text-sm">{project.country}</td>
                        <td className="px-4 py-3 text-sm">{project.client}</td>
                        <td className="px-4 py-3 text-sm font-medium">{project.name}</td>
                        <td className="px-4 py-3 text-sm">{project.value}</td>
                        <td className="px-4 py-3">
                          <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[100px]">
                              <div
                                className={`h-full ${getProgressColor(project.progress)}`}
                                style={{ width: `${project.progress}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{project.progress}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {view === 'kanban' && (
          <div className="text-center py-12 text-muted-foreground">
            Kanban view coming soon...
          </div>
        )}
      </motion.div>
    </DMSLayout>
  );
};

export default Projects;
