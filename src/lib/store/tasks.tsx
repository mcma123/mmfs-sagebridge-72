import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { listTasks, TaskDTO, TaskPriority, TaskStatus } from '@/lib/api/tasks';

export type { TaskStatus, TaskPriority };

export type Task = {
  id: number;
  projectId: string | null;
  title: string;
  type: string;
  assignee: string;
  dueDate: string; // YYYY-MM-DD
  priority: TaskPriority;
  status: TaskStatus;
  description?: string;
  tags?: string[];
  estimatedHours?: number;
  latestNote?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type TasksContextValue = {
  tasks: Task[];
  addTask: (t: Task) => void;
  addNote: (id: number, text: string) => void;
  updateStatus: (id: number, status: TaskStatus) => void;
  removeTask: (id: number) => { rollback: () => void };
};

const TasksContext = createContext<TasksContextValue | null>(null);

export const TasksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);

  // Hydrate from backend on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listTasks();
        if (cancelled) return;
        const mapped: Task[] = (data || []).map((d: TaskDTO) => ({
          id: Number(d.id),
          projectId: d.projectId ? String(d.projectId) : null,
          title: String(d.title || ''),
          type: String(d.type || ''),
          assignee: String(d.assignee || ''),
          dueDate: String(d.dueDate || ''),
          priority: d.priority,
          status: d.status,
          description: d.description || undefined,
          tags: Array.isArray(d.tags) ? d.tags : [],
          estimatedHours: typeof d.estimatedHours === 'number' ? d.estimatedHours : undefined,
          latestNote: d.latestNote || undefined,
          completedAt: d.completedAt || undefined,
          createdAt: d.createdAt || undefined,
          updatedAt: d.updatedAt || undefined,
        }));
        setTasks(mapped);
      } catch (err) {
        console.warn('[TasksProvider] Failed to load tasks from backend:', (err as any)?.message || err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addTask: TasksContextValue['addTask'] = (t) => {
    setTasks((prev) => [t, ...prev]);
  };

  const addNote: TasksContextValue['addNote'] = (id, text) => {
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              latestNote: text,
              updatedAt: now,
            }
          : task
      )
    );
  };

  const updateStatus: TasksContextValue['updateStatus'] = (id, status) => {
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        const next: Task = { ...task, status };
        if (status === 'Done') next.completedAt = now;
        if (status === 'Cancelled') next.completedAt = undefined;
        return next;
      })
    );
  };

  const removeTask: TasksContextValue['removeTask'] = (id) => {
    let snapshot: Task[] = [];
    setTasks((prev) => {
      snapshot = prev;
      return prev.filter((t) => t.id !== id);
    });
    return {
      rollback: () => setTasks(snapshot),
    };
  };

  const value = useMemo(
    () => ({ tasks, addTask, addNote, updateStatus, removeTask }),
    [tasks]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
};

export const useTasks = () => {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within TasksProvider');
  return ctx;
};