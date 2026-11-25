# Taproom web

Pixel-art tavern UI for Taproom. Milestone 1 runs on `MockChain` only (no testnet calls).

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm test           # Vitest: rules, room layout, scenarios S1-S13
pnpm test:e2e       # Playwright smoke test (builds and previews first)
pnpm lint && pnpm build
```

`?dev&scn=s8` seeds a scenario (s1-s13, s10a-s10f). The default is S1, a first visit.

Layout: `src/game` (pure rules, selectors, room layout), `src/chain` (`ChainClient`, `MockChain`),
`src/state` (session store), `src/scene` (room, gnomes), `src/ui` (HUD, dialog box, windows), `src/dev` (scenarios).
