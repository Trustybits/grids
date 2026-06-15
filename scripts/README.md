# scripts folder

This folder should contain all local, development-only scripts across the project.

## Contributor Firebase emulator setup

Contributors working from a public fork can run:

```bash
npm run emulators:setup
```

That creates demo-only, gitignored Firebase config files for the local Emulator
Suite. It does not use production project IDs, rules, indexes, or Firebase app
config values. Existing files are skipped by default; rerun with
`npm run emulators:setup -- --force` only when you intentionally want to replace
local emulator scaffold files.
