export interface PutObjectParams {
  key: string;
  contentType: string;
  body: Buffer | Uint8Array | string;
}

export interface GetObjectParams {
  key: string;
}

export interface DeleteObjectParams {
  key: string;
}

export interface SignedUrlParams {
  key: string;
  expiresInSeconds: number;
}

export interface StorageProvider {
  putObject(params: PutObjectParams): Promise<{ key: string; size: number }>;
  getObject(params: GetObjectParams): Promise<{ body: Buffer; contentType?: string }>;
  deleteObject(params: DeleteObjectParams): Promise<void>;
  getSignedUrl(params: SignedUrlParams): Promise<string>;
}