# Scripts

This folder contains local development and maintainer scripts for the repository.

## Contributor Firebase Emulator Setup

Contributors can run:

```bash
npm run emulators:setup
```

That creates demo-only, gitignored Firebase config files for the local Emulator Suite. It does not use production project IDs, rules, indexes, or Firebase app config values. Existing files are skipped by default; rerun with
`npm run emulators:setup -- --force` only when you intentionally want to replace
local emulator scaffold files.

See [Firebase emulators](../docs/getting-started/firebase-emulators.md) for the full contributor workflow.

## Maintainer Infra Sync

Infra sync scripts are maintainer-only and are not required for ordinary contributors.

See [Infra sync](../docs/maintainers/infra-sync.md) for the maintainer workflow.

For the complete script inventory and classification, see [npm scripts](../docs/architecture/npm-scripts.md).
