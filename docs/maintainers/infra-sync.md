# Infra Sync

Infra sync is maintainer-only tooling for synchronizing gitignored or private deployment files. It is not required 
and cannot be run by ordinary contributors.

## Public Wrapper

The public repo exposes wrapper scripts:

```bash
npm run infra:setup
npm run infra:refresh
npm run infra:full-refresh
npm run infra:new
npm run infra:status
npm run infra:pull
npm run infra:sync
```

If the local `.infra-sync/` tool is not installed, commands fail with a maintainer-only message instead of a stack trace.

## Setup

Maintainers need GitHub CLI access to the private devops repository:

```bash
gh auth login
npm run infra:setup
```

The setup script asks for the private devops repo in `OWNER/NAME` format, copies `tools/infra-sync` from that repo into local `.infra-sync/`, and removes its temporary clone when finished.

`.infra-sync/` is local working state and should stay gitignored.

## Workflow

Use the canonical commands:

- `npm run infra:new` - initialize local sync state and baselines (copies ignored files into your local environment).
- `npm run infra:status` - inspect drift (see the differences between local and devops files).
- `npm run infra:pull` - pull private/deploy file changes into the local checkout.
- `npm run infra:sync` - synchronize local changes back into the devops and private production repositories.

`infra:status`, `infra:pull`, and `infra:sync` should validate local state and baselines before remote work.

## Refresh

```bash
npm run infra:refresh
```

This refreshes the infra-sync tool with the most recent version. Running this command does not require you to rerun
the `npm run infra:new` command, as it updates only the code of the tool, not the local sync state and memory.

## Full Refresh

```bash
npm run infra:full-refresh
```

This deletes `.infra-sync/`, including local sync state and baselines, then reinstalls the tool. After a full refresh, run:

```bash
npm run infra:new
```

## Contributor Boundary

Do not make infra-sync a prerequisite for normal contribution. Contributor docs should say that infra sync is maintainer-only and unnecessary for ordinary local development.

## How the tool actually works

Copies of the gitignored infrastructure files exist in three separate locations: the private production repo, the private
devops repo, and the local dev environment. They do not exist (are gitignored in) the public repository. The `infra-sync`
tool exists to keep a local developer's copy of the infrastructure files synced with the remote copies. This includes
pulling down remote changes to the local and syncing local changes to the remotes. It allows the local developer to
work soley in their local clone of the public repository, enabling changes to infrastructure files to be synced
from there to the private repo. This means that the majority of the time, developers do not need to touch the devops
or production repositories.

To effectively enable this, the tool keeps track of history and state, which allows it to know what changes to pull in and
what changes to sync up. 
