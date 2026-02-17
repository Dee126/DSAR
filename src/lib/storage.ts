import { createHash } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

export interface StorageProvider {
  upload(buffer: Buffer, filename: string, contentType: string): Promise<{ storageKey: string; hash: string; size: number }>;
  download(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor() {
    this.basePath = process.env.STORAGE_LOCAL_PATH || "./uploads";
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }
  }

  async upload(buffer: Buffer, filename: string, _contentType: string) {
    const hash = createHash("sha256").update(buffer).digest("hex");
    const ext = filename.split(".").pop() || "bin";
    const storageKey = `${uuidv4()}.${ext}`;
    const filePath = join(this.basePath, storageKey);
    await writeFile(filePath, buffer);
    return { storageKey, hash, size: buffer.length };
  }

  async download(storageKey: string): Promise<Buffer> {
    const filePath = join(this.basePath, storageKey);
    return readFile(filePath);
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = join(this.basePath, storageKey);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }
}

class S3StorageProvider implements StorageProvider {
  private bucket: string;
  private region: string;
  private localFallback: LocalStorageProvider;

  constructor() {
    this.bucket = process.env.S3_BUCKET || "";
    this.region = process.env.S3_REGION || process.env.AWS_REGION || "eu-central-1";
    this.localFallback = new LocalStorageProvider();
  }

  private get isConfigured(): boolean {
    return Boolean(this.bucket);
  }

  async upload(buffer: Buffer, filename: string, contentType: string) {
    const hash = createHash("sha256").update(buffer).digest("hex");
    const ext = filename.split(".").pop() || "bin";
    const storageKey = `${uuidv4()}.${ext}`;

    if (!this.isConfigured) {
      console.warn("[S3] S3_BUCKET not set; using local storage fallback");
      return this.localFallback.upload(buffer, filename, contentType);
    }

    try {
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({ region: this.region });
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          Body: buffer,
          ContentType: contentType,
          ChecksumSHA256: Buffer.from(hash, "hex").toString("base64"),
        }),
      );
      return { storageKey, hash, size: buffer.length };
    } catch (err) {
      console.error("[S3] Upload failed, falling back to local:", (err as Error).message);
      return this.localFallback.upload(buffer, filename, contentType);
    }
  }

  async download(storageKey: string): Promise<Buffer> {
    if (!this.isConfigured) {
      console.warn("[S3] S3_BUCKET not set; using local storage fallback");
      return this.localFallback.download(storageKey);
    }

    try {
      const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({ region: this.region });
      const response = await client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        }),
      );

      if (!response.Body) {
        throw new Error(`S3 object ${storageKey} has no body`);
      }
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (err) {
      console.error("[S3] Download failed, falling back to local:", (err as Error).message);
      return this.localFallback.download(storageKey);
    }
  }

  async delete(storageKey: string): Promise<void> {
    if (!this.isConfigured) {
      console.warn("[S3] S3_BUCKET not set; using local storage fallback");
      return this.localFallback.delete(storageKey);
    }

    try {
      const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({ region: this.region });
      await client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        }),
      );
    } catch (err) {
      console.error("[S3] Delete failed, falling back to local:", (err as Error).message);
      return this.localFallback.delete(storageKey);
    }
  }
}

let _storage: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!_storage) {
    _storage =
      process.env.STORAGE_TYPE === "s3"
        ? new S3StorageProvider()
        : new LocalStorageProvider();
  }
  return _storage;
}
