export async function updateProjectProgress(projectId: string, progressPercent: number, note?: string) {
  // Simulate latency and success; replace with real API call later.
  await new Promise((r) => setTimeout(r, 600));
  return { projectId, progressPercent, note, updatedAt: new Date().toISOString() };
}