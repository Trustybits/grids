import posthog from 'posthog-js';

export function usePostHog() {
  /**
   * Track a custom event
   */
  const capture = (event: string, properties?: Record<string, any>) => {
    if (import.meta.env.VITE_POSTHOG_KEY) {
      posthog.capture(event, properties);
    }
  };

  /**
   * Identify a user
   */
  const identify = (userId: string, properties?: Record<string, any>) => {
    if (import.meta.env.VITE_POSTHOG_KEY) {
      posthog.identify(userId, properties);
    }
  };

  /**
   * Reset user identity (e.g., on logout)
   */
  const reset = () => {
    if (import.meta.env.VITE_POSTHOG_KEY) {
      posthog.reset();
    }
  };

  /**
   * Set user properties
   */
  const setPersonProperties = (properties: Record<string, any>) => {
    if (import.meta.env.VITE_POSTHOG_KEY) {
      posthog.setPersonProperties(properties);
    }
  };

  return {
    capture,
    identify,
    reset,
    setPersonProperties,
    posthog, // Direct access if needed
  };
}