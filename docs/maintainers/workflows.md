# GitHub Workflows

All code in the public repository (Trustybits/grids), including GitHub workflows, are copied to the
private production repository (with the exception of gitignored files and folders). Since this is 
the case, the production repo inherits the GitHub workflows present in the public repo.

If an unpriviledged GitHub workflow is meant for both repositories (such as the CI workflow in `ci.yml`), no
special consideration must be made. When the production repository syncs with the public one, it
will inherit the workflow and run it as defined. Special considerations must be made in the
two following cases: priviledged workflows meant to be run in both repositories, and workflows meant
to only be run in the public repository.

## Priviledged, Shared Workflows

If a workflow is priviledged, it has permissions or authentication tokens beyond the normal
`GitHub token`, or make use of external credentials. In general, if a priviledged workflow
does not have to exist in the public repository it should not, and should instead be added
directly and only to the production repository. However, in the case where a priviledged workflow
must be present in both the public and the production repository, it should be added to the
public repository. In this case, any special considerations made to provide priviledged credentials
to the workflow in the public repository must also be made in the production repository.

## Only Public Workflows

For workflows that are only designed to be run in the public repo, priviledged or not,
guards must be put in place to ensure that they do not accidentally run in the production repo.
At this point in time, all workflows are synced to the production repository without regard
for where they are meant to run (this may be a future feature). Since this is the case,
workflows that are only meant to be run in the public repo should contain a built in 
guard in the workflow itself that checks which repository it's running in, commonly
with `github.repository == 'Trustybits/grids'` in an `if` statement before a job's steps.
An example of this can be found in the `github_discord_sync.yml` file.

This guard essentially makes the workflow a no-op if it tries to run in any repository
other than `Trustybits/grids`. This has the additional benefit that users who fork
the public repository also do not have unwanted workflows attempting to run.

## Firebase Functions Workspace Dependencies

Firebase Functions deploys use the Functions source directory configured in the
private production repo's Firebase config. In this project, that source is
`apps/firebase-functions`, not the monorepo root.

That distinction matters when Functions code imports another local workspace
package. A deploy can pass TypeScript build, rules validation, index deployment,
and source upload, then fail when Cloud Functions tries to load user code:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@grids/contracts' imported from /workspace/lib/storage/onCall_prepareGridDuplicateStorage.js
```

This means the deployed runtime could not resolve a package from the uploaded
Functions artifact. It is not an IAM failure, not a Firestore or Storage rules
failure, and not necessarily a syntax error even if Firebase prints its generic
syntax-error hint.

The `@grids/contracts` failure was resolved by making the compiled Functions
artifact self-contained for the runtime code it uses:

- `@grids/contracts` remains a development/build-time workspace dependency of
  `apps/firebase-functions`.
- The Functions build first builds `packages/contracts`.
- The Functions build copies the required compiled contracts runtime into
  `apps/firebase-functions/lib/contracts`.
- The Functions build rewrites compiled imports such as
  `@grids/contracts/storage` to local relative imports under `lib/contracts`.
- The Functions deploy script builds before calling `firebase deploy`.

For future failures of the same type, inspect the first `ERR_MODULE_NOT_FOUND`
package in the Cloud Functions stack trace and check whether the compiled
`apps/firebase-functions/lib` output still imports a monorepo workspace package
that is outside the Functions source directory. Do not rely on root workspace
symlinks, root `node_modules`, or `file:../../...` dependencies being available
inside Cloud Functions' `/workspace`.

Prefer one of these fixes:

- bundle or copy the required compiled runtime code into the Functions artifact;
- publish the shared package somewhere Cloud Functions can install from; or
- move the runtime code into `apps/firebase-functions` if it is only needed
  there.

After changing the packaging, verify with:

```sh
npm --workspace @grids/firebase-functions run build
npm --workspace @grids/firebase-functions run lint
npm --workspace @grids/firebase-functions run type-check
```

For targeted validation, import the generated `lib` module that failed in the
deploy log from inside `apps/firebase-functions` and confirm it no longer throws
`ERR_MODULE_NOT_FOUND`.
