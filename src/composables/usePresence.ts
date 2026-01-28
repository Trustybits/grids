import { ref, onMounted, onUnmounted, computed } from 'vue';
import { 
  ref as dbRef, 
  set, 
  onValue, 
  onDisconnect,
  serverTimestamp,
  remove
} from 'firebase/database';
import { auth, rtdb } from '@/firebase';
import { type UserPresence, generateUserColor } from '@/types/Presence';

export function usePresence(gridId: string) {
  const activeUsers = ref<Map<string, UserPresence>>(new Map());
  const currentUserId = ref<string | null>(null);
  const currentUserColor = ref<string>('#4ECDC4');
  
  let unsubscribe: (() => void) | null = null;
  let cursorThrottleTimeout: number | null = null;

  // Get other users (excluding current user)
  const otherUsers = computed(() => {
    return Array.from(activeUsers.value.values()).filter(
      user => user.userId !== currentUserId.value
    );
  });

  // Get current user's display name or email
  const getUserName = (): string => {
    const user = auth.currentUser;
    if (!user) return 'Anonymous';
    return user.displayName || user.email?.split('@')[0] || 'User';
  };

  // Throttled cursor update - using RAF for smoother updates
  let pendingCursorUpdate: { x: number; y: number } | null = null;
  let lastCursorUpdate = 0;
  const CURSOR_THROTTLE_MS = 50; // 20 updates/sec max

  const updateCursorPosition = (x: number, y: number) => {
    const user = auth.currentUser;
    if (!user || !gridId) return;

    const now = Date.now();
    
    // Store the latest cursor position
    pendingCursorUpdate = { x, y };
    
    // If we recently updated, skip this one
    if (now - lastCursorUpdate < CURSOR_THROTTLE_MS) {
      return;
    }

    // Update immediately and mark timestamp
    lastCursorUpdate = now;
    const presenceRef = dbRef(rtdb, `presence/${gridId}/${user.uid}`);
    
    set(presenceRef, {
      userId: user.uid,
      userName: getUserName(),
      userColor: currentUserColor.value,
      cursor: { x, y },
      lastSeen: serverTimestamp(),
    }).catch(error => {
      console.error('Failed to update cursor position:', error);
    });
  };

  // Set user as active with automatic disconnect cleanup
  const setUserActive = async () => {
    const user = auth.currentUser;
    if (!user || !gridId) return;

    currentUserId.value = user.uid;
    currentUserColor.value = generateUserColor(user.uid);

    const presenceRef = dbRef(rtdb, `presence/${gridId}/${user.uid}`);
    
    try {
      // Set initial presence
      await set(presenceRef, {
        userId: user.uid,
        userName: getUserName(),
        userColor: currentUserColor.value,
        cursor: { x: 0, y: 0 },
        lastSeen: serverTimestamp(),
      });

      // **KEY FEATURE**: Auto-cleanup on disconnect
      // This is the magic of RTDB - automatic presence removal
      onDisconnect(presenceRef).remove();

    } catch (error) {
      console.error('Failed to set user active:', error);
    }
  };

  // Remove user presence manually (called on unmount as backup)
  const removeUserPresence = async () => {
    const user = auth.currentUser;
    if (!user || !gridId) return;

    const presenceRef = dbRef(rtdb, `presence/${gridId}/${user.uid}`);
    
    try {
      await remove(presenceRef);
    } catch (error) {
      console.error('Failed to remove user presence:', error);
    }
  };

  // Listen to presence updates from all users
  const subscribeToPresence = () => {
    if (!gridId) return;

    const presenceRef = dbRef(rtdb, `presence/${gridId}`);

    // RTDB onValue is simpler than Firestore onSnapshot
    unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      
      // Clear current users
      activeUsers.value.clear();

      if (data) {
        // Convert object to Map
        Object.entries(data).forEach(([userId, userData]: [string, any]) => {
          activeUsers.value.set(userId, {
            userId: userData.userId,
            userName: userData.userName,
            userColor: userData.userColor,
            cursor: userData.cursor,
            lastSeen: userData.lastSeen,
          });
        });
      }
    }, (error) => {
      console.error('Error listening to presence:', error);
    });
  };

  // Mouse move handler with throttling
  const handleMouseMove = (event: MouseEvent) => {
    updateCursorPosition(event.clientX, event.clientY);
  };

  // Initialize presence system
  const init = () => {
    if (!auth.currentUser) {
      console.warn('User not authenticated, skipping presence init');
      return;
    }

    setUserActive();
    subscribeToPresence();
    
    // Add mouse move listener
    document.addEventListener('mousemove', handleMouseMove);
  };

  // Cleanup presence system
  const cleanup = () => {
    if (cursorThrottleTimeout) {
      clearTimeout(cursorThrottleTimeout);
      cursorThrottleTimeout = null;
    }

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    document.removeEventListener('mousemove', handleMouseMove);
    removeUserPresence();
  };

  onMounted(() => {
    // Wait a bit for auth to initialize
    setTimeout(() => {
      if (auth.currentUser) {
        init();
      } else {
        console.warn('No authenticated user found');
      }
    }, 500);
  });

  onUnmounted(() => {
    cleanup();
  });

  return {
    activeUsers: computed(() => activeUsers.value),
    otherUsers,
    currentUserId: computed(() => currentUserId.value),
    currentUserColor: computed(() => currentUserColor.value),
  };
}
