/**
 * The Yacrum REST API, as this server calls it.
 *
 * ⚑ This server reaches Yacrum only through its public API (`/api/v1`), with the
 * user's own API key: it can do exactly what the key's member could do in the
 * app, and nothing more. It never sees a database.
 */

export class YacrumApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
    this.name = 'YacrumApiError';
  }
}

export interface YacrumConfig {
  /** e.g. https://yacrum--yacrum.us-central1.hosted.app */
  baseUrl: string;
  /** a key from Administration → API Keys: yk_… */
  apiKey: string;
}

export type Fetch = typeof fetch;

export class YacrumClient {
  private readonly base: string;

  constructor(private readonly config: YacrumConfig, private readonly fetcher: Fetch = fetch) {
    this.base = `${config.baseUrl.replace(/\/+$/, '')}/api/v1`;
  }

  async request<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, options: { query?: Record<string, string | undefined>; body?: unknown } = {}): Promise<T> {
    const url = new URL(this.base + path);
    for (const [key, value] of Object.entries(options.query ?? {})) if (value !== undefined && value !== '') url.searchParams.set(key, value);
    const response = await this.fetcher(url, {
      method,
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        accept: 'application/json',
        ...(options.body !== undefined && { 'content-type': 'application/json' }),
        'user-agent': 'yacrum-mcp',
      },
      ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
    });
    const json = (await response.json().catch(() => null)) as { data?: T; error?: { code: string; message: string; details?: unknown } } | null;
    if (!response.ok || !json || json.error) {
      throw new YacrumApiError(response.status, json?.error?.code ?? 'http_error', json?.error?.message ?? `Yacrum answered ${response.status}.`, json?.error?.details);
    }
    return json.data as T;
  }

  get<T>(path: string, query?: Record<string, string | undefined>) {
    return this.request<T>('GET', path, { query });
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>('POST', path, { body });
  }

  patch<T>(path: string, body: unknown) {
    return this.request<T>('PATCH', path, { body });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>('PUT', path, { body });
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}
