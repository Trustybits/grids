# Contributor/Public Setup

## Bsaic setup

To set up grids to work in your local environment, see the instructions under `../getting-started`. To use grids
locally, you do not need to setup Firebase emulators. Running `npm run install` then `npm run dev` will by default
put grids into an in-memory implementation. This means that all data is temporarily stored in memory without
any persistence, so reloads or shutdowns will remove all data. This also launches grids without any real
backend, meaning most, but not all, features will be available.

For a closer reproduction of the production grids, you can use the Firebase emulators as outlined in the getting started
instructions. These emulators will enable you to use a locally-hosted backend, not a live production one. It will give
you behavior closer to the actual grids production environment, but cannot replicate it exactly. The rules and settings
used by the emulators do not match the ones used in production. As with the in-memory implementations, shutting down
the emulators will result in a loss of data.

If you would like actual persistence between reloads/shutdowns, you must set up your own backing database or backend
service.

We encourage you to contribute to grids.

## Infra-Sync

Contributors do not have access to the `infra-sync` tooling that the internal developers do. Running any of the `infra`
commands found in the root `package.json` will fail. This is intended behavior, as the `infra-sync` tool is not necessary
for your local checkout and unnecessary for most contributions.

If you feel that your contribution may require access to the `infra-sync` tooling, please contact the grids 
admins/maintainers.