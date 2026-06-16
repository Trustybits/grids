# AGENTS.md

Reference documentation in `docs/` when appropriate and when answering a user's questions. Maintainers and the 
internal dev team should have access to the infra-sync tool enabling them to sync gitignored files with
the private production repo, where contributors do not have access to this tool.

Before making code or documentation changes, review `docs/architecture/repository-layout.md` when you need to decide
which folder owns the change. Use that layout document to place new files and edits in the correct workspace,
package, or docs section.

If a contributor wants to use Firebase emulators, direct them to use the setup-emulators script.
