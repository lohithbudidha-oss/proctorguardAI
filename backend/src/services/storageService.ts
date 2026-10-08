import fs from 'fs';
import path from 'path';

class StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(__dirname, '../../temp_storage');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async uploadChunk(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const fullPath = path.join(this.baseDir, key);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }

  async generateSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // For local, just return the path (this would need a static route in production)
    return `file://${path.join(this.baseDir, key)}`;
  }

  getFilePath(key: string): string {
    return path.join(this.baseDir, key);
  }
}

export const storageService = new StorageProvider();
