import { EagleClient, EagleTransport } from './eagle-client'

function client(
  handler: (url: string, body?: Record<string, unknown>) => unknown,
): EagleClient {
  const transport: EagleTransport = async ({ url, body }) => ({
    status: 200,
    json: handler(url.replace('http://eagle', ''), body),
  })
  return new EagleClient('http://eagle', transport, async () => undefined)
}

describe('EagleClient', () => {
  it('reports running only when the application answers success', async () => {
    expect(
      await client(() => ({ status: 'success', data: {} })).isRunning(),
    ).toBe(true)
    expect(await client(() => ({ status: 'error' })).isRunning()).toBe(false)
  })

  it('posts addFromPath and returns the new item id', async () => {
    const calls: Record<string, unknown>[] = []
    const eagle = client((url, body) => {
      if (url === '/api/item/addFromPath' && body) calls.push(body)
      return { status: 'success', data: 'ID1' }
    })

    await expect(
      eagle.addFromPath({ path: '/v/a.png', name: 'a', annotation: 'cat' }),
    ).resolves.toBe('ID1')
    expect(calls).toEqual([{ path: '/v/a.png', name: 'a', annotation: 'cat' }])
  })

  it('surfaces Eagle error messages from addFromPath', async () => {
    await expect(
      client(() => ({ status: 'error', message: 'bad path' })).addFromPath({
        path: '/x',
        name: 'x',
      }),
    ).rejects.toThrow('bad path')
  })

  it('polls item info until the item exists', async () => {
    let attempts = 0
    const eagle = client((url) => {
      if (!url.startsWith('/api/item/info')) return {}
      attempts += 1
      return attempts < 3
        ? { status: 'error' }
        : { status: 'success', data: { id: 'ID1', name: 'a', ext: 'png' } }
    })

    await expect(eagle.waitForItem('ID1')).resolves.toEqual({
      id: 'ID1',
      name: 'a',
      ext: 'png',
    })
    expect(attempts).toBe(3)
  })

  it('reads the library path from either response shape', async () => {
    await expect(
      client(() => ({
        status: 'success',
        data: { library: { path: '/lib.library' } },
      })).getLibraryPath(),
    ).resolves.toBe('/lib.library')
    await expect(
      client(() => ({
        status: 'success',
        data: { library: '/L.library' },
      })).getLibraryPath(),
    ).resolves.toBe('/L.library')
  })
})
