import { type Firestore, doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import type {
  SlugAvailabilityResponse,
  SlugClaimResponse,
} from "@/types/UserProfile";
import type { SlugDao } from "../interfaces/SlugDao";

const COLLECTION = "slugs";

export class FirestoreSlugDao implements SlugDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public async getBySlug(
    slug: string,
  ): Promise<Record<string, unknown> | null> {
    const docRef = doc(this.db, COLLECTION, slug.toLowerCase());
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return snapshot.data() as Record<string, unknown>;
  }

  public async checkAvailability(
    slug: string,
  ): Promise<SlugAvailabilityResponse> {
    const callable = httpsCallable<{ slug: string }, SlugAvailabilityResponse>(
      functions,
      "checkSlugAvailability",
    );
    const result = await callable({ slug });
    return result.data;
  }

  public async claim(slug: string): Promise<SlugClaimResponse> {
    const callable = httpsCallable<{ slug: string }, SlugClaimResponse>(
      functions,
      "claimSlug",
    );
    const result = await callable({ slug });
    return result.data;
  }

  public async updateDefaultGrid(
    gridId: string | null,
  ): Promise<{ success: boolean }> {
    const callable = httpsCallable<
      { gridId: string | null },
      { success: boolean }
    >(functions, "updateDefaultGrid");
    const result = await callable({ gridId });
    return result.data;
  }
}
