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
  async upload(buffer: Buffer, filename: string, _contentType: string) {
    const hash = createHash("sha256").update(buffer).digest("hex");
    const ext = filename.split(".").pop() || "bin";
    const storageKey = `${uuidv4()}.${ext}`;
    // TODO: Implement real S3 upload using @aws-sdk/client-s3
    // const command = new PutObjectCommand({ Bucket, Key: storageKey, Body: buffer, ContentType });
    // await s3Client.send(command);
    console.warn("S3 storage not implemented; falling back to local");
    const local = new LocalStorageProvider();
    return local.upload(buffer, filename, _contentType);
  }

  async download(storageKey: string): Promise<Buffer> {
    console.warn("S3 download not implemented; falling back to local");
    const local = new LocalStorageProvider();
    return local.download(storageKey);
  }

  async delete(storageKey: string): Promise<void> {
    console.warn("S3 delete not implemented; falling back to local");
    const local = new LocalStorageProvider();
    return local.delete(storageKey);
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
