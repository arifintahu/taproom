# Taproom web

The Vite + React + TypeScript app for Taproom. See the [project README](../README.md) for gameplay, architecture and setup.

```bash
pnpm install
pnpm dev            # http://localhost:5173 on MockChain; ?chain=local for a local gnodev chain
pnpm test           # Vitest
pnpm test:e2e       # Playwright smoke and flow tests (PW_CHANNEL=chrome uses the installed Chrome)
pnpm screenshots    # regenerates ../media/*.png for the README
pnpm lint && pnpm build
```
