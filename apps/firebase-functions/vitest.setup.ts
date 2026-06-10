// The Firebase Functions runtime (deployed and emulator) always injects the
// active project ID into the environment. Mirror that here so code that derives
// project-scoped values (see src/shared/utils_projectConfig.ts) behaves the
// same under test as it does at runtime.
process.env.GCLOUD_PROJECT ??= "demo-test-project";
