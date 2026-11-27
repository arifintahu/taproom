import { describe, expect, it } from 'vitest'
import { pickChain } from './pick'

const q = (s: string) => new URLSearchParams(s)

describe('pickChain', () => {
  it('uses ?chain= when given', () => {
    expect(pickChain(q('?chain=local'), 'onyx')).toBe('local')
    expect(pickChain(q('?chain=mock'), 'onyx')).toBe('mock')
    expect(pickChain(q('?dev&chain=onyx'), undefined)).toBe('onyx')
  })

  it('falls back to the build default, then to the mock chain', () => {
    expect(pickChain(q(''), 'onyx')).toBe('onyx')
    expect(pickChain(q(''), undefined)).toBe('mock')
    expect(pickChain(q(''), '')).toBe('mock')
  })

  it('keeps dev mode on the mock chain unless a chain is named', () => {
    expect(pickChain(q('?dev'), 'onyx')).toBe('mock')
    expect(pickChain(q('?dev&scn=s8'), 'onyx')).toBe('mock')
  })
})
