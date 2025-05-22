import { requestUrl } from 'obsidian';
import { IGranolaApi } from '../interfaces';
import { GranolaDoc, GranolaApiResponse } from '../types';

export class GranolaApiService implements IGranolaApi {
  private readonly baseUrl = 'https://api.granola.ai/v2';
  private readonly clientVersion = 'ObsidianPlugin-0.1.7';

  async getDocuments(accessToken: string): Promise<GranolaDoc[]> {
    const response = await requestUrl({
      url: `${this.baseUrl}/get-documents`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'User-Agent': `GranolaObsidianPlugin/${this.clientVersion}`,
        'X-Client-Version': this.clientVersion
      },
      body: JSON.stringify({
        limit: 100,
        offset: 0,
        include_last_viewed_panel: true
      }),
      throw: true
    });

    const apiResponse = response.json as GranolaApiResponse;
    if (!apiResponse || !apiResponse.docs) {
      throw new Error('Invalid API response format');
    }

    return apiResponse.docs;
  }
} 