export const App = jest.fn()
export const Editor = jest.fn()
export const MarkdownView = jest.fn()
export const TFile = jest.fn()
export const TFolder = jest.fn()
export const Vault = jest.fn()
export const normalizePath = jest.fn((path: string) => path)
export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const buffer = Buffer.from(base64, 'base64')
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  )
}
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string =>
  Buffer.from(buffer).toString('base64')
