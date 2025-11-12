/**
* DMS Projects API (real HTTP calls)
* Backend routes mounted at /api/v1/dms/projects
*/

export type ProjectStatus =
 | 'Draft'
 | 'Active'
 | 'Pending Approval'
 | 'In Progress'
 | 'Done'
 | 'Cancelled';

export type ProjectDTO = {
 id: string;
 country: string;
 client: string;
 name: string;
 type: string;
 coverage: string;
 value: string; // formatted display e.g., "$1,000,000"
 dueDate: string;
 status: ProjectStatus;
 progress: number;
 latestNote?: string;
 lastUpdate?: string;
 stage?: string;
 team?: string[];
 daysInStage?: number;
 blockers?: string[];
};

export type CreateProjectPayload = {
 id: string;
 projectName: string;
 projectType: 'Facultative' | 'Treaty';
 clientName: string;
 country: string;
 coverage: string;
 value: number;
 currency: 'USD' | 'EUR' | 'GBP' | 'ZAR';
 dueDate?: string; // YYYY-MM-DD
 status: ProjectStatus;
 description?: string;
 assignedTeam?: string[];
};

const BASE = '/api/v1/dms/projects';

async function http<T>(url: string, init?: RequestInit): Promise<T> {
 const res = await fetch(url, {
   ...init,
   headers: {
     'Content-Type': 'application/json',
     ...(init?.headers || {}),
   },
 });
 if (!res.ok) {
   let message: string;
   try {
     message = await res.text();
   } catch {
     message = res.statusText;
   }
   throw new Error(`HTTP ${res.status} ${res.statusText}: ${message}`);
 }
 // Some endpoints may return 204
 try {
   return (await res.json()) as T;
 } catch {
   return undefined as unknown as T;
 }
}

/**
* List all projects (auto-seeded by backend on first call if empty)
*/
export async function listProjects(): Promise<ProjectDTO[]> {
  return http<ProjectDTO[]>(`${BASE}`, { method: 'GET', headers: { 'X-Role': 'viewer' } });
}

/**
* Create a new project
*/
export async function createProject(payload: CreateProjectPayload): Promise<ProjectDTO> {
  return http<ProjectDTO>(`${BASE}`, {
    method: 'POST',
    headers: { 'X-Role': 'editor' },
    body: JSON.stringify(payload),
  });
}

/**
* Update project status (applies Done → 100 and Cancelled → 0 on server)
*/
export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  return http<ProjectDTO>(`${BASE}/${encodeURIComponent(projectId)}/status`, {
    method: 'PATCH',
    headers: { 'X-Role': 'editor' },
    body: JSON.stringify({ status }),
  });
}

/**
* Update project progress with optional note (note will update latestNote/lastUpdate on server)
*/
export async function updateProjectProgress(projectId: string, progressPercent: number, note?: string) {
  return http<ProjectDTO>(`${BASE}/${encodeURIComponent(projectId)}/progress`, {
    method: 'PATCH',
    headers: { 'X-Role': 'editor' },
    body: JSON.stringify({ progressPercent, note }),
  });
}

/**
* Create a project note (also updates project's latestNote/lastUpdate)
*/
export async function createProjectNote(projectId: string, text: string) {
  return http<{ project: ProjectDTO; note: { id: number; project_id: string; text: string; author?: string; created_at: string } }>(
    `${BASE}/${encodeURIComponent(projectId)}/notes`,
    {
      method: 'POST',
      headers: { 'X-Role': 'editor' },
      body: JSON.stringify({ text }),
    }
  );
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<void> {
  return http<void>(`${BASE}/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
    headers: { 'X-Role': 'editor' },
  });
}