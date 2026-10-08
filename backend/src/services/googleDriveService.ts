import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export class GoogleDriveService {
  private drive: any;
  private isConfigured: boolean = false;
  private folderId: string;

  constructor() {
    try {
      // Setup Google Drive Auth via Service Account
      // User must provide a base64 encoded service account json or path
      let credentials;
      if (process.env.GOOGLE_DRIVE_CREDENTIALS) {
        credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
      } else if (fs.existsSync(path.join(__dirname, '../../credentials.json'))) {
        credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../../credentials.json'), 'utf-8'));
      }

      if (credentials) {
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/drive.file'],
        });
        this.drive = google.drive({ version: 'v3', auth });
        this.isConfigured = true;
      }
      this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
    } catch (err) {
      console.warn('Google Drive is not configured. Provide GOOGLE_DRIVE_CREDENTIALS or credentials.json.');
    }
  }

  async uploadVideo(filePath: string, candidateName: string, examName: string, type: string) {
    if (!this.isConfigured) {
      console.warn('Skipping Google Drive upload: Not configured.');
      return null;
    }

    try {
      const fileName = `${candidateName} - ${examName} - ${type}.webm`;
      const fileMetadata: any = {
        name: fileName,
      };
      if (this.folderId) {
        fileMetadata.parents = [this.folderId];
      }

      const media = {
        mimeType: 'video/webm',
        body: fs.createReadStream(filePath),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink',
      });

      console.log(`Uploaded to Google Drive: ${response.data.webViewLink}`);
      return response.data.webViewLink;
    } catch (err) {
      console.error('Google Drive Upload Failed:', err);
      return null;
    }
  }
}

export const googleDriveService = new GoogleDriveService();
