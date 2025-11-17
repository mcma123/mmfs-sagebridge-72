/**
 * DMS Dashboard API Client
 * Provides metrics for the DMS dashboard (/dms/dashboard)
 */

const DMS_API_BASE_URL = '/api/v1/dms/dashboard';

/**
 * Get authentication headers for API requests
 */
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface DmsDashboardSummary {
  totalDocuments: number;
  teamMembers: number;
}

/**
 * Fetch DMS dashboard summary metrics:
 * - totalDocuments: count of active documents (dms.documents, deleted_at IS NULL)
 * - teamMembers: count of active auth users (auth.users where status = 'active')
 */
export const dmsDashboardApi = {
  getSummary: async (): Promise<DmsDashboardSummary> => {
    const response = await fetch(`${DMS_API_BASE_URL}/summary`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch DMS dashboard summary: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },
};