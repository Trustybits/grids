<template>
  <div class="chat-tile">
    <div
      class="chat-messages"
      ref="messagesContainer"
      @mousedown="onContainerMousedown"
      @scroll="handleScroll"
    >
      <!-- Fade indicator at top when there's more content above -->
      <div v-if="showTopFade" class="top-fade-indicator"></div>
      <!-- Spacer to push messages to bottom when there are few messages -->
      <div class="messages-spacer"></div>
      <div v-if="!sortedMessages.length" class="chat-empty">
        <p class="chat-empty-title">Start the conversation</p>
        <p class="chat-empty-subtitle">Send a message below.</p>
      </div>
      <template v-for="(message, index) in sortedMessages" :key="message.id">
        <!-- Date separator: show when date changes from previous message -->
        <div
          v-if="shouldShowDateSeparator(message, index)"
          class="date-separator"
        >
          <span class="date-separator-text">{{
            formatDateSeparator(message.createdAt)
          }}</span>
        </div>
        <div
          class="chat-message"
          :class="{
            'is-owner': isOwnerMessage(message),
            'is-other': !isOwnerMessage(message),
          }"
        >
          <div class="chat-bubble-wrapper">
            <button
              v-if="isOwner"
              class="chat-delete-btn"
              @click="deleteMessage(message.id)"
              @mousedown.stop
            >
              <CloseIcon />
            </button>
            <div class="chat-bubble">
              {{ message.text }}
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Scroll to bottom button: appears when user has scrolled up -->
    <transition name="scroll-button">
      <button
        v-if="showScrollButton"
        class="scroll-to-bottom"
        @click="scrollToBottom('smooth')"
        @mousedown.stop
        title="Jump to latest messages"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 4L12 20M12 20L6 14M12 20L18 14"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </transition>

    <form
      class="chat-composer"
      @submit.prevent="sendMessage"
      @mousedown="onContainerMousedown"
    >
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
        <SendIcon />
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
import SendIcon from "@/components/icons/SendIcon.vue";
import CloseIcon from "@/components/icons/actionbar/CloseIcon.vue";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { useLayoutStore } from "@/stores/layout";
import type { ChatContent, ChatMessage } from "@/types/TileContent";

export default defineComponent({
  components: {
    SendIcon,
    CloseIcon,
  },
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
    const chatService = getServiceFactory().getChatService();

    const draftMessage = ref("");
    const isEditing = ref(false);
    const inputRef = ref<HTMLTextAreaElement | null>(null);
    const messagesContainer = ref<HTMLDivElement | null>(null);
    const messages = ref<ChatMessage[]>([]);
    const showScrollButton = ref(false);
    const userHasScrolled = ref(false);
    const showTopFade = ref(false);

    const layoutId = computed(() => layoutStore.currentLayout?.id ?? "");

    const sortedMessages = computed(() =>
      [...messages.value].sort((a, b) => a.createdAt - b.createdAt),
    );

    const ownerId = computed(() => layoutStore.currentLayout?.userId || "");
    const isOwner = computed(() => layoutStore.isOwner);
    const canSend = computed(() => !!layoutId.value && !!props.tileId);
    const composerPlaceholder = computed(() =>
      isOwner.value ? "Write a message.." : "Message the owner..",
    );

    const isOwnerMessage = (message: ChatMessage) => {
      if (!ownerId.value) return false;
      if (!message.authorId) return true;
      return message.authorId === ownerId.value;
    };

    // Check if we should show a date separator before this message
    const shouldShowDateSeparator = (message: ChatMessage, index: number) => {
      if (index === 0) return true; // Always show date for first message
      const prevMessage = sortedMessages.value[index - 1];
      if (!prevMessage) return true;

      // Compare dates (ignoring time)
      const currentDate = new Date(message.createdAt).toDateString();
      const prevDate = new Date(prevMessage.createdAt).toDateString();
      return currentDate !== prevDate;
    };

    // Format date separator text
    const formatDateSeparator = (timestamp: number) => {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const dateString = date.toDateString();
      const todayString = today.toDateString();
      const yesterdayString = yesterday.toDateString();

      if (dateString === todayString) return "Today";
      if (dateString === yesterdayString) return "Yesterday";

      // Format as "Mon, Jan 15" for other dates
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    };

    // Handle scroll events to show/hide scroll-to-bottom button and top fade
    const handleScroll = () => {
      const container = messagesContainer.value;
      if (!container) return;

      userHasScrolled.value = true;

      // Check if user is near the bottom (within 100px)
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        100;
      showScrollButton.value = !isNearBottom;

      // Show top fade indicator if user has scrolled down from the top (more than 20px)
      showTopFade.value = container.scrollTop > 20;
    };

    const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
      const container = messagesContainer.value;
      if (!container) return;
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
      // Hide scroll button after scrolling to bottom
      if (behavior === "smooth") {
        showScrollButton.value = false;
      }
    };

    let unsubscribe: (() => void) | null = null;

    const subscribe = () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      if (!layoutId.value || !props.tileId) {
        messages.value = [];
        return;
      }

      unsubscribe = chatService.subscribeToMessages(
        layoutId.value,
        props.tileId,
        (msgs) => {
          messages.value = msgs;
        },
        (error) => {
          console.error("Failed to subscribe to chat messages:", error);
        },
      );
    };

    const deleteMessage = async (messageId: string) => {
      if (!isOwner.value || !layoutId.value || !props.tileId) return;
      try {
        await chatService.deleteMessage(layoutId.value, props.tileId, messageId);
      } catch (error) {
        console.error("Failed to delete chat message:", error);
      }
    };

    const sendMessage = async () => {
      if (!canSend.value) return;
      const text = draftMessage.value.trim();
      if (!text) return;
      if (!layoutId.value || !props.tileId) return;

      draftMessage.value = "";
      try {
        await chatService.sendMessage(layoutId.value, props.tileId, text);
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

    const onShortClick = (event?: MouseEvent) => {
      if (!canSend.value) return;
      // Only focus the input if the click landed on the textarea itself
      if (
        event &&
        inputRef.value &&
        inputRef.value.contains(event.target as Node)
      ) {
        isEditing.value = true;
        nextTick(() => inputRef.value?.focus());
      }
    };

    const onExitClick = () => {
      isEditing.value = false;
      inputRef.value?.blur();
    };

    const onContainerMousedown = (event: MouseEvent) => {
      // Only stop propagation when the chat input is focused (editing mode).
      // Otherwise let the event bubble so GridTile can detect long-press.
      if (isEditing.value) {
        event.stopPropagation();
      }
    };

    const onResize = () => {
      nextTick(() => scrollToBottom("auto"));
    };

    onMounted(() => {
      nextTick(() => scrollToBottom("auto"));
    });

    watch(
      () => messages.value.length,
      async (newLength, oldLength) => {
        await nextTick();
        // Only auto-scroll if user hasn't manually scrolled up, or if it's the initial load
        if (!userHasScrolled.value || oldLength === 0) {
          scrollToBottom("smooth");
        }
      },
    );

    watch(
      [layoutId, () => props.tileId],
      () => {
        subscribe();
      },
      { immediate: true },
    );

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
      isOwner,
      isOwnerMessage,
      canSend,
      composerPlaceholder,
      sendMessage,
      deleteMessage,
      handleKeydown,
      setEditing,
      isEditing,
      onShortClick,
      onExitClick,
      onResize,
      onContainerMousedown,
      showScrollButton,
      showTopFade,
      handleScroll,
      scrollToBottom,
      shouldShowDateSeparator,
      formatDateSeparator,
    };
  },
});
</script>

<style scoped>
.chat-tile {
  height: 100%;
  width: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.chat-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 0 0 0 0;
  gap: var(--spacing-sm);
  min-height: 0;
  overflow-y: auto;
  overflow-anchor: none;
  scroll-behavior: smooth;
  overscroll-behavior: contain;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  position: relative;
}

.chat-messages::-webkit-scrollbar {
  display: none;
}

/* Spacer to push messages to bottom when there are few messages */
.messages-spacer {
  flex: 1;
  min-height: 0;
}

/* Top fade indicator to show there's more content above */
.top-fade-indicator {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  flex-shrink: 0;
  background: linear-gradient(
    to bottom,
    var(--color-tile-background) 0%,
    color-mix(in srgb, var(--color-tile-background) 50%, transparent) 50%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 5;
  margin-bottom: -40px;
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

.chat-bubble-wrapper {
  position: relative;
}

.chat-delete-btn {
  position: absolute;
  top: -8px;
  display: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: 50%;
  background-color: var(--color-actionbar-background);
  color: var(--color-content-high);
  cursor: pointer;
  z-index: 2;
  transition:
    transform var(--duration-fast) var(--easing-ease-out),
    background-color var(--duration-fast) var(--easing-ease-in-out),
    border-color var(--duration-fast) var(--easing-ease-in-out),
    color var(--duration-fast) var(--easing-ease-in-out);
}

.chat-delete-btn:deep(svg) {
  width: 10px;
  height: 10px;
}

.chat-delete-btn:hover {
  transform: scale(1.15);
  background-color: #ff3737;
  border-color: #ff3737;
  color: var(--color-light-100);
}

.chat-message.is-owner .chat-delete-btn {
  right: -8px;
}

.chat-message.is-other .chat-delete-btn {
  left: -8px;
}

.chat-bubble-wrapper:hover .chat-delete-btn {
  display: flex;
}

.chat-bubble {
  padding: 8px 12px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.4;
  background: color-mix(
    in srgb,
    var(--color-text-primary) 10%,
    var(--color-tile-background)
  );
  color: var(--color-text-primary);
  word-break: break-word;
  white-space: pre-wrap;
}

.chat-message.is-owner .chat-bubble {
  background: color-mix(
    in srgb,
    var(--color-tile-background) 92%,
    var(--color-text-primary) 8%
  );
  color: var(--color-text-primary);
  border-bottom-left-radius: 6px;
}

.chat-message.is-other .chat-bubble {
  border-bottom-right-radius: 6px;
  background-color: var(--color-text-primary);
  color: var(--color-tile-background);
}

.chat-composer {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.chat-input {
  flex: 1;
  min-height: 36px;
  max-height: 120px;
  resize: none;
  border-radius: 12px;
  border: 1px solid
    color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  background: color-mix(
    in srgb,
    var(--color-tile-background) 92%,
    var(--color-text-primary) 8%
  );
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
  border-radius: 50%;
  padding: var(--spacing-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-content-low);
  color: var(--color-text-primary);
  cursor: pointer;
  pointer-events: auto;
  touch-action: manipulation;
  transition:
    opacity var(--duration-fast) var(--easing-ease-in-out),
    transform var(--duration-fast) var(--easing-ease-out);
}

.chat-send:hover {
  /* transform: translateY(-1px); */
  background-color: var(--color-content-default);
}

.chat-send:disabled {
  background-color: transparent;
  cursor: not-allowed;
  opacity: 0.3;
  transform: none;
}

/* Date separator */
.date-separator {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0;
  text-align: center;
}

.date-separator::before,
.date-separator::after {
  content: "";
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--color-text-primary) 15%, transparent);
}

.date-separator-text {
  font-size: 11px;
  font-weight: 600;
  color: color-mix(in srgb, var(--color-text-primary) 50%, transparent);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

/* Scroll to bottom button */
.scroll-to-bottom {
  position: absolute;
  bottom: 80px;
  left: 50%;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  padding: 4px;
  background: var(--color-base-34);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform var(--duration-fast) var(--easing-ease-out),
    background var(--duration-fast) var(--easing-ease-out),
    box-shadow var(--duration-fast) var(--easing-ease-out);
  z-index: 10;
  transform: translateX(-50%);
}

.scroll-to-bottom:hover {
  background: var(--color-content-default);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: translateX(-50%) translateY(-2px);
}

.scroll-to-bottom:active {
  transform: translateX(-50%) translateY(0);
}

/* Scroll button transitions */
.scroll-button-enter-active,
.scroll-button-leave-active {
  transition: opacity var(--duration-normal) var(--easing-ease-in-out);
}

.scroll-button-enter-from,
.scroll-button-leave-to {
  opacity: 0;
}

.scroll-button-enter-to,
.scroll-button-leave-from {
  opacity: 1;
}
</style>
