import { useState } from 'react'
import { shortHash } from '../game/format'

/** A tx hash shown short, with a button that copies the full value. */
export function CopyHash({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <span className="hash">
      <code title={hash}>{shortHash(hash)}</code>
      <button type="button" className="pb sm" onClick={() => void copy()} aria-label={`Copy transaction hash ${hash}`}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span className="sr" aria-live="polite">{copied ? 'Transaction hash copied.' : ''}</span>
    </span>
  )
}
