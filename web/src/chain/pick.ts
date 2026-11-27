// Which chain the app talks to: `?chain=` wins; `?dev` alone is dev mode on the mock chain;
// otherwise the build's default (VITE_DEFAULT_CHAIN, "onyx" for the hosted site), else the mock chain.
// `?chain=mock` forces the simulated chain on any build.
export function pickChain(q: URLSearchParams, buildDefault: string | undefined): string {
  const named = q.get('chain')
  if (named) return named
  if (q.has('dev')) return 'mock'
  return buildDefault || 'mock'
}
