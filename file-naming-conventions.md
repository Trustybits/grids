# Naming conventions for files generally within the repo

- File name convention should be consistent within their space - generally this means within the folder, but can mean
within the files area of responsibility
- Singular files (like index.ts) follow the conventions for that particular kind of file (like index.ts is lowercase)
- CSS files are kebab-case
- Files within the `functions/` folder (Cloud Functions) follow camelCase, as well as the conventions outlined
in `conventions.md`


**Main Application folders (currently the `src/` folder but may change pending other refactors)**

- The following folders should be in PascalCase:
  - `auth/`
  - `components/`
  - `dao/`
  - `data/`
  - `services/`
  - `types/`
  - `undo/`
  - `utils/`

- The following folders should be in camelCase:
  - `composables/` -> Additionally must begin with the word "use"
  - `infrastructure/`
  - `router/`
  - `stores/`
  - `test/`
  - `themes/`


- `styles/` should be in kebab-case, due to containing .scss and .css files

