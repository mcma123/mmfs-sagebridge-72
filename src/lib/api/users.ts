// User management API client

export type User = {
  id: number;
  email: string;
  display_name: string;
  is_active: boolean;
  roles: string[];
  last_login_at: string | null;
  created_at: string;
};

export type CreateUserData = {
  name: string;
  email: string;
  password: string;
  roles: string[];
};

export type UpdateUserData = {
  name?: string;
  email?: string;
  password?: string;
  roles?: string[];
  is_active?: boolean;
};

export type ListUsersResponse = {
  items: User[];
  total: number;
};

// Helper to get auth headers
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
}

// Helper for error handling
async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err?.error?.message || err?.message || `Request failed with status ${res.status}`;
    const error = new Error(message) as Error & { status: number; code?: string };
    error.status = res.status;
    if (res.status === 409) {
      error.code = 'DUPLICATE_EMAIL';
    }
    throw error;
  }
  return res.json() as Promise<T>;
}

/**
 * List all users
 */
export async function listUsers(): Promise<ListUsersResponse> {
  const res = await fetch('/api/v1/administration/users', {
    headers: getAuthHeaders(),
  });
  return handleResponse<ListUsersResponse>(res);
}

/**
 * Create a new user
 */
export async function createUser(data: CreateUserData): Promise<{ id: number }> {
  const res = await fetch('/api/v1/administration/users', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<{ id: number }>(res);
}

/**
 * Update an existing user
 */
export async function updateUser(id: number, data: UpdateUserData): Promise<{ id: number; success: boolean }> {
  const res = await fetch(`/api/v1/administration/users/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<{ id: number; success: boolean }>(res);
}

/**
 * Delete a user (hard delete)
 */
export async function deleteUser(id: number): Promise<{ success: boolean }> {
  const res = await fetch(`/api/v1/administration/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse<{ success: boolean }>(res);
}

/**
 * Reset a user's password (admin only)
 */
export async function resetUserPassword(id: number, newPassword: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/v1/administration/users/${id}/reset-password`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ newPassword }),
  });
  return handleResponse<{ success: boolean }>(res);
}

/**
 * Deactivate a user (soft delete)
 */
export async function deactivateUser(id: number): Promise<{ id: number; success: boolean }> {
  return updateUser(id, { is_active: false });
}

/**
 * Reactivate a user
 */
export async function reactivateUser(id: number): Promise<{ id: number; success: boolean }> {
  return updateUser(id, { is_active: true });
}
