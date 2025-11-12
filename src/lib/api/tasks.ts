/**
 * DMS Tasks API (real HTTP calls)
 * Backend routes mounted at /api/v1/dms/tasks
 */

export type TaskStatus = 'Open' | 'In Progress' | 'Blocked' | 'Done' | 'Cancelled';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type TaskDTO = {
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

export type CreateTaskPayload = {
  // Optional relation to a project
  projectReference?: string | null;
  // Required fields
  taskTitle: string;
  taskType: string;
  assignedTo: string;
  dueDate: string; // YYYY-MM-DD
  priority: TaskPriority;
  // Optional fields
  description?: string;
  estimatedHours?: number;
  tags?: string[];
  // Optional explicit status (defaults to "Open" on server)
  status?: TaskStatus;
};

const BASE = '/api/v1/dms/tasks';

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
  try {
    return (await res.json()) as T;
  } catch {
    return undefined as unknown as T;
  }
}

/**
 * List tasks (optionally filter by status/assignee/projectId via query params)
 */
export async function listTasks(params?: { status?: TaskStatus; assignee?: string; projectId?: string }) {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.assignee) q.set('assignee', params.assignee);
  if (params?.projectId) q.set('projectId', params.projectId);
  const qs = q.toString();
  const url = qs ? `${BASE}?${qs}` : BASE;
  return http<TaskDTO[]>(url, { method: 'GET', headers: { 'X-Role': 'viewer' } });
}

/**
 * Create a task
 */
export async function createTask(payload: CreateTaskPayload) {
  return http<TaskDTO>(`${BASE}`, {
    method: 'POST',
    headers: { 'X-Role': 'editor' },
    body: JSON.stringify(payload),
  });
}

/**
 * Update task status
 * Rules applied on server:
 *  - Done     → sets completed_at = NOW()
 *  - Cancelled → clears completed_at
 */
export async function updateTaskStatus(taskId: number, status: TaskStatus) {
  return http<TaskDTO>(`${BASE}/${encodeURIComponent(String(taskId))}/status`, {
    method: 'PATCH',
    headers: { 'X-Role': 'editor' },
    body: JSON.stringify({ status }),
  });
}

/**
 * Create task note (also updates task.latest_note + updated_at)
 */
export async function createTaskNote(taskId: number, text: string) {
  return http<{ task: TaskDTO; note: { id: number; task_id: number; text: string; author?: string; created_at: string } }>(
    `${BASE}/${encodeURIComponent(String(taskId))}/notes`,
    {
      method: 'POST',
      headers: { 'X-Role': 'editor' },
      body: JSON.stringify({ text }),
    }
  );
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: number): Promise<void> {
  return http<void>(`${BASE}/${encodeURIComponent(String(taskId))}`, {
    method: 'DELETE',
    headers: { 'X-Role': 'editor' },
  });
}