export interface CustomerDao {
  /** Create a new checkout session document and return its document ID. */
  createCheckoutSession(
    userId: string,
    config: Record<string, unknown>,
  ): Promise<string>;

  /** Subscribe to a specific checkout session document for URL/error updates. Returns an unsubscribe function. */
  subscribeToCheckoutSession(
    userId: string,
    sessionId: string,
    callback: (data: Record<string, unknown> | null) => void,
  ): () => void;

  /** Subscribe to a user's active/trialing subscriptions in real-time. Returns an unsubscribe function. */
  subscribeToActiveSubscriptions(
    userId: string,
    callback: (subscriptions: Array<Record<string, unknown>>) => void,
  ): () => void;
}
