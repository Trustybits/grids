# @grids/pro

Production-oriented Firebase runtime code for Grids.

This package lives in the public repository. It provides Firebase-backed runtime implementations when valid Firebase config is present. Contributors can use it with local Firebase emulators; the web app falls back to stubbed implementations when config is absent or invalid.

Do not commit private credentials or deploy-specific secrets to public docs or source.

See [production runtime](../../docs/maintainers/production-runtime.md) and [production runtime boundary](../../docs/architecture/production-runtime-boundary.md).
