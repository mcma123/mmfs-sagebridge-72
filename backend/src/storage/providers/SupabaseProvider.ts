import { StorageProvider, PutObjectParams, GetObjectParams, DeleteObjectParams, SignedUrlParams } from '../StorageProvider';
import type { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseProvider implements StorageProvider {
  private client: SupabaseClient;
  private bucket: string;
  constructor(client: SupabaseClient, bucket = 'dms-documents') {
    this.client = client;
    this.bucket = bucket;
  }

  async putObject(params: PutObjectParams): Promise<{ key: string; size: number }> {
    const body = Buffer.isBuffer(params.body) ? params.body : Buffer.from(params.body as any);
    const { error } = await this.client.storage.from(this.bucket).upload(params.key, body, {
      contentType: params.contentType,
      upsert: false,
    });
    if (error) throw Object.assign(new Error(error.message), { status: 500, code: 'STORAGE_UPLOAD_FAILED' });
    return { key: params.key, size: body.length };
  }

  async getObject(params: GetObjectParams): Promise<{ body: Buffer; contentType?: string }> {
    const { data, error } = await this.client.storage.from(this.bucket).download(params.key);
    if (error) throw Object.assign(new Error(error.message), { status: 404, code: 'STORAGE_DOWNLOAD_FAILED' });
    // Supabase SDK returns a Blob in browser; in Node it can be a ReadableStream/Blob
    const blob = data as any;
    const arrayBuffer = typeof blob.arrayBuffer === 'function' ? await blob.arrayBuffer() : await (async () => {
      // Fallback for ReadableStream
      return await new Promise<ArrayBuffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        (blob as any).on('data', (c: Buffer) => chunks.push(c));
        (blob as any).on('end', () => resolve(Buffer.concat(chunks).buffer));
        (blob as any).on('error', reject);
      });
    })();
    return { body: Buffer.from(arrayBuffer) };
  }

  async deleteObject(params: DeleteObjectParams): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([params.key]);
    if (error) throw Object.assign(new Error(error.message), { status: 500, code: 'STORAGE_DELETE_FAILED' });
  }

  async getSignedUrl(params: SignedUrlParams): Promise<string> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(params.key, params.expiresInSeconds);
    if (error || !data?.signedUrl) throw Object.assign(new Error(error?.message || 'Signed URL error'), { status: 500, code: 'STORAGE_SIGNED_URL_FAILED' });
    return data.signedUrl;
  }
}