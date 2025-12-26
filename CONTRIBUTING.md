# Contributing

Thanks for helping out. Bug reports, ideas for new bonus or penalty rules, and pull requests are all welcome.

## Setup

1. Install Node.js 22.12 or newer.
2. Run `corepack enable` once. This lets the repo's `packageManager` field pick Yarn 4. Don't use npm, because it creates a conflicting `package-lock.json`.
3. Run `yarn install`, then `yarn dev`.

Yarn refuses package versions published less than a day ago. If an install fails with "quarantined", use a slightly older version.

## Before opening a pull request

```sh
yarn format     # Prettier: tabs, single quotes, 100 columns
yarn lint
yarn tsc --noEmit
yarn test
```

CI runs the same checks on every pull request.

## Where things live

| Path                 | What                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `src/lib/payouts.ts` | All payout math, as pure functions. Add new rules here, with tests.     |
| `src/lib/migrate.ts` | Converts older save files to the current format. Keep old data loading. |
| `src/models.ts`      | Data types and default rates                                            |
| `src/store.ts`       | Zustand store and its actions. Saving happens automatically.            |
| `src/components/`    | Screens, plus shared UI pieces in `ui/`                                 |
| `src/data/`          | Boss and map lists                                                      |
| `electron/`          | Main process (file storage, dialogs) and the preload bridge             |

Never store payout totals. The UI always computes them from raids through `src/lib/payouts.ts`. If you change the save format, update `migrate.ts` and add a test with the old shape.

## Releasing

1. Bump `version` in `package.json`.
2. Commit, then tag the commit with the same version, for example `git tag v1.1.0 && git push --tags`.
3. The Release workflow builds the Windows installer and attaches it to a GitHub release. It fails if the tag and the version in `package.json` don't match.
