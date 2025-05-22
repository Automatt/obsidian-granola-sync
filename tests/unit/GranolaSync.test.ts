import GranolaSync from '../../src/main';
import { GranolaApiService } from '../../src/services/GranolaApiService';
import { FileSystemService } from '../../src/services/FileSystemService';
import { MarkdownConverterService } from '../../src/services/MarkdownConverterService';
import { GranolaDoc } from '../../src/types';

jest.mock('../../src/services/GranolaApiService');
jest.mock('../../src/services/FileSystemService');
jest.mock('../../src/services/MarkdownConverterService');

describe('GranolaSync', () => {
  let plugin: GranolaSync;
  let mockApp: any;
  let mockApiService: jest.Mocked<GranolaApiService>;
  let mockFileSystem: jest.Mocked<FileSystemService>;
  let mockMarkdownConverter: jest.Mocked<MarkdownConverterService>;

  beforeEach(() => {
    mockApp = {
      vault: {
        adapter: {
          exists: jest.fn(),
          read: jest.fn(),
          write: jest.fn()
        },
        createFolder: jest.fn()
      },
      workspace: {
        containerEl: document.createElement('div')
      }
    };

    mockApiService = new GranolaApiService() as jest.Mocked<GranolaApiService>;
    mockFileSystem = new FileSystemService(mockApp.vault) as jest.Mocked<FileSystemService>;
    mockMarkdownConverter = new MarkdownConverterService() as jest.Mocked<MarkdownConverterService>;

    // Create a mock manifest
    const mockManifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      minAppVersion: '0.15.0',
      author: 'Test Author',
      description: 'Test Description'
    };

    plugin = new GranolaSync(mockApp, mockManifest);
    
    // Mock the Plugin class methods
    plugin.loadData = jest.fn().mockResolvedValue({});
    plugin.saveData = jest.fn().mockResolvedValue(undefined);
    plugin.registerInterval = jest.fn();

    plugin.settings = {
      tokenPath: 'test/token.json',
      granolaFolder: 'Granola',
      latestSyncTime: 0,
      isSyncEnabled: true,
      syncInterval: 1800,
      syncToDailyNotes: false,
      dailyNoteSectionHeading: '## Granola Notes'
    };
  });

  it('should load settings on startup', async () => {
    const mockSettings = { test: 'settings' };
    (plugin.loadData as jest.Mock).mockResolvedValueOnce(mockSettings);

    await plugin.loadSettings();

    expect(plugin.settings).toEqual(expect.objectContaining(mockSettings));
  });

  it('should save settings', async () => {
    await plugin.saveSettings();

    expect(plugin.saveData).toHaveBeenCalledWith(plugin.settings);
  });

  it('should setup periodic sync when enabled', () => {
    plugin.settings.isSyncEnabled = true;
    plugin.settings.syncInterval = 1800;

    plugin.setupPeriodicSync();

    expect(plugin.syncIntervalId).not.toBeNull();
    expect(plugin.registerInterval).toHaveBeenCalled();
  });

  it('should not setup periodic sync when disabled', () => {
    plugin.settings.isSyncEnabled = false;

    plugin.setupPeriodicSync();

    expect(plugin.syncIntervalId).toBeNull();
    expect(plugin.registerInterval).not.toHaveBeenCalled();
  });

  it('should clear periodic sync', () => {
    plugin.syncIntervalId = 123;
    const clearIntervalSpy = jest.spyOn(window, 'clearInterval');

    plugin.clearPeriodicSync();

    expect(clearIntervalSpy).toHaveBeenCalledWith(123);
    expect(plugin.syncIntervalId).toBeNull();
  });

  it('should sanitize filenames', () => {
    const invalidFilename = 'test/file:name*with?invalid<chars>';
    const result = plugin['sanitizeFilename'](invalidFilename);

    expect(result).toBe('testfilenamewithinvalidchars');
  });

  it('should escape regex strings', () => {
    const specialChars = '.*+?^${}()|[]\\';
    const result = plugin['escapeRegExp'](specialChars);

    expect(result).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });
}); 