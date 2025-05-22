import { IFileSystem } from '../interfaces';
import { normalizePath } from 'obsidian';

export class FileSystemService implements IFileSystem {
  constructor(private vault: any) {}

  async exists(path: string): Promise<boolean> {
    return await this.vault.adapter.exists(normalizePath(path));
  }

  async read(path: string): Promise<string> {
    return await this.vault.adapter.read(normalizePath(path));
  }

  async write(path: string, content: string): Promise<void> {
    await this.vault.adapter.write(normalizePath(path), content);
  }

  async createFolder(path: string): Promise<void> {
    await this.vault.createFolder(normalizePath(path));
  }
} 