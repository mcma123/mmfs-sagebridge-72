// Consolidated Projects API stubs
// Replace with real HTTP calls when backend is available

export type ProjectStatus = 'Draft' | 'Active' | 'Pending Approval' | 'In Progress' | 'Done' | 'Cancelled';

export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  await new Promise((r) => setTimeout(r, 400));
  return { projectId, status, updatedAt: new Date().toISOString() };
}

export async function updateProjectProgress(projectId: string, progressPercent: number, note?: string) {
  await new Promise((r) => setTimeout(r, 600));
  const payload: any = { projectId, progressPercent, updatedAt: new Date().toISOString() };
  if (note && note.trim()) payload.note = { id: `note-${Date.now()}`, text: note.trim(), createdAt: payload.updatedAt };
  return payload;
}

export async function createProjectNote(projectId: string, text: string) {
  await new Promise((r) => setTimeout(r, 350));
  return { projectId, note: { id: `note-${Date.now()}`, text, createdAt: new Date().toISOString() } };
}