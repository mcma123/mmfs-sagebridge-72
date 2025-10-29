import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import DMSLayout from '@/components/layout/DMSLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TrendingUp, Clock, AlertCircle, Users, Edit } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { UpdateProgressDrawer } from '@/components/ui/UpdateProgressDrawer';
import { updateProjectProgress, updateProjectStatus } from '@/lib/api/projects';
import { useToast } from '@/hooks/use-toast';
import { useProjects } from '@/lib/store/projects';

const ProgressTracker: React.FC = () => {
  const { toast } = useToast();
  const { projects, updateProgress, updateStatus, addNote } = useProjects();
  // Local preview overrides so adjusting the slider live-updates UI without mutating the shared store
  const [previewProgress, setPreviewProgress] = useState<Record<string, number>>({});

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [initialProgress, setInitialProgress] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [initialStatus, setInitialStatus] = useState<import('@/lib/store/projects').ProjectStatus | null>(null);

  const currentProject = useMemo(() => projects.find(p => p.id === currentProjectId) || null, [projects, currentProjectId]);

  const getProgressColor = (progress: number) => {
    if (progress >= 80)
      return {
        bar: 'bg-emerald-500 dark:brightness-110',
        text: 'text-emerald-600',
        badge: 'bg-emerald-100 text-emerald-800',
        borderClass: 'border-emerald-500 dark:brightness-110',
      };
    if (progress >= 40)
      return {
        bar: 'bg-amber-500 dark:brightness-110',
        text: 'text-amber-600',
        badge: 'bg-amber-100 text-amber-800',
        borderClass: 'border-amber-500 dark:brightness-110',
      };
    return {
      bar: 'bg-rose-500 dark:brightness-110',
      text: 'text-rose-600',
      badge: 'bg-rose-100 text-rose-800',
      borderClass: 'border-rose-500 dark:brightness-110',
    };
  };

  const getProgressStatus = (progress: number) => {
    if (progress >= 80) return 'On Track';
    if (progress >= 40) return 'In Progress';
    return 'Behind Schedule';
  };

  const openDrawerFor = (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    const effective = previewProgress[projectId] ?? proj.progress;
    setCurrentProjectId(projectId);
    setInitialProgress(effective);
    setInitialStatus(proj.status);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    // Revert preview by clearing local override
    if (currentProjectId !== null) {
      setPreviewProgress((prev) => {
        const next = { ...prev };
        delete next[currentProjectId!];
        return next;
      });
    }
    setDrawerOpen(false);
    setCurrentProjectId(null);
    setInitialStatus(null);
  };

  const handlePreviewChange = (value: number) => {
    if (currentProjectId === null) return;
    const clamped = Math.max(0, Math.min(100, value));
    setPreviewProgress((prev) => ({ ...prev, [currentProjectId!]: clamped }));
  };

  const handleSave = async (newValue: number, note?: string, status?: import('@/lib/store/projects').ProjectStatus) => {
    if (currentProjectId === null) return;
    if (newValue === initialProgress) { closeDrawer(); return; }
    try {
      setSaving(true);
      const prevStatus = initialStatus ?? projects.find(p => p.id === currentProjectId)?.status;
      const prevProgress = initialProgress;

      let statusOk = true;
      let progressOk = true;

      // If status changed, optimistic update and persist
      if (status && prevStatus && status !== prevStatus) {
        updateStatus(currentProjectId, status);
        try {
          await updateProjectStatus(currentProjectId, status);
        } catch (e) {
          statusOk = false;
          updateStatus(currentProjectId, prevStatus);
          toast({ title: 'Status update failed', description: 'Could not change status', variant: 'destructive' });
        }
      }

      // Progress update (even if status forces an adjustment, we still call API with requested value)
      if (newValue !== prevProgress) {
        updateProgress(currentProjectId, newValue);
        try {
          await updateProjectProgress(currentProjectId, newValue, note);
        } catch (e) {
          progressOk = false;
          updateProgress(currentProjectId, prevProgress);
          toast({ title: 'Progress update failed', description: 'Could not save progress', variant: 'destructive' });
        }
      } else if (note && note.trim()) {
        // Persist note even if progress unchanged
        try {
          await updateProjectProgress(currentProjectId, prevProgress, note);
        } catch (e) {
          // API failed to persist note; still keep it locally for now
        }
      }

      if (note && note.trim()) addNote(currentProjectId, note.trim());

      if (statusOk || progressOk) {
        const msgParts = [] as string[];
        if (status && prevStatus && status !== prevStatus && statusOk) msgParts.push(`Status → ${status}`);
        if (newValue !== prevProgress && progressOk) msgParts.push(`Progress → ${newValue}%`);
        toast({ title: 'Update saved', description: msgParts.join(' • ') || 'No changes' });
      }
    } catch (e) {
      // General failure safety net
      updateProgress(currentProjectId, initialProgress);
      if (initialStatus) updateStatus(currentProjectId, initialStatus);
      toast({ title: 'Update failed', description: 'Could not save updates', variant: 'destructive' });
    } finally {
      setSaving(false);
      setDrawerOpen(false);
      // Clear preview override and selection
      setPreviewProgress((prev) => {
        const next = { ...prev };
        if (currentProjectId) delete next[currentProjectId];
        return next;
      });
      setCurrentProjectId(null);
      setInitialStatus(null);
    }
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
        <div>
          <h1 className="text-3xl font-bold text-primary">Progress Tracker ⭐</h1>
          <p className="text-muted-foreground mt-1">Visual tracking of all project statuses</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-100">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{projects.filter(p => (p.status === 'Active') || (p.progress >= 80 && p.status !== 'Cancelled')).length}</p>
                  <p className="text-sm text-muted-foreground">On Track</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-yellow-100">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{projects.filter(p => (p.status === 'In Progress') || (p.progress >= 40 && p.progress < 80)).length}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-red-100">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{projects.filter(p => (p.blockers && p.blockers.length > 0)).length}</p>
                  <p className="text-sm text-muted-foreground">Blocked</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-secondary/10">
                  <Users className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{Array.from(new Set(projects.flatMap(p => p.team ?? []))).length}</p>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Progress */}
        <div className="space-y-4">
          {projects.map((project, index) => {
            const effectiveProgress = previewProgress[project.id] ?? project.progress;
            const colors = getProgressColor(effectiveProgress);
            const status = getProgressStatus(effectiveProgress);

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`border-l-4 ${colors.borderClass}`}>
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {project.id}
                          </Badge>
                          <Badge className={colors.badge}>
                            {status}
                          </Badge>
                          <Badge variant="outline" className="bg-secondary text-secondary-foreground">
                            {project.stage}
                          </Badge>
                        </div>
                        <CardTitle className="text-xl">{project.name}</CardTitle>
                      </div>
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => openDrawerFor(project.id)} disabled={saving}>
                        <Edit className="h-4 w-4" />
                        Update Progress
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Progress Bar */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-muted-foreground">Overall Progress</span>
                        <span className={`text-2xl font-bold ${colors.text}`}>{effectiveProgress}%</span>
                      </div>
                      <ProgressBar value={effectiveProgress} />
                    </div>

                    {/* Team & Status Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Team Members</p>
                        <div className="flex -space-x-2">
                          {(project.team ?? []).map((member, i) => (
                            <Avatar key={i} className="border-2 border-border">
                              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                {member}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Days in Current Stage</p>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{project.daysInStage ?? 0} days</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Last Updated</p>
                        <span className="text-sm font-medium">{project.lastUpdate ?? '—'}</span>
                      </div>
                    </div>

                    {/* Update Note */}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm font-medium mb-1">Latest Update:</p>
                      <p className="text-sm text-muted-foreground">{project.latestNote ?? 'No updates yet'}</p>
                    </div>

                    {/* Blockers */}
                    {(project.blockers && project.blockers.length > 0) && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-red-900 mb-1">Blockers:</p>
                            {project.blockers!.map((blocker, i) => (
                              <p key={i} className="text-sm text-red-800">• {blocker}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
        <UpdateProgressDrawer
          isOpen={drawerOpen}
          initialValue={initialProgress}
          initialStatus={currentProject?.status ?? 'Active'}
          onClose={closeDrawer}
          onSave={handleSave}
          onPreviewChange={handlePreviewChange}
          saving={saving}
          title={currentProject ? `Update Progress — ${currentProject.name}` : 'Update Progress'}
        />
      </motion.div>
    </DMSLayout>
  );
};

export default ProgressTracker;
