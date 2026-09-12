import { requestUrl } from 'obsidian'

import { EagleItemSummary } from './eagle-paths'

const ITEM_POLL_INTERVAL_MS = 250
const ITEM_POLL_TIMEOUT_MS = 10_000

type EagleResponse<T> = {
  status?: 'success' | 'error'
  data?: T
  message?: string
}

export type EagleTransport = (input: {
  url: string
  method: 'GET' | 'POST'
  body?: Record<string, unknown>
}) => Promise<{ status: number; json: unknown }>

const obsidianTransport: EagleTransport = async ({ url, method, body }) => {
  const response = await requestUrl({
    url,
    method,
    contentType: 'application/json',
    body: body ? JSON.stringify(body) : undefined,
    throw: false,
  })
  return { status: response.status, json: response.json as unknown }
}

/** Thin wrapper over Eagle's local HTTP API (https://api.eagle.cool). */
export class EagleClient {
  constructor(
    private readonly baseUrl: string,
    private readonly transport: EagleTransport = obsidianTransport,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async isRunning(): Promise<boolean> {
    try {
      const response = await this.get<unknown>('/api/application/info')
      return response.status === 'success'
    } catch {
      return false
    }
  }

  async addFromPath(input: {
    path: string
    name: string
    annotation?: string
    tags?: string[]
  }): Promise<string> {
    const response = await this.post<string>('/api/item/addFromPath', input)
    if (response.status !== 'success' || typeof response.data !== 'string') {
      throw new Error(response.message ?? 'Eagle rejected the image.')
    }
    return response.data
  }

  /** Eagle acknowledges an import before the item exists; poll until it does. */
  async waitForItem(id: string): Promise<EagleItemSummary> {
    const deadline = Date.now() + ITEM_POLL_TIMEOUT_MS
    while (Date.now() < deadline) {
      const response = await this.get<EagleItemSummary>(
        `/api/item/info?id=${encodeURIComponent(id)}`,
      )
      if (response.status === 'success' && response.data?.id) {
        return response.data
      }
      await this.sleep(ITEM_POLL_INTERVAL_MS)
    }
    throw new Error(`Eagle did not finish importing item ${id}.`)
  }

  async getLibraryPath(): Promise<string> {
    const response = await this.get<{
      library?: string | { path?: string }
      path?: string
    }>('/api/library/info')
    const data = response.data
    const path =
      typeof data?.library === 'string'
        ? data.library
        : (data?.library?.path ?? data?.path)
    if (!path) throw new Error('Eagle did not report its library path.')
    return path
  }

  private async get<T>(endpoint: string): Promise<EagleResponse<T>> {
    const { json } = await this.transport({
      url: `${this.baseUrl}${endpoint}`,
      method: 'GET',
    })
    return (json ?? {}) as EagleResponse<T>
  }

  private async post<T>(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<EagleResponse<T>> {
    const { json } = await this.transport({
      url: `${this.baseUrl}${endpoint}`,
      method: 'POST',
      body,
    })
    return (json ?? {}) as EagleResponse<T>
  }
}
