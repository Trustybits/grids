import { type Firestore, doc, getDoc } from "firebase/firestore";
import { type Functions, httpsCallable } from "firebase/functions";
import type {
  SlugAvailabilityResponse,
  SlugClaimResponse,
} from "@grids/contracts/types";
import type { SlugDao } from "@grids/contracts/dao";

const COLLECTION = "slugs";

export class FirestoreSlugDao implements SlugDao {
  private db: Firestore;
  private functions: Functions;

  public constructor(db: Firestore, functions: Functions) {
    this.db = db;
    this.functions = functions;
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
      this.functions,
      "checkSlugAvailability",
    );
    const result = await callable({ slug });
    return result.data;
  }

  public async claim(slug: string): Promise<SlugClaimResponse> {
    const callable = httpsCallable<{ slug: string }, SlugClaimResponse>(
      this.functions,
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
    >(this.functions, "updateDefaultGrid");
    const result = await callable({ gridId });
    return result.data;
  }
}
