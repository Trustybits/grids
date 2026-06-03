# Folder Definitions

## Overview

The goal of this document is to provide explanations of each folder found in the src/ of the `grids` app.
It will provide brief explanations of what each folder is, why it was named the way it was, and what purpose it
serves in the current code base. Folder names and structure are subject to change.

## Current Folder Structure (at the time of writing, ignoring \_\_tests\_\_)

```
src  
├── assets  
│   └── images  
├── auth  
│   ├── firebase  
│   └── stubbed  
├── components  
│   ├── dashboard  
│   ├── icons  
│   │   ├── actionbar  
│   │   ├── appbar  
│   │   └── toolbar  
│   ├── modal  
│   ├── tilecontent  
│   └── tiptap  
├── composables  
├── dao  
│   ├── firestore  
│   │   └── factory  
│   ├── interfaces  
│   │   └── factory  
│   └── stubbed  
│       └── factory  
├── infrastructure  
├── router  
├── services  
│   ├── factory  
│   ├── interfaces  
│   └── mocks  
├── stores  
├── styles  
├── svgs  
│   └── icons  
├── test  
├── themes  
├── types  
├── undo  
└── utils  
```

## Definitions

**Assets:**

- Assets should contain static files that you want imported into the app. Using files from the assets folder is through an
`import` statement.
- Assets files are renamed with a hash code for cache-bustin during the build process, which is why they are used via`import`. 
If a relative URLis required for the static file, it should live in the root `public/` folder. Files in the `public/` folder 
are used with a relative URL, not an `import` statement, and are useful for things which require a stable URL (they are not 
renamed during the build process).

**Auth:**

- The `auth/` folder handles authentication for the app, providing a `AuthUser` to the rest of the application, which contains
the uid, email, displayName, and photoUrl. It does this through an `AuthProvider`, which hides the specific implementation.
- Currently, two implementations exist: the `firebase` implementation and the `stubbed` implementation. The `firebase` 
implementation is used in the actual application, and uses Firebase's auth services. The `stubbed` implementation can
be used for testing or provided to the open-source as a fake version of the auth system.
- Any other component or file that needs to use the auth system uses the `AuthProvider` provided by the AuthProviderSingleton,
meaning there is only 1 AuthProvider for the entire app, intialized in `main.ts` based on the VITE_USE_FIREBASE environment
variable.
- Switching to a new authentication system is as simple as creating an `AuthProvider` for that system and updating
`main.ts`.
- Look at the names, particularly with "Firestore". May need to be changed to "Firebase".

**Components:**

- Components are `.vue` files that contain a template, a script, and a style block. The `template` block is the markup
portion of the component, similar to HTML but with added Vue tags. The `script` block defines the reactive state and logic
of the component, and the `style` block defines CSS styles for the component. A component is primarly in charge of UI work,
and can come in several types. A "presentational" component is purely concerned with rendering UI, and have no business logic
within them. These are "dumb" components. A "container" component, or "smart" component, handles some logic and can talk
to services, stores, or auth. Generally speaking, a component should contain mostly wiring and not as much logic, 
complex or business logic should belong to composables or service methods, and shared state should be owned by a parent 
component or a Pinia store.
- The components folder should be structured into more well-defined subfolders (this is a change coming up with the renaming
of the files as well, worth updating once refactors are in place).
- Components should be related to UI - if the component is doing non-UI related work, it should not be a component
or the non-UI related work should be moved out of the component.
- Currently using more than one syntax for it - worth looking at and probably reconciling.

**Composables:**

- A composable is a plain function that uses Vue's reactivity features (`ref`, `computed`, `watch`, lifecycle hooks) and
returns reactive state or functions for a component to consume (components use composables).
- File names generally start with "use" (Similar to React hooks).
- Enables grouping code by concern (all code that handles a certain thing can live in a composable), and enables
sharing logic across components (composables can be consumed by multiple components).
- Composables can call other composables
- Business logic that does not need reactivity should not be put into a composable
- Calling a composable creates a new instance of that composable, enabling per-component state (but not app-wide state, that's
what a store is used for).

**Dao:**

- DAO stands for Data Access Object. This layer is in charge of accessing the database backing the app - no other layer
should call the database, ever.
- In this folder, the `interfaces/` subfolder define the contract - what a DAO is and what it provides to the app. The 
DaoFactorySingleton is initialized by `main.ts` and can be called to provide a DAO to whoever needs it
- The point of this is that the app does not need to know which database is being used, and the database implementation
can be easily swapped. Currently, `firestore` is the active implementation, and `stubbed` is a faked version.
- Maybe change the name of the folder from `firestore/` to `firebase/`, to be slightly more generalized.
- check the update() operation, type checking can leak here

**infrastructure:**

- This sets up external configurations (in this case, specifically firebase)
- Only imported by the FirestoreAuthProvider and FirestoreDaoFactory. If those are not given to the open source,
then this is unneeded as well
- This is the only place that configures and initializes firebase (good)
- This should be where other places that need set up and configuration of external clients goes (AI pointed out Mapbox,
Stripe, and Posthog - worth looking into)
- configuration only, not usage

**router:**

- Routes URL paths to UI components. Has pattern matching to determine which path pattern to use, enforces navigation
lifecycle (what happens before and after the navigation, like guards and posthog) and enables history (browser back and
forward)


**services:**

- A service is stateless and contains business logic. This means that a service does not track or need state within
itself, and it defines what the application does. Each service should have a clearly defined domain area, like "Layout" 
or "Users"
- Orchestrates between DAOs, translates between domain types (like a Layout) and the storage shape, executes
domain level operations (like cloning a layout), cross-cutting conerns (coordination between multiple DAOs or actions),
and is the API surface for higher layers. Components and composables don't call DAOs directly, they call services
which call the DAOs
- Has interfaces defining what methods are available on a service, fake services (mock), and the real service
implementations. All are accessed through the factory.
- Note, these are not reactive - they do not care or know that Vue is the frontend framework. Nor do they know
or care about what kind of database is in use.
- Change the interfaces from the "I" prefix, use a different naming convention ("I" is not common in the Typescript
world)

**stores:**

- First off, layout.ts is too big - need to break that out into smaller stores or separate concerns
- A store is a centralized, reactive container of shared application state, along with methods that mutate that state.
It uses Vue's reactivity primitives (like `ref`), is a singleton (all callers that ask for the store get the 
same instance), and the functions that change the state live with the state in the store.
- Currently is using 2 different store syntaxes - probably worth reconciling.
- These are meant for state shared across many components and needing to be kept in sync across many components,
not for state that is local to one component. 
- theme.ts mutates the DOM, likely better to use a composable that watches the store to reactively change

|                                    | Store                                       | Service                       | Composable                          |
| ---------------------------------- | ------------------------------------------- | ----------------------------- | ----------------------------------- |
| Holds reactive state?              | ✅ Yes, that's its job                      | ❌ No                         | ✅ Often                            |
| Singleton (one instance app-wide)? | ✅ Always                                   | ✅ Usually                    | ❌ Fresh per call by default        |
| Talks to DAOs / external APIs?     | ⚠️ Sometimes, but ideally via services       | ✅ Yes, that's its job        | ⚠️ Sometimes, often via services     |
| Called from Vue components?        | ✅ Yes                                      | ✅ Yes                        | ✅ Yes                              |
| Called from non-Vue code?          | ⚠️ Pinia needs setup                         | ✅ Yes, just functions        | ❌ Requires component context       |
| Has the concept of "actions"?      | ✅ Yes                                      | ✅ Methods                    | ✅ Returned functions               |
| Survives a navigation?             | ✅ Yes                                      | ✅ Yes                        | ⚠️ Tied to component lifetime        |

**styles:**

- Global styles for the app, loaded in main.ts 
- design tokens live here, as well as shared styles
- The `assets/` folder may be doing the same job as this one - worth looking into and perhaps consolidating. In particular,
the css files in `assets/`

**svgs:**

- holds svg source code, and is currently unused in the codebase.
- AI recommends either removing it entirely and using the system we currently have (SVG icons are built as Vue components
in the `components/` folder) or removing the vue-based icons and using a library to transform the SVG icons into Vue
components at compile time. Either way, something should be removed.

**themes:**

- A Typescript version of the `styles/themes.scss`, which is better for JavaScript and scripts to read and programmatically
manipulate, programmatically manipulating CSS is difficult.
- recommended is to consolidate, either by having the TS file be the source and the color CSS variables are written
into the html tag or body tag on boot; or the other way around (this pattern was described as less common).

**types:**

- Describes the types of the domain objects present in the app: what the app is about
- Depended upon by multiple layers and shared across many components and files, these are global things, not local
- It is the "language" of how layers speak to each other, menaing that objects that conform to these domain types are
passed across layers
- One file per concept
- types that are used by one file or only one layer should not live here - they should live next to or within that file
or layer
- take a look at TileChildComponent, this is likey better as a discriminated union or a set of separate interfaces

**undo:**

- A bounded subdomain - logic that is conceptually its own thing, but it's only used by 1 consumer
- It is a feature module, not a util. It has state and is not just a pure helper
- It is not reactive, it's just a plain class
- This is its own folder because it describes its single responsibility that does not fit well into other folders,
and it's reusable within the app - other things like tile studio could potentially make use of it
- it is also complex, error-prone, and wel-bounded, so it benefits from being in its own folder for the developer
and for testing

**utils:**

- should consist of pure, stateless helper functions that don't fit in any other folder's responsibilities
- Pure means that the same input produces the same output, it has no side effects like changing the app's state,
calling an API, or manipulating the DOM. The function parameters are the only data the function receives
- generally are small, repeated computations, centralizes domain-specific algorithms needed across multiple layers
and files, can provide pure constructors for domain objects (like a default layout)
- should not include anything that has or uses reactive state, should not call the network, should not have stateful logic
- some files should likely move, toolbarRegistry is probably the most conspicuous. It is a registry, not a util


## Other Notes

- Naming convention inconsistencies, like PascalCase and camelCase - figure out a convention for this
