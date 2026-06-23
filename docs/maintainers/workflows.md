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

