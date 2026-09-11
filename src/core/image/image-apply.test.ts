import { insertMarkdownAtCursorLine } from './image-apply'

const markdown = '![[a.png]]'

describe('insertMarkdownAtCursorLine', () => {
  it('inserts below a non-empty cursor line', () => {
    expect(
      insertMarkdownAtCursorLine({
        content: 'one\ntwo\nthree',
        markdown,
        cursorLine: 1,
      }),
    ).toBe('one\ntwo\n![[a.png]]\nthree')
  })

  it('takes over a blank cursor line', () => {
    expect(
      insertMarkdownAtCursorLine({
        content: 'one\n\nthree',
        markdown,
        cursorLine: 1,
      }),
    ).toBe('one\n![[a.png]]\n\nthree')
  })

  it('appends at the end without a cursor, keeping the trailing newline', () => {
    expect(
      insertMarkdownAtCursorLine({
        content: 'one\ntwo\n',
        markdown,
        cursorLine: null,
      }),
    ).toBe('one\ntwo\n![[a.png]]\n')
  })

  it('appends after the last line when the note has no trailing newline', () => {
    expect(
      insertMarkdownAtCursorLine({
        content: 'one',
        markdown,
        cursorLine: null,
      }),
    ).toBe('one\n![[a.png]]')
  })

  it('handles an empty note', () => {
    expect(
      insertMarkdownAtCursorLine({ content: '', markdown, cursorLine: null }),
    ).toBe('![[a.png]]\n')
  })

  it('clamps a cursor beyond the end of the note', () => {
    expect(
      insertMarkdownAtCursorLine({
        content: 'one\ntwo',
        markdown,
        cursorLine: 99,
      }),
    ).toBe('one\ntwo\n![[a.png]]')
  })
})
