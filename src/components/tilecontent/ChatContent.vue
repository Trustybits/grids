<template>
  <div class="chat-tile">
    <div class="chat-messages" ref="messagesContainer" @mousedown.stop>
      <div v-if="!sortedMessages.length" class="chat-empty">
        <p class="chat-empty-title">Start the conversation</p>
        <p class="chat-empty-subtitle">Send a message below.</p>
      </div>
      <div
        v-for="message in sortedMessages"
        :key="message.id"
        class="chat-message"
        :class="{ 'is-owner': isOwnerMessage(message), 'is-other': !isOwnerMessage(message) }"
      >
        <div class="chat-bubble">
          {{ message.text }}
        </div>
      </div>
    </div>

    <form class="chat-composer" @submit.prevent="sendMessage" @mousedown.stop>
      <textarea
        ref="inputRef"
        v-model="draftMessage"
        class="chat-input"
        rows="1"
        :placeholder="composerPlaceholder"
        :disabled="!canSend"
        @focus="setEditing(true)"
        @blur="setEditing(false)"
        @keydown="handleKeydown"
      ></textarea>
      <button
        class="chat-send"
        type="submit"
        :disabled="!canSend || !draftMessage.trim()"
      >
        Send
      </button>
    </form>
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  type CollectionReference,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase";
import { useLayoutStore } from "@/stores/layout";
import type { ChatContent, ChatMessage } from "@/types/TileContent";

export default defineComponent({
  props: {
    content: {
      type: Object as () => ChatContent,
      required: true,
    },
    tileId: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const auth = getAuth();

    const draftMessage = ref("");
    const isEditing = ref(false);
    const inputRef = ref<HTMLTextAreaElement | null>(null);
    const messagesContainer = ref<HTMLDivElement | null>(null);
    const messages = ref<ChatMessage[]>([]);

    const layoutId = computed(() => layoutStore.currentLayout?.id ?? "");
    const messagesCollection = computed<CollectionReference | null>(() => {
      if (!layoutId.value || !props.tileId) return null;
      return collection(db, "layouts", layoutId.value, "tiles", props.tileId, "messages");
    });

    const sortedMessages = computed(() =>
      [...messages.value].sort((a, b) => a.createdAt - b.createdAt)
    );

    const ownerId = computed(() => layoutStore.currentLayout?.userId || "");
    const isOwner = computed(() => layoutStore.isOwner);
    const canSend = computed(() => !!layoutId.value && !!props.tileId);
    const composerPlaceholder = computed(() =>
      isOwner.value ? "Write a message..." : "Message the owner..."
    );

    const isOwnerMessage = (message: ChatMessage) => {
      if (!ownerId.value) return false;
      if (!message.authorId) return true;
      return message.authorId === ownerId.value;
    };

    const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
      const container = messagesContainer.value;
      if (!container) return;
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    };

    const normalizeCreatedAt = (value: unknown) => {
      if (typeof value === "number") return value;
      if (value && typeof value === "object" && "toMillis" in value) {
        return (value as { toMillis: () => number }).toMillis();
      }
      return Date.now();
    };

    let unsubscribe: Unsubscribe | null = null;

    const subscribeToMessages = (collectionRef: CollectionReference | null) => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      if (!collectionRef) {
        messages.value = [];
        return;
      }

      const messagesQuery = query(collectionRef, orderBy("createdAt", "asc"));
      unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          messages.value = snapshot.docs
            .map((doc) => {
              const data = doc.data() as Record<string, unknown>;
              const text = typeof data.text === "string" ? data.text : "";
              if (!text) return null;
              return {
                id: doc.id,
                text,
                createdAt: normalizeCreatedAt(data.createdAt),
                authorId: typeof data.authorId === "string" ? data.authorId : undefined,
              } as ChatMessage;
            })
            .filter((message): message is ChatMessage => !!message);
        },
        (error) => {
          console.error("Failed to subscribe to chat messages:", error);
        }
      );
    };

    const sendMessage = async () => {
      if (!canSend.value) return;
      const text = draftMessage.value.trim();
      if (!text) return;

      const collectionRef = messagesCollection.value;
      if (!collectionRef) return;

      draftMessage.value = "";
      try {
        await addDoc(collectionRef, {
          text,
          createdAt: Date.now(),
          authorId: auth.currentUser?.uid ?? "visitor",
        });
      } catch (error) {
        console.error("Failed to send chat message:", error);
      }

      await nextTick();
      scrollToBottom("smooth");
      inputRef.value?.focus();
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (!canSend.value) return;
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendMessage();
      }
    };

    const setEditing = (nextValue: boolean) => {
      if (!canSend.value) {
        isEditing.value = false;
        return;
      }
      isEditing.value = nextValue;
    };

    const onShortClick = () => {
      if (!canSend.value) return;
      isEditing.value = true;
      nextTick(() => inputRef.value?.focus());
    };

    const onExitClick = () => {
      isEditing.value = false;
      inputRef.value?.blur();
    };

    const onResize = () => {
      nextTick(() => scrollToBottom("auto"));
    };

    onMounted(() => {
      nextTick(() => scrollToBottom("auto"));
    });

    watch(
      () => messages.value.length,
      async () => {
        await nextTick();
        scrollToBottom("smooth");
      }
    );

    watch(messagesCollection, (collectionRef) => {
      subscribeToMessages(collectionRef);
    }, { immediate: true });

    onUnmounted(() => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    });

    return {
      draftMessage,
      inputRef,
      messagesContainer,
      sortedMessages,
      isOwnerMessage,
      canSend,
      composerPlaceholder,
      sendMessage,
      handleKeydown,
      setEditing,
      isEditing,
      onShortClick,
      onExitClick,
      onResize,
    };
  },
});
</script>

<style scoped>
.chat-tile {
  height: 100%;
  width: 100%;
  padding: var(--tile-padding);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.chat-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
  scroll-behavior: smooth;
  overscroll-behavior: contain;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  padding-right: 4px;
}

.chat-messages::-webkit-scrollbar {
  display: none;
}

.chat-empty {
  margin: auto 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--color-content-default);
}

.chat-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.chat-empty-subtitle {
  font-size: 12px;
  color: var(--color-content-default);
}

.chat-message {
  max-width: 82%;
  display: flex;
  flex-direction: column;
}

.chat-message.is-owner {
  align-self: flex-start;
  text-align: left;
}

.chat-message.is-other {
  align-self: flex-end;
  text-align: right;
}

.chat-bubble {
  padding: 8px 12px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.4;
  background: color-mix(in srgb, var(--color-text-primary) 10%, var(--color-tile-background));
  color: var(--color-text-primary);
  word-break: break-word;
  white-space: pre-wrap;
}

.chat-message.is-owner .chat-bubble {
  background: color-mix(in srgb, var(--color-tile-background) 92%, var(--color-text-primary) 8%);
  color: var(--color-text-primary);
  border-bottom-left-radius: 6px;
}

.chat-message.is-other .chat-bubble {
  border-bottom-right-radius: 6px;
  background-color: var(--color-text-primary);
  color: var(--color-tile-background)
}

.chat-composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--color-text-primary) 12%, transparent);
}

.chat-input {
  flex: 1;
  min-height: 36px;
  max-height: 120px;
  resize: none;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  background: color-mix(in srgb, var(--color-tile-background) 92%, var(--color-text-primary) 8%);
  color: var(--color-text-primary);
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.3;
  font-family: "Inter", sans-serif;
}

.chat-input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent);
}

.chat-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.chat-send {
  border: none;
  border-radius: 12px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-text-primary);
  color: var(--color-tile-background);
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out),
    transform var(--duration-fast) var(--easing-ease-out);
}

.chat-send:hover {
  transform: translateY(-1px);
}

.chat-send:disabled {
  cursor: not-allowed;
  opacity: 0.4;
  transform: none;
}
</style>
