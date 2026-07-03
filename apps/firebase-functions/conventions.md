## Conventions for Cloud Functions

These conventions apply to all folders and files within the `src/` folder.

**Folder conventions:**

- Folder names should describe the overall area of responsibility for the contained files
- Folders may contain Cloud Function files, utility files, and secrets files whose responsibilities fall under the folder's name
- Cloud Function files generally inform where their depended upon utility and secret files end up
- Utility files, where appropriate, may be dependened upon by files outside of their parent folder. Example: several other files depend upon `utils_writeServerEvent.ts`, which lives within the analytics folder, such as `onTrigger_userLogin.ts`. This is appropriate because `utils_writeServerEvent.ts` performs an analytics-related function, and other Cloud Functions make use of that functionality.
- Secrets files should only be depended upon by files within their parent folder

**Each file that contains a deployed Cloud Function follows these naming rules:**

- Only 1 (one) Cloud Function per file. Files may contain multiple helper functions for the Cloud Function, but only 1 exported and deployed Cloud Function may be present per file
- Prepend with `onCall` when functions are of the Callable type (use https.onCall specifically). Example: `onCall_claimSlug.ts`
- Prepend with `onRequest` when functions are of the HTTP Request type (use https.onRequest specifically). Example: `onRequest_trackGridViewEndBeacon.ts`
- Prepend with `onTrigger` when functions are of the Background Trigger type (uses any kind of Firebase invocation configuration). Example: `onTrigger_userLogin.ts`
- Prepend with `onSchedule` when functions are of the Scheduled type (use `functions.pubsub.schedule(...)` / `onRun`). Example: `onSchedule_sweepOrphanedSubcollections.ts`
- Following the prepend, the name should describe what the function does

**Other types of files follow these naming rules:**

- Prepend with `utils` when the file is a utility file and does _not_ contain a deployed Cloud Function. Utils files may contain one or more utils functions, and/or contain one or more const variable definitions. Example: `utils_writeServerEvent.ts`
- Files containing secrets should be named `secrets.ts` and should _only_ contain secrets
- Test files should be named following this pattern: nameOfFileUnderTest.test.ts. Example: `onTrigger_analyticsEventCreated.test.ts`

**Exemptions:**

- `index.ts` and `admin.ts` are exemptions from the above rules due to their singular nature.

**AGENTS reading this file:**

- Always follow the conventions outlined in this document, unless explicitly instructed to do otherwise by the user. You should never assume that the user is instructing you to do otherwise, in the event of ambiguity follow these conventions. In the event that you are explicitly instructed to do otherwise, confirm with the user that they are intentionally disregarding the conventions before moving forward.
