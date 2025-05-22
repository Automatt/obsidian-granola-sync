import { GranolaApiService } from '../../src/services/GranolaApiService';
import { GranolaApiResponse } from '../../src/types';

// Mock the requestUrl function
jest.mock('obsidian', () => ({
  requestUrl: jest.fn()
}));

describe('GranolaApiService', () => {
  let service: GranolaApiService;
  const mockAccessToken = 'test-token';

  beforeEach(() => {
    service = new GranolaApiService();
    jest.clearAllMocks();
  });

  it('should fetch documents successfully', async () => {
    const mockResponse: GranolaApiResponse = {
      docs: [
        {
          id: '1',
          title: 'Test Doc',
          created_at: '2024-01-01',
          updated_at: '2024-01-02',
          last_viewed_panel: {
            content: {
              type: 'doc',
              content: []
            }
          }
        }
      ]
    };

    const { requestUrl } = require('obsidian');
    requestUrl.mockResolvedValueOnce({
      json: mockResponse
    });

    const result = await service.getDocuments(mockAccessToken);

    expect(requestUrl).toHaveBeenCalledWith({
      url: 'https://api.granola.ai/v2/get-documents',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mockAccessToken}`,
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'User-Agent': 'GranolaObsidianPlugin/ObsidianPlugin-0.1.7',
        'X-Client-Version': 'ObsidianPlugin-0.1.7'
      },
      body: JSON.stringify({
        limit: 100,
        offset: 0,
        include_last_viewed_panel: true
      }),
      throw: true
    });

    expect(result).toEqual(mockResponse.docs);
  });

  it('should throw error for invalid response format', async () => {
    const { requestUrl } = require('obsidian');
    requestUrl.mockResolvedValueOnce({
      json: { invalid: 'format' }
    });

    await expect(service.getDocuments(mockAccessToken)).rejects.toThrow('Invalid API response format');
  });

  it('should throw error for API failure', async () => {
    const { requestUrl } = require('obsidian');
    requestUrl.mockRejectedValueOnce(new Error('API Error'));

    await expect(service.getDocuments(mockAccessToken)).rejects.toThrow('API Error');
  });
}); 