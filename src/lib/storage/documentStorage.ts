// Storage abstraction layer for document file management
// Supports both in-memory (current) and backend storage (future)

export interface DocumentStorage {
  /**
   * Store a file and return a reference ID
   */
  upload(file: File): Promise<string | number>;

  /**
   * Retrieve a file by reference ID
   */
  retrieve(id: string | number): Promise<File | Blob | null>;

  /**
   * Delete a file by reference ID
   */
  delete(id: string | number): Promise<void>;

  /**
   * Check if a file exists
   */
  exists(id: string | number): Promise<boolean>;

  /**
   * Get a URL for viewing/downloading
   */
  getUrl(id: string | number): Promise<string | null>;
}

/**
 * In-memory storage implementation using browser Blob URLs
 * Files are stored temporarily and lost on page refresh
 * Current implementation for immediate functionality
 */
export class MemoryDocumentStorage implements DocumentStorage {
  private blobs = new Map<number, File>();

  async upload(file: File): Promise<number> {
    // Generate a unique ID (in real use, this comes from the document store)
    const id = Date.now() + Math.random();
    this.blobs.set(id, file);
    return id;
  }

  async retrieve(id: string | number): Promise<File | null> {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.blobs.get(numId) || null;
  }

  async delete(id: string | number): Promise<void> {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    this.blobs.delete(numId);
  }

  async exists(id: string | number): Promise<boolean> {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.blobs.has(numId);
  }

  async getUrl(id: string | number): Promise<string | null> {
    const file = await this.retrieve(id);
    if (!file) return null;
    return URL.createObjectURL(file);
  }
}

/**
 * Backend storage implementation (FUTURE)
 * Will communicate with backend API for persistent file storage
 * TODO: Implement when backend file storage is ready
 */
export class BackendDocumentStorage implements DocumentStorage {
  private baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  async upload(file: File): Promise<string> {
    // TODO: Implement multipart/form-data upload to backend
    // const formData = new FormData();
    // formData.append('file', file);
    // const response = await fetch(`${this.baseUrl}/documents/upload`, {
    //   method: 'POST',
    //   body: formData,
    // });
    // const data = await response.json();
    // return data.id;

    throw new Error('Backend storage not yet implemented. Use MemoryDocumentStorage.');
  }

  async retrieve(id: string | number): Promise<Blob | null> {
    // TODO: Implement file download from backend
    // const response = await fetch(`${this.baseUrl}/documents/${id}/download`);
    // if (!response.ok) return null;
    // return await response.blob();

    throw new Error('Backend storage not yet implemented. Use MemoryDocumentStorage.');
  }

  async delete(id: string | number): Promise<void> {
    // TODO: Implement file deletion via backend
    // await fetch(`${this.baseUrl}/documents/${id}`, {
    //   method: 'DELETE',
    // });

    throw new Error('Backend storage not yet implemented. Use MemoryDocumentStorage.');
  }

  async exists(id: string | number): Promise<boolean> {
    // TODO: Implement file existence check
    // const response = await fetch(`${this.baseUrl}/documents/${id}/exists`);
    // const data = await response.json();
    // return data.exists;

    throw new Error('Backend storage not yet implemented. Use MemoryDocumentStorage.');
  }

  async getUrl(id: string | number): Promise<string | null> {
    // TODO: Return signed URL from backend
    // const response = await fetch(`${this.baseUrl}/documents/${id}/url`);
    // const data = await response.json();
    // return data.signed_url;

    throw new Error('Backend storage not yet implemented. Use MemoryDocumentStorage.');
  }
}

/**
 * Configuration flag to switch between storage implementations
 * Set to 'backend' when backend storage is ready
 */
export const STORAGE_MODE: 'memory' | 'backend' = 'memory';

/**
 * Factory function to get the appropriate storage implementation
 */
export function getDocumentStorage(): DocumentStorage {
  switch (STORAGE_MODE) {
    case 'memory':
      return new MemoryDocumentStorage();
    case 'backend':
      return new BackendDocumentStorage();
    default:
      return new MemoryDocumentStorage();
  }
}

/**
 * Migration Guide:
 *
 * To migrate from memory to backend storage:
 *
 * 1. Implement backend endpoints:
 *    - POST /api/documents/upload (multipart/form-data)
 *    - GET /api/documents/:id/download
 *    - DELETE /api/documents/:id
 *    - GET /api/documents/:id/exists
 *    - GET /api/documents/:id/url (for signed URLs)
 *
 * 2. Implement BackendDocumentStorage methods above
 *
 * 3. Update STORAGE_MODE to 'backend'
 *
 * 4. Test thoroughly with various file types and sizes
 *
 * 5. Update documents.ts to use getDocumentStorage() instead of direct blob management
 */
