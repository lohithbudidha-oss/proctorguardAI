import fs from 'fs';
import path from 'path';

class StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = process.env.VERCEL
      ? path.join(require('os').tmpdir(), 'flair_storage')
      : path.join(__dirname, '../../temp_storage');
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    } catch (e) {
      console.warn('[StorageProvider] Could not create baseDir:', e);
    }
  }

  async uploadChunk(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const fullPath = path.resolve(this.baseDir, key);
    if (!fullPath.startsWith(path.resolve(this.baseDir))) {
      throw new Error('Path traversal detected');
    }
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }

  async generateSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const fullPath = path.resolve(this.baseDir, key);
    if (!fullPath.startsWith(path.resolve(this.baseDir))) {
      throw new Error('Path traversal detected');
    }
    // In MVP this should be a static route mapped to temp_storage or presigned S3 url
    return `file://${fullPath}`;
  }

  getFilePath(key: string): string {
    const fullPath = path.resolve(this.baseDir, key);
    if (!fullPath.startsWith(path.resolve(this.baseDir))) {
      throw new Error('Path traversal detected');
    }
    return fullPath;
  }
}

export const storageService = new StorageProvider();
