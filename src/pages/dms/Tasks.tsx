import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import DMSLayout from '@/components/layout/DMSLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, FileText, CheckSquare, Phone, DollarSign, Mail, AlertCircle, Trash, ChevronDown } from 'lucide-react';
import SlideOutPanel from '@/components/ui/slide-out-panel';
import NewTaskForm, { TaskFormData } from '@/components/dms/NewTaskForm';
import { toast } from '@/hooks/use-toast';
import { useTasks } from '@/lib/store/tasks';
import { useProjects } from '@/lib/store/projects';
import { createTask, updateTaskStatus, createTaskNote, deleteTask, TaskStatus } from '@/lib/api/tasks';

const STATUSES: TaskStatus[] = ['Open', 'In Progress', 'Blocked', 'Done', 'Cancelled'];

const Tasks: React.FC = () => {
  const taskTypes = [
    { icon: FileText, label: 'Upload Document', color: 'text-blue-600 dark:brightness-110' },
    { icon: CheckSquare, label: 'Review & Approve', color: 'text-green-600 dark:brightness-110' },
    { icon: Phone, label: 'Follow-up Action', color: 'text-purple-600 dark:brightness-110' },
    { icon: DollarSign, label: 'Financial Task', color: 'text-yellow-600 dark:brightness-110' },
    { icon: Mail, label: 'Send Communication', color: 'text-indigo-600 dark:brightness-110' },
  ];

  const { tasks, addTask, addNote, updateStatus, removeTask } = useTasks();
  const { projects } = useProjects();

  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  // Options for the new task form
  const assigneeOptions = useMemo(() => {
    // Provide sensible defaults when there are no tasks yet
    const names = new Set<string>(['JD', 'TK', 'SM', 'AB']);
    tasks.forEach((t) => t.assignee && names.add(t.assignee));
    return Array.from(names);
  }, [tasks]);

  const projectOptions = useMemo(() => {
    const ids = new Set<string>();
    // Prefer existing project IDs from store
    projects.forEach((p) => ids.add(p.id));
    // Also include any referenced by tasks (if projects store hasn't loaded them)
    tasks.forEach((t) => t.projectId && ids.add(t.projectId));
    return Array.from(ids);
  }, [projects, tasks]);

  const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const classifySection = (dueDateStr: string, status: TaskStatus) => {
    if (status === 'Done') return 'completed' as const;
    const today = normalizeDate(new Date());
    const due = normalizeDate(new Date(dueDateStr));
    if (due.getTime() < today.getTime()) return 'overdue' as const;
    if (due.getTime() === today.getTime()) return 'dueToday' as const;

    // Week range (Mon-Sun)
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    if (due.getTime() >= monday.getTime() && due.getTime() <= sunday.getTime()) {
      return 'dueThisWeek' as const;
    }
    return 'dueThisWeek' as const;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? tasks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.assignee.toLowerCase().includes(q) ||
            (t.projectId || '').toLowerCase().includes(q) ||
            t.type.toLowerCase().includes(q)
        )
      : tasks;

    const buckets = {
      overdue: [] as typeof list,
      dueToday: [] as typeof list,
      dueThisWeek: [] as typeof list,
      completed: [] as typeof list,
    };

    list.forEach((t) => {
      const key = classifySection(t.dueDate, t.status);
      // @ts-ignore
      buckets[key].push(t);
    });

    // Sort within buckets by due date ascending except completed (by updated desc)
    const byDueAsc = (a: typeof list[number], b: typeof list[number]) => (a.dueDate > b.dueDate ? 1 : a.dueDate < b.dueDate ? -1 : 0);
    buckets.overdue.sort(byDueAsc);
    buckets.dueToday.sort(byDueAsc);
    buckets.dueThisWeek.sort(byDueAsc);
    buckets.completed.sort((a, b) => (String(b.updatedAt || '') > String(a.updatedAt || '') ? 1 : -1));

    return buckets;
  }, [tasks, search]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-rose-100 text-rose-800 border-rose-200 dark:brightness-110';
      case 'High':
        return 'bg-red-100 text-red-800 border-red-200 dark:brightness-110';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:brightness-110';
      case 'Low':
        return 'bg-green-100 text-green-800 border-green-200 dark:brightness-110';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getTypeIcon = (type: string) => {
    const taskType = taskTypes.find((t) => t.label === type);
    return taskType ? taskType.icon : FileText;
    };

  const StatusBadge: React.FC<{ taskId: number; current: TaskStatus; title: string }> = ({ taskId, current, title }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          className="bg-muted text-muted-foreground border-border flex items-center gap-1 cursor-pointer"
          aria-label={`Task status: ${current}`}
          title={`Change status for ${title}`}
          role="button"
          tabIndex={0}
        >
          {current}
          <ChevronDown className="h-3 w-3" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            aria-label={`Set status to ${s}`}
            onClick={async () => {
              const prev = current;
              updateStatus(taskId, s);
              try {
                await updateTaskStatus(taskId, s);
                toast({ title: 'Status updated', description: `${title} → ${s}` });
              } catch (e) {
                updateStatus(taskId, prev);
                toast({ title: 'Update failed', description: 'Could not change status', variant: 'destructive' });
              }
            }}
          >
            {s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const TaskCard = ({ task, section }: { task: any; section: string }) => {
    const Icon = getTypeIcon(task.type);
    return (
      <div
        className={`flex items-start gap-4 p-4 border rounded-lg hover:shadow-md transition-all bg-card text-card-foreground border-border ${
          section === 'overdue' ? 'border-l-4 border-l-rose-500 dark:brightness-110' : ''
        }`}
      >
        <Checkbox className="mt-1" checked={task.status === 'Done'} disabled onCheckedChange={() => {}} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">{task.title}</h3>
              {task.projectId && (
                <Badge variant="outline" className="font-mono">
                  {task.projectId}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
              <StatusBadge taskId={task.id} current={task.status} title={task.title} />
              <Button
                variant="outline"
                size="icon"
                aria-label="Delete task"
                title="Delete task"
                className="text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50"
                onClick={async () => {
                  if (!window.confirm(`Delete task "${task.title}"? This cannot be undone.`)) return;
                  const { rollback } = removeTask(task.id);
                  try {
                    await deleteTask(task.id);
                    toast({ title: 'Task deleted', description: `${task.title} removed` });
                  } catch (e) {
                    rollback();
                    toast({
                      title: 'Delete failed',
                      description: (e as any)?.message || 'Could not delete task',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            <span>Assignee: {task.assignee}</span>
            <span>•</span>
            <span>Due: {task.dueDate}</span>
            {task.completedAt && (
              <>
                <span>•</span>
                <span className="text-green-600 dark:brightness-110">Completed: {task.completedAt}</span>
              </>
            )}
          </div>

          {/* Latest Note */}
          <div className="mt-3 space-y-2">
            {task.latestNote ? (
              <div className="text-sm">{task.latestNote}</div>
            ) : (
              <div className="text-sm text-muted-foreground">No notes yet</div>
            )}
            <Textarea
              placeholder="Add note..."
              value={noteDrafts[task.id] || ''}
              onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
              className="min-h-[60px]"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={async () => {
                  const text = (noteDrafts[task.id] || '').trim();
                  if (!text) return;
                  try {
                    await createTaskNote(task.id, text);
                    addNote(task.id, text);
                    setNoteDrafts((prev) => ({ ...prev, [task.id]: '' }));
                    toast({ title: 'Note added', description: 'Your note has been saved.' });
                  } catch (e) {
                    toast({ title: 'Note failed', description: 'Could not save note', variant: 'destructive' });
                  }
                }}
                disabled={!noteDrafts[task.id] || !noteDrafts[task.id].trim()}
              >
                Save Note
              </Button>
            </div>
          </div>
        </div>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">{task.assignee}</AvatarFallback>
        </Avatar>
      </div>
    );
  };

  return (
    <DMSLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Task Board</h1>
            <p className="text-muted-foreground mt-1">Manage tasks across all projects</p>
          </div>
          <Button className="bg-secondary hover:bg-secondary/90 gap-2" onClick={() => setIsNewTaskOpen(true)}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>

        <SlideOutPanel title="New Task" open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
          <NewTaskForm
            onCreate={async (data: TaskFormData) => {
              try {
                const created = await createTask({
                  projectReference: data.projectReference || undefined,
                  taskTitle: data.taskTitle,
                  taskType: data.taskType,
                  assignedTo: data.assignedTo,
                  dueDate: data.dueDate,
                  priority: data.priority as any,
                  description: data.description,
                  estimatedHours: data.estimatedHours,
                  tags: data.tags,
                });
                addTask({
                  id: created.id,
                  projectId: created.projectId,
                  title: created.title,
                  type: created.type,
                  assignee: created.assignee,
                  dueDate: created.dueDate,
                  priority: created.priority,
                  status: created.status,
                  description: created.description,
                  tags: created.tags,
                  estimatedHours: created.estimatedHours,
                  latestNote: created.latestNote,
                  completedAt: created.completedAt,
                  createdAt: created.createdAt,
                  updatedAt: created.updatedAt,
                });
                setIsNewTaskOpen(false);
                toast({ title: 'Task created', description: `${created.title} added to the board` });
              } catch (e) {
                toast({ title: 'Create failed', description: (e as any)?.message || 'Could not create task', variant: 'destructive' });
              }
            }}
            onCancel={() => setIsNewTaskOpen(false)}
            assigneeOptions={assigneeOptions}
            projectOptions={projectOptions}
          />
        </SlideOutPanel>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Input placeholder="Search by title, assignee, type or project..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overdue */}
        {filtered.overdue.length > 0 && (
          <Card className="border-border">
            <CardHeader className="bg-muted">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-600 dark:brightness-110" />
                <CardTitle className="text-foreground">Overdue ({filtered.overdue.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {filtered.overdue.map((task, index) => (
                <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
                  <TaskCard task={task} section="overdue" />
                </motion.div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Due Today */}
        <Card>
          <CardHeader className="bg-muted">
            <CardTitle className="text-foreground">Due Today ({filtered.dueToday.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            {filtered.dueToday.map((task, index) => (
              <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
                <TaskCard task={task} section="today" />
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Due This Week */}
        <Card>
          <CardHeader className="bg-muted">
            <CardTitle className="text-foreground">Due This Week ({filtered.dueThisWeek.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            {filtered.dueThisWeek.map((task, index) => (
              <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
                <TaskCard task={task} section="week" />
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Completed */}
        <Card>
          <CardHeader className="bg-muted">
            <CardTitle className="text-foreground">Completed ({filtered.completed.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            {filtered.completed.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="opacity-60"
              >
                <TaskCard task={task} section="completed" />
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </DMSLayout>
  );
};

export default Tasks;

