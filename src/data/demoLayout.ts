// src/data/demoLayout.ts
//
// In-memory demo layout used by the marketing homepage embed. Constructed
// client-side so the landing page can render a real <Grid> without a
// Firestore read. Seeded with the same tiles a brand-new grid ships with —
// intentionally unchanged for now so the demo matches what visitors would
// see if they signed up. Tweak freely as the landing experience evolves.

import type { Layout } from "@/types/Layout";
import { createDefaultLayout } from "@/types/FirestoreMappers";
import { createStarterTiles } from "@/stores/layout";

export const DEMO_LAYOUT_ID = "__homepage_demo__";
export const DEMO_USER_ID = "__homepage_demo_user__";

export function createDemoLayout(): Layout {
  const layout = createDefaultLayout(DEMO_USER_ID, "Demo");
  layout.id = DEMO_LAYOUT_ID;
  layout.tiles = createStarterTiles();
  return layout;
}
