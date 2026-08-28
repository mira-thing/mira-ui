# mira-ui

<img width="3824" height="912" alt="mira-ui-overview" src="https://github.com/user-attachments/assets/afe75e33-2c2f-496d-b29e-6c84b292d14f" />

Frontend for the Mira project, a free and open-source standalone firmware for the Spotify Car Thing.

React + TypeScript + Vite.

Part of [Mira](https://github.com/mira-thing).

## Related projects

- [`mira-daemon`](https://github.com/mira-thing/mira-daemon) - daemon
- [`mira-voice`](https://github.com/mira-thing/mira-voice) - on-device voice stack
- [`mira-firmware`](https://github.com/mira-thing/mira-firmware) - image builder
- [`mira-releases`](https://github.com/mira-thing/mira-releases) - prebuilt firmware images
- [`mira-ui`](.) - Vite + React UI (this repo)

## Support

Mira is free and open source. If you'd like to support development, you can do so on [GitHub Sponsors](https://github.com/sponsors/MustakimK) or [Ko-fi](https://ko-fi.com/MustakimK). Every bit genuinely helps and it's what makes this sustainable to keep working on. Questions and updates are on [Discord](https://discord.gg/SR2Pne7EPM).

## Development

| Command                 | Purpose                     |
| ----------------------- | --------------------------- |
| `npm run dev`           | Vite dev server with HMR    |
| `npm run build`         | Production build to `dist/` |
| `npm run lint`          | ESLint                      |
| `npm run typecheck`     | `tsc -b --noEmit`           |
| `npm test`              | Run vitest suite            |
| `npm run test:watch`    | Vitest in watch mode        |
| `npm run test:coverage` | Coverage report             |

screen switcher is available when holding down the (`` ` ``) key for iterating on individual UI states without a live daemon.

### Browser target

The Car Thing's Chromium is Chrome 69 (2018), so the production bundle uses `@vitejs/plugin-legacy` to emit a compatible build. The modern bundle is disabled in `vite.config.ts` since it's never shipped.

## License

Apache 2.0, see [LICENSE](LICENSE).

> "Spotify" and "Car Thing" are trademarks of Spotify AB. This software is not affiliated with or endorsed by Spotify AB.
