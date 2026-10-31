import { describe, expect, it } from 'vitest'
import { parseLinkInput } from './linkUrl'

describe('parseLinkInput', () => {
  it.each([
    ['https://example.com', 'https://example.com'],
    ['http://example.com/a?b=1#c', 'http://example.com/a?b=1#c'],
    ['  https://example.com  ', 'https://example.com'],
    ['mailto:a@b.co', 'mailto:a@b.co'],
    ['a@b.co', 'mailto:a@b.co'],
    ['example.com', 'https://example.com'],
    ['example.com/path', 'https://example.com/path'],
    ['http://localhost:3000', 'http://localhost:3000'],
  ])('accepts %s', (input, href) => {
    expect(parseLinkInput(input)).toEqual({ kind: 'set', href })
  })

  it.each(['', '   '])('treats empty input %j as remove', (input) => {
    expect(parseLinkInput(input)).toEqual({ kind: 'remove' })
  })

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<b>x</b>',
    'file:///etc/passwd',
    'ftp://example.com',
    'vbscript:x',
    'not a url',
    'nodots',
    'https://',
  ])('rejects %s', (input) => {
    expect(parseLinkInput(input).kind).toBe('invalid')
  })
})
