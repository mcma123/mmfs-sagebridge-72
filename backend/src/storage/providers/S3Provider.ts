import { StorageProvider, PutObjectParams, GetObjectParams, DeleteObjectParams, SignedUrlParams } from '../StorageProvider';

// Placeholder for a cloud provider (e.g., AWS S3)
export class S3Provider implements StorageProvider {
  async putObject(params: PutObjectParams): Promise<{ key: string; size: number }> {
    throw new Error('S3Provider.putObject not implemented');
  }
  async getObject(params: GetObjectParams): Promise<{ body: Buffer; contentType?: string }> {
    throw new Error('S3Provider.getObject not implemented');
  }
  async deleteObject(params: DeleteObjectParams): Promise<void> {
    throw new Error('S3Provider.deleteObject not implemented');
  }
  async getSignedUrl(params: SignedUrlParams): Promise<string> {
    throw new Error('S3Provider.getSignedUrl not implemented');
  }
}