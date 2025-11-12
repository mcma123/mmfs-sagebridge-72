import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { listProjects } from '@/lib/api/projects';

export type ProjectStatus =
  | 'Draft'
  | 'Active'
  | 'Pending Approval'
  | 'In Progress'
  | 'Done'
  | 'Cancelled';

export type Note = { id: string; text: string; createdAt: string; author?: string };

export type Project = {
  id: string;
  country: string;
  client: string;
  name: string;
  type: string;
  coverage: string;
  value: string;
  dueDate: string;
  status: ProjectStatus;
  progress: number;
  notes: Note[];
  latestNote?: string;
  lastUpdate?: string;
  stage?: string;
  team?: string[];
  daysInStage?: number;
  blockers?: string[];
};

type ProjectsContextValue = {
  projects: Project[];
  addProject: (p: Omit<Project, 'notes' | 'latestNote' | 'lastUpdate'>) => void;
  addNote: (id: string, text: string) => void;
  updateStatus: (id: string, status: ProjectStatus) => void;
  updateProgress: (id: string, progress: number) => void;
  removeProject: (id: string) => { rollback: () => void };
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

const initialProjects: Project[] = [
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
    notes: [],
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
    notes: [],
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
    notes: [],
  },
];

export const ProjectsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>(initialProjects);

  // Hydrate from backend on mount (falls back to initialProjects if request fails)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listProjects();
        if (cancelled) return;
        const mapped: Project[] = (data || []).map((d: any) => ({
          id: String(d.id),
          country: String(d.country || ''),
          client: String(d.client || ''),
          name: String(d.name || ''),
          type: String(d.type || ''),
          coverage: String(d.coverage || ''),
          value: String(d.value || ''), // already formatted by backend
          dueDate: String(d.dueDate || ''),
          status: (d.status || 'Active') as ProjectStatus,
          progress: Number(d.progress || 0),
          notes: [],
          latestNote: d.latestNote || undefined,
          lastUpdate: d.lastUpdate || undefined,
          stage: d.stage || undefined,
          team: Array.isArray(d.team) ? d.team : [],
          daysInStage: typeof d.daysInStage === 'number' ? d.daysInStage : undefined,
          blockers: Array.isArray(d.blockers) ? d.blockers : [],
        }));
        setProjects(mapped);
      } catch (err) {
        // Non-fatal: keep initial projects for local demo
        console.warn('[ProjectsProvider] Failed to load projects from backend:', (err as any)?.message || err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addProject: ProjectsContextValue['addProject'] = (p) => {
    setProjects((prev) => [{ ...p, notes: [] }, ...prev]);
  };

  const addNote: ProjectsContextValue['addNote'] = (id, text) => {
    const now = new Date().toISOString();
    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === id
          ? {
              ...proj,
              notes: [...proj.notes, { id: `note-${Date.now()}`, text, createdAt: now }],
              latestNote: text,
              lastUpdate: now,
            }
          : proj
      )
    );
  };

  const updateStatus: ProjectsContextValue['updateStatus'] = (id, status) => {
    setProjects((prev) =>
      prev.map((proj) => {
        if (proj.id !== id) return proj;
        const next: Project = { ...proj, status };
        if (status === 'Done') next.progress = 100;
        if (status === 'Cancelled') next.progress = 0;
        return next;
      })
    );
  };

  const updateProgress: ProjectsContextValue['updateProgress'] = (id, progress) => {
    const clamped = Math.max(0, Math.min(100, progress));
    setProjects((prev) => prev.map((proj) => (proj.id === id ? { ...proj, progress: clamped } : proj)));
  };

  const removeProject: ProjectsContextValue['removeProject'] = (id) => {
    let snapshot: Project[] = [];
    setProjects((prev) => {
      snapshot = prev;
      return prev.filter((p) => p.id !== id);
    });
    return {
      rollback: () => setProjects(snapshot),
    };
  };

  const value = useMemo(
    () => ({ projects, addProject, addNote, updateStatus, updateProgress, removeProject }),
    [projects]
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
};

export const useProjects = () => {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider');
  return ctx;
};