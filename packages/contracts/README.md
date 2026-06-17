# @grids/contracts

Shared public interfaces and domain types for Grids.

This package defines the boundary between public app code and runtime implementations. It includes DAO interfaces, auth provider interfaces, and domain types shared across packages.

Start here when adding or changing a data model that crosses workspace boundaries.

## Common Commands

Run these from the repository root:

```bash
npm --workspace @grids/contracts run build
npm --workspace @grids/contracts run type-check
npm --workspace @grids/contracts run lint
```

See [production runtime boundary](../../docs/architecture/production-runtime-boundary.md), [data and service layer](../../docs/architecture/data-and-service-layer.md), and [npm scripts](../../docs/architecture/npm-scripts.md).
