import React, { useState } from 'react';
import { motion } from 'framer-motion';
import DMSLayout from '@/components/layout/DMSLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Grid3x3, List, Kanban, Flag } from 'lucide-react';
import SlideOutPanel from '@/components/ui/slide-out-panel';
import NewProjectForm, { ProjectFormData } from '@/components/dms/NewProjectForm';
import { toast } from '@/hooks/use-toast';
import { useProjects } from '@/lib/store/projects';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { updateProjectStatus, createProjectNote } from '@/lib/api/projects';

const Projects: React.FC = () => {
  const [view, setView] = useState<'grid' | 'list' | 'kanban'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const { projects, addProject, updateStatus, addNote } = useProjects();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Pending Approval':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Done':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Cancelled':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Draft':
        return 'bg-muted text-muted-foreground border-border';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-emerald-500 dark:brightness-110';
    if (progress >= 40) return 'bg-amber-500 dark:brightness-110';
    return 'bg-rose-500 dark:brightness-110';
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
          <Button className="bg-secondary hover:bg-secondary/90 text-secondary-foreground gap-2" onClick={() => setNewProjectOpen(true)}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        <SlideOutPanel title="New Project" open={newProjectOpen} onOpenChange={setNewProjectOpen}>
          <NewProjectForm
            onCreate={(data: ProjectFormData) => {
              const currencySymbol = (c: ProjectFormData['currency']) => {
                switch (c) {
                  case 'USD': return '$';
                  case 'EUR': return '€';
                  case 'GBP': return '£';
                  case 'ZAR': return 'R';
                  default: return '';
                }
              };
              const formattedValue = `${currencySymbol(data.currency)}${new Intl.NumberFormat().format(data.value)}`;
              const newItem = {
                id: `PRJ-${Date.now()}`,
                country: data.country,
                client: data.clientName,
                name: data.projectName,
                type: data.projectType,
                coverage: data.coverage,
                value: formattedValue,
                dueDate: data.endDate || data.startDate,
                status: data.status,
                progress: 0,
              };
              addProject(newItem);
              setNewProjectOpen(false);
              toast({ title: 'Project created', description: `${newItem.name} added to the list` });
            }}
            onCancel={() => setNewProjectOpen(false)}
          />
        </SlideOutPanel>

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
            {projects
              .filter(p => (
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.id.toLowerCase().includes(searchQuery.toLowerCase())
              ))
              .map((project, index) => (
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Badge
                            className={getStatusColor(project.status)}
                            aria-label={`Project status: ${project.status}`}
                            title={`Change status for ${project.name}`}
                            role="button"
                            tabIndex={0}
                          >
                            {project.status}
                          </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                              {['Draft','Active','Pending Approval','In Progress','Done','Cancelled'].map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  aria-label={`Set status to ${s}`}
                                  onClick={async () => {
                                    const prev = project.status;
                                    updateStatus(project.id, s as any);
                                    try {
                                      await updateProjectStatus(project.id, s as any);
                                      toast({ title: 'Status updated', description: `${project.name} → ${s}` });
                                    } catch (e) {
                                      updateStatus(project.id, prev);
                                      toast({ title: 'Update failed', description: 'Could not change status', variant: 'destructive' });
                                    }
                                  }}
                                >
                                  {s}
                                </DropdownMenuItem>
                              ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getProgressColor(project.progress)} transition-all duration-300`}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Notes Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Notes</span>
                        {project.latestNote && (
                          <Badge variant="outline" className="text-xs">Latest</Badge>
                        )}
                      </div>
                      {project.latestNote ? (
                        <div className="text-sm">{project.latestNote}</div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No notes yet</div>
                      )}
                      <Textarea
                        placeholder="Add note..."
                        value={noteDrafts[project.id] || ''}
                        onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [project.id]: e.target.value }))}
                        className="min-h-[60px]"
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={async () => {
                            const text = (noteDrafts[project.id] || '').trim();
                            if (!text) return;
                            try {
                              await createProjectNote(project.id, text);
                              addNote(project.id, text);
                              setNoteDrafts((prev) => ({ ...prev, [project.id]: '' }));
                              toast({ title: 'Note added', description: 'Your note has been saved.' });
                            } catch (e) {
                              toast({ title: 'Note failed', description: 'Could not save note', variant: 'destructive' });
                            }
                          }}
                          disabled={!noteDrafts[project.id] || !noteDrafts[project.id].trim()}
                        >
                          Save Note
                        </Button>
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
                    {projects
                      .filter(p => (
                        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.id.toLowerCase().includes(searchQuery.toLowerCase())
                      ))
                      .map((project) => (
                      <tr key={project.id} className="border-b hover:bg-muted/30 cursor-pointer">
                        <td className="px-4 py-3 font-mono text-sm">{project.id}</td>
                        <td className="px-4 py-3 text-sm">{project.country}</td>
                        <td className="px-4 py-3 text-sm">{project.client}</td>
                        <td className="px-4 py-3 text-sm font-medium">{project.name}</td>
                        <td className="px-4 py-3 text-sm">{project.value}</td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Badge
                                className={getStatusColor(project.status)}
                                aria-label={`Project status: ${project.status}`}
                                title={`Change status for ${project.name}`}
                                role="button"
                                tabIndex={0}
                              >
                                {project.status}
                              </Badge>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {['Draft','Active','Pending Approval','In Progress','Done','Cancelled'].map((s) => (
                            <DropdownMenuItem
                              key={s}
                              aria-label={`Set status to ${s}`}
                              onClick={async () => {
                                const prev = project.status;
                                updateStatus(project.id, s as any);
                                try {
                                  await updateProjectStatus(project.id, s as any);
                                  toast({ title: 'Status updated', description: `${project.name} → ${s}` });
                                } catch (e) {
                                  updateStatus(project.id, prev);
                                  toast({ title: 'Update failed', description: 'Could not change status', variant: 'destructive' });
                                }
                              }}
                            >
                              {s}
                            </DropdownMenuItem>
                          ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[100px]">
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
