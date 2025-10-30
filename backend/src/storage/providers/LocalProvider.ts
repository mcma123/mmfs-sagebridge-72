import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { StorageProvider, PutObjectParams, GetObjectParams, DeleteObjectParams, SignedUrlParams } from '../StorageProvider';

const ROOT = path.resolve(process.cwd(), 'storage');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export class LocalProvider implements StorageProvider {
  async putObject(params: PutObjectParams): Promise<{ key: string; size: number }> {
    ensureDir(ROOT);
    const safeKey = params.key.replace(/[^a-zA-Z0-9/_.-]/g, '_');
    const fullPath = path.join(ROOT, safeKey);
    ensureDir(path.dirname(fullPath));
    const body = Buffer.isBuffer(params.body) ? params.body : Buffer.from(params.body as any);
    fs.writeFileSync(fullPath, body);
    return { key: safeKey, size: body.length };
  }

  async getObject(params: GetObjectParams): Promise<{ body: Buffer; contentType?: string }> {
    const fullPath = path.join(ROOT, params.key);
    const body = fs.readFileSync(fullPath);
    return { body };
  }

  async deleteObject(params: DeleteObjectParams): Promise<void> {
    const fullPath = path.join(ROOT, params.key);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }

  async getSignedUrl(params: SignedUrlParams): Promise<string> {
    // For local dev, return a pseudo-URL with a token
    const token = crypto.createHash('sha256').update(params.key + Date.now()).digest('hex').slice(0, 16);
    return `/local/${encodeURIComponent(params.key)}?t=${token}&e=${params.expiresInSeconds}`;
  }
}