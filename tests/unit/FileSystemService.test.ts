import { FileSystemService } from '../../src/services/FileSystemService';

describe('FileSystemService', () => {
  let service: FileSystemService;
  let mockVault: any;

  beforeEach(() => {
    mockVault = {
      adapter: {
        exists: jest.fn(),
        read: jest.fn(),
        write: jest.fn()
      },
      createFolder: jest.fn()
    };
    service = new FileSystemService(mockVault);
  });

  it('should check if file exists', async () => {
    const path = 'test/path.md';
    mockVault.adapter.exists.mockResolvedValueOnce(true);

    const result = await service.exists(path);

    expect(mockVault.adapter.exists).toHaveBeenCalledWith('test/path.md');
    expect(result).toBe(true);
  });

  it('should read file content', async () => {
    const path = 'test/path.md';
    const content = 'test content';
    mockVault.adapter.read.mockResolvedValueOnce(content);

    const result = await service.read(path);

    expect(mockVault.adapter.read).toHaveBeenCalledWith('test/path.md');
    expect(result).toBe(content);
  });

  it('should write file content', async () => {
    const path = 'test/path.md';
    const content = 'test content';

    await service.write(path, content);

    expect(mockVault.adapter.write).toHaveBeenCalledWith('test/path.md', content);
  });

  it('should create folder', async () => {
    const path = 'test/folder';

    await service.createFolder(path);

    expect(mockVault.createFolder).toHaveBeenCalledWith('test/folder');
  });

  it('should normalize paths', async () => {
    const path = 'test\\path.md';
    mockVault.adapter.exists.mockResolvedValueOnce(true);

    await service.exists(path);

    expect(mockVault.adapter.exists).toHaveBeenCalledWith('test/path.md');
  });
}); 