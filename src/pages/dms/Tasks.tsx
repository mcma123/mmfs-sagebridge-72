import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import DMSLayout from '@/components/layout/DMSLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, FileText, CheckSquare, Phone, DollarSign, Mail, AlertCircle } from 'lucide-react';
import SlideOutPanel from '@/components/ui/slide-out-panel';
import NewTaskForm, { TaskFormData } from '@/components/dms/NewTaskForm';
import { toast } from '@/hooks/use-toast';

const Tasks: React.FC = () => {
  const taskTypes = [
    { icon: FileText, label: 'Upload Document', color: 'text-blue-600' },
    { icon: CheckSquare, label: 'Review & Approve', color: 'text-green-600' },
    { icon: Phone, label: 'Follow-up Action', color: 'text-purple-600' },
    { icon: DollarSign, label: 'Financial Task', color: 'text-yellow-600' },
    { icon: Mail, label: 'Send Communication', color: 'text-indigo-600' },
  ];

  const mockTasks = {
    overdue: [
      {
        id: 1,
        title: 'Submit final placement slip to Munich Re',
        project: 'MZ-2025-FAC-002',
        assignee: 'TK',
        dueDate: '2025-01-18',
        priority: 'High',
        type: 'Mail',
      },
    ],
    dueToday: [
      {
        id: 2,
        title: 'Review and approve construction policy terms',
        project: 'ZM-2025-FAC-003',
        assignee: 'JD',
        dueDate: '2025-01-22',
        priority: 'High',
        type: 'Review & Approve',
      },
      {
        id: 3,
        title: 'Upload signed cover note to DMS',
        project: 'MZ-2025-FAC-002',
        assignee: 'SM',
        dueDate: '2025-01-22',
        priority: 'Medium',
        type: 'Upload Document',
      },
    ],
    dueThisWeek: [
      {
        id: 4,
        title: 'Follow up with TransAxis on treaty renewal',
        project: 'ZA-2025-TRT-001',
        assignee: 'TK',
        dueDate: '2025-01-25',
        priority: 'Medium',
        type: 'Follow-up Action',
      },
      {
        id: 5,
        title: 'Process premium payment for Maamba project',
        project: 'MZ-2025-FAC-002',
        assignee: 'AB',
        dueDate: '2025-01-26',
        priority: 'High',
        type: 'Financial Task',
      },
    ],
    completed: [
      {
        id: 6,
        title: 'Send debit note to client',
        project: 'MZ-2025-FAC-002',
        assignee: 'TK',
        dueDate: '2025-01-20',
        priority: 'Medium',
        type: 'Send Communication',
        completedDate: '2025-01-20',
      },
    ],
  };

  // Local state for tasks and panel visibility
  const [tasks, setTasks] = useState(mockTasks);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  // Options derived from existing mock data
  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    Object.values(tasks).forEach((arr: any) => {
      (arr as any[]).forEach(t => names.add(t.assignee));
    });
    return Array.from(names);
  }, [tasks]);

  const projectOptions = useMemo(() => {
    const projects = new Set<string>();
    Object.values(tasks).forEach((arr: any) => {
      (arr as any[]).forEach(t => projects.add(t.project));
    });
    return Array.from(projects);
  }, [tasks]);

  const classifySection = (dueDateStr: string) => {
    const today = new Date();
    const due = new Date(dueDateStr);
    // Normalize to date-only
    const normalize = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const nToday = normalize(today);
    const nDue = normalize(due);

    if (nDue.getTime() < nToday.getTime()) return 'overdue' as const;
    if (nDue.getTime() === nToday.getTime()) return 'dueToday' as const;

    // Week range: Monday to Sunday of current week
    const day = nToday.getDay();
    const monday = new Date(nToday);
    monday.setDate(nToday.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    if (nDue.getTime() >= monday.getTime() && nDue.getTime() <= sunday.getTime()) {
      return 'dueThisWeek' as const;
    }
    // If outside current week and not overdue/today, we still bucket into dueThisWeek for visibility
    return 'dueThisWeek' as const;
  };

  const handleCreateTask = (data: TaskFormData) => {
    const newTask = {
      id: Date.now(),
      title: data.taskTitle,
      project: data.projectReference,
      assignee: data.assignedTo,
      dueDate: data.dueDate,
      priority: data.priority,
      type: data.taskType,
    };

    const section = classifySection(data.dueDate);
    setTasks(prev => ({
      ...prev,
      [section]: [newTask, ...prev[section as keyof typeof prev] as any[]],
    }));

    toast({
      title: 'Task created',
      description: `The task was added to "${section}"`,
    });
    setIsNewTaskOpen(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    const taskType = taskTypes.find(t => t.label === type);
    if (!taskType) return FileText;
    return taskType.icon;
  };

  const TaskCard = ({ task, section }: { task: any; section: string }) => {
    const Icon = getTypeIcon(task.type);
    return (
      <div className={`flex items-start gap-4 p-4 border rounded-lg hover:shadow-md transition-all ${
        section === 'overdue' ? 'border-l-4 border-l-red-500 bg-red-50' : 'bg-white'
      }`}>
        <Checkbox className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">{task.title}</h3>
            </div>
            <Badge className={getPriorityColor(task.priority)}>
              {task.priority}
            </Badge>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            <Badge variant="outline" className="font-mono">
              {task.project}
            </Badge>
            <span>•</span>
            <span>Due: {task.dueDate}</span>
            {task.completedDate && (
              <>
                <span>•</span>
                <span className="text-green-600">Completed: {task.completedDate}</span>
              </>
            )}
          </div>
        </div>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-white text-xs">
            {task.assignee}
          </AvatarFallback>
        </Avatar>
      </div>
    );
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
            onCreate={handleCreateTask}
            onCancel={() => setIsNewTaskOpen(false)}
            assigneeOptions={assigneeOptions}
            projectOptions={projectOptions}
          />
        </SlideOutPanel>

        {/* Task Type Legend */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              {taskTypes.map((type, index) => {
                const Icon = type.icon;
                return (
                  <div key={index} className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${type.color}`} />
                    <span className="text-sm font-medium">{type.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Overdue Tasks */}
        {tasks.overdue.length > 0 && (
          <Card className="border-red-200">
            <CardHeader className="bg-red-50">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <CardTitle className="text-red-900">Overdue ({tasks.overdue.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {tasks.overdue.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <TaskCard task={task} section="overdue" />
                </motion.div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Due Today */}
        <Card>
          <CardHeader className="bg-yellow-50">
            <CardTitle className="text-yellow-900">Due Today ({tasks.dueToday.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            {tasks.dueToday.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <TaskCard task={task} section="today" />
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Due This Week */}
        <Card>
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-blue-900">Due This Week ({tasks.dueThisWeek.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            {tasks.dueThisWeek.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <TaskCard task={task} section="week" />
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Completed */}
        <Card>
          <CardHeader className="bg-green-50">
            <CardTitle className="text-green-900">Completed ({tasks.completed.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            {tasks.completed.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
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
