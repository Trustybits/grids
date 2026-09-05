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
            'is-mine': isMyMessage(message),
            'is-theirs': !isMyMessage(message),
          }"
        >
          <FloatingTooltip
            :text="canEditMessage(message) ? 'Edit message' : null"
          >
            <div
              class="chat-bubble-wrapper"
              :class="{
                'is-editable': canEditMessage(message),
                'is-editing': editingMessageId === message.id,
              }"
              @mousedown="onBubbleMousedown"
              @click="onBubbleClick($event, message)"
            >
              <button
                v-if="canDeleteMessage(message)"
                class="chat-delete-btn"
                @click.stop="deleteMessage(message)"
                @mousedown.stop
              >
                <CloseIcon />
              </button>
              <div class="chat-bubble">
                <span class="chat-bubble-text">{{ message.text }}</span>
              </div>
            </div>
          </FloatingTooltip>
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
        <ArrowDownIcon :size="16" />
      </button>
    </transition>

    <div v-if="editingMessageId" class="chat-editing-banner">
      <span>Editing message</span>
      <button
        class="chat-editing-cancel"
        @click="cancelEditing"
        @mousedown.stop
      >
        Cancel
      </button>
    </div>

    <form
      class="chat-composer"
      @submit.prevent="sendMessage"
      @mousedown="onContainerMousedown"
    >
      <textarea
        ref="inputRef"
        v-model="draftMessage"
        class="chat-input scrollable-thin"
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
  proxyRefs,
  computed,
  defineComponent,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import SendIcon from "@/components/icons/SendIcon.vue";
import ArrowDownIcon from "@/components/icons/ArrowDownIcon.vue";
import CloseIcon from "@/components/icons/tile-actionbar/CloseIcon.vue";
import FloatingTooltip from "@/components/ui-elements/FloatingTooltip.vue";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import type { ChatContent, ChatMessage } from "@grids/contracts/types";

export default defineComponent({
  components: {
    SendIcon,
    CloseIcon,
    FloatingTooltip,
    ArrowDownIcon,
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
    const gridView = proxyRefs(useGridViewContext());
    const chatService = getServiceFactory().getChatService();

    const draftMessage = ref("");
    const isEditing = ref(false);
    const inputRef = ref<HTMLTextAreaElement | null>(null);
    const messagesContainer = ref<HTMLDivElement | null>(null);
    const messages = ref<ChatMessage[]>([]);
    const showScrollButton = ref(false);
    const showTopFade = ref(false);

    const editingMessageId = ref<string | null>(null);
    const savedDraft = ref("");
    const sessionMessageIds = ref(new Set<string>());

    const sessionStorageKey = computed(
      () => `chat-session-msgs:${gridId.value}:${props.tileId}`,
    );

    const loadSessionMessageIds = () => {
      try {
        const stored = sessionStorage.getItem(sessionStorageKey.value);
        if (stored) {
          const ids: string[] = JSON.parse(stored);
          const updated = new Set(sessionMessageIds.value);
          ids.forEach((id) => updated.add(id));
          sessionMessageIds.value = updated;
        }
      } catch {
        // ignore
      }
    };

    const persistSessionMessageId = (id: string) => {
      const updated = new Set(sessionMessageIds.value);
      updated.add(id);
      sessionMessageIds.value = updated;
      try {
        sessionStorage.setItem(
          sessionStorageKey.value,
          JSON.stringify([...sessionMessageIds.value]),
        );
      } catch {
        // ignore
      }
    };

    let dragStartPos: { x: number; y: number } | null = null;
    const DRAG_THRESHOLD = 5;

    const gridId = computed(() => gridView.grid?.id ?? "");

    const sortedMessages = computed(() =>
      [...messages.value].sort((a, b) => a.createdAt - b.createdAt),
    );

    const ownerId = computed(() => gridView.grid?.userId || "");
    const isOwner = computed(() => gridView.isOwner);
    const canSend = computed(() => !!gridId.value && !!props.tileId);
    const composerPlaceholder = computed(() =>
      isOwner.value ? "Write a message.." : "Message the owner..",
    );
    const createMeasurementContext = () => {
      if (typeof document === "undefined") return null;
      try {
        return document.createElement("canvas").getContext("2d");
      } catch {
        return null;
      }
    };
    const measurementContext = createMeasurementContext();
    let resizeFrame: number | null = null;

    const isOwnerMessage = (message: ChatMessage) => {
      if (!ownerId.value) return false;
      if (!message.authorId) return true;
      return message.authorId === ownerId.value;
    };

    const isMyMessage = (message: ChatMessage) => {
      if (isOwner.value) {
        return isOwnerMessage(message);
      }
      return !isOwnerMessage(message);
    };

    const canEditMessage = (message: ChatMessage) => {
      if (!isMyMessage(message)) return false;
      if (isOwner.value) return true;
      return sessionMessageIds.value.has(message.id);
    };

    const canDeleteMessage = (message: ChatMessage) => {
      if (isOwner.value) return true;
      if (!isMyMessage(message)) return false;
      return sessionMessageIds.value.has(message.id);
    };

    const onBubbleMousedown = (event: MouseEvent) => {
      dragStartPos = { x: event.clientX, y: event.clientY };
    };

    const onBubbleClick = (event: MouseEvent, message: ChatMessage) => {
      if (!canEditMessage(message)) return;
      if (dragStartPos) {
        const dx = event.clientX - dragStartPos.x;
        const dy = event.clientY - dragStartPos.y;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
          dragStartPos = null;
          return;
        }
      }
      dragStartPos = null;
      startEditing(message);
    };

    const startEditing = (message: ChatMessage) => {
      const updateDraft = !!editingMessageId.value;
      editingMessageId.value = message.id;
      savedDraft.value = updateDraft ? savedDraft.value : draftMessage.value;
      draftMessage.value = message.text;
      nextTick(() => inputRef.value?.focus());
    };

    const cancelEditing = () => {
      draftMessage.value = savedDraft.value;
      editingMessageId.value = null;
      savedDraft.value = "";
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

    const isNearBottom = () => {
      const container = messagesContainer.value;
      if (!container) return true;
      return (
        container.scrollHeight - container.scrollTop - container.clientHeight <
        100
      );
    };

    // Handle scroll events to show/hide scroll-to-bottom button and top fade
    const handleScroll = () => {
      const container = messagesContainer.value;
      if (!container) return;

      showScrollButton.value = !isNearBottom();

      // Show top fade indicator if user has scrolled down from the top (more than 20px)
      showTopFade.value = container.scrollTop > 20;
    };

    const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
      const container = messagesContainer.value;
      if (!container) return;
      const doScroll = () => {
        container.scrollTop = container.scrollHeight;
        showScrollButton.value = false;
      };
      if (behavior === "smooth") {
        container.scrollTo({ top: container.scrollHeight, behavior });
        setTimeout(() => container.scrollTo({ top: container.scrollHeight, behavior }), 50);
        setTimeout(() => container.scrollTo({ top: container.scrollHeight, behavior }), 150);
        showScrollButton.value = false;
      } else {
        doScroll();
        setTimeout(doScroll, 50);
        setTimeout(doScroll, 150);
      }
    };

    const getWrappedLineWidths = (
      text: string,
      maxWidth: number,
      context: CanvasRenderingContext2D,
    ) => {
      const measure = (value: string) => context.measureText(value).width;
      const paragraphs = text.split("\n");
      const widths: number[] = [];

      paragraphs.forEach((paragraph) => {
        const words = paragraph.trim().split(/\s+/).filter(Boolean);
        if (!words.length) {
          widths.push(0);
          return;
        }

        let line = "";
        words.forEach((word) => {
          const nextLine = line ? `${line} ${word}` : word;
          if (line && measure(nextLine) > maxWidth) {
            widths.push(measure(line));
            line = word;
            return;
          }
          line = nextLine;
        });

        widths.push(measure(line));
      });

      return widths;
    };

    const getTightContentWidth = (
      text: string,
      maxWidth: number,
      context: CanvasRenderingContext2D,
    ) => {
      const words = text.split(/\s+/).filter(Boolean);
      if (!words.length) return 0;

      const longestWordWidth = Math.max(
        ...words.map((word) => context.measureText(word).width),
      );
      const minWidth = Math.min(maxWidth, Math.max(1, longestWordWidth));
      const maxLineCount = getWrappedLineWidths(text, maxWidth, context).length;

      for (
        let width = Math.ceil(minWidth);
        width <= Math.ceil(maxWidth);
        width += 2
      ) {
        const lineWidths = getWrappedLineWidths(text, width, context);
        if (lineWidths.length <= maxLineCount) {
          return Math.min(maxWidth, Math.ceil(width + 1));
        }
      }

      return maxWidth;
    };

    const resizeVisitorBubbles = () => {
      const container = messagesContainer.value;
      if (!container || !measurementContext) return;

      const bubbles = container.querySelectorAll<HTMLElement>(
        ".chat-message.is-other .chat-bubble",
      );

      bubbles.forEach((bubble) => {
        const message = bubble.closest<HTMLElement>(".chat-message");
        if (!message) return;

        bubble.style.width = "";

        const style = window.getComputedStyle(bubble);
        measurementContext.font = style.font;

        const paddingX =
          parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const rowWidth = message.clientWidth;
        const maxBubbleWidth = Math.floor(rowWidth * 0.82);
        const maxContentWidth = Math.max(1, maxBubbleWidth - paddingX);
        const text = bubble.textContent?.trim() ?? "";
        const contentWidth = getTightContentWidth(
          text,
          maxContentWidth,
          measurementContext,
        );

        bubble.style.width = `${Math.ceil(contentWidth + paddingX)}px`;
      });
    };

    const scheduleVisitorBubbleResize = () => {
      if (typeof window === "undefined") return;
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
      }
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        resizeVisitorBubbles();
      });
    };

    let unsubscribe: (() => void) | null = null;

    const subscribe = () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      if (!gridId.value || !props.tileId) {
        messages.value = [];
        return;
      }

      unsubscribe = chatService.subscribeToMessages(
        gridId.value,
        props.tileId,
        (msgs) => {
          messages.value = msgs;
        },
        (error) => {
          console.error("Failed to subscribe to chat messages:", error);
        },
      );
    };

    const deleteMessage = async (message: ChatMessage) => {
      if (!canDeleteMessage(message) || !gridId.value || !props.tileId) {
        return;
      }
      try {
        await chatService.deleteMessage(
          gridId.value,
          props.tileId,
          message.id,
        );
      } catch (error) {
        console.error("Failed to delete chat message:", error);
      }
    };

    const sendMessage = async () => {
      if (!canSend.value) return;
      const text = draftMessage.value.trim();
      if (!text) return;
      if (!gridId.value || !props.tileId) return;

      const messageIdToEdit = editingMessageId.value;
      draftMessage.value = messageIdToEdit ? savedDraft.value : "";
      editingMessageId.value = null;
      savedDraft.value = "";

      try {
        if (messageIdToEdit) {
          await chatService.editMessage(
            gridId.value,
            props.tileId,
            messageIdToEdit,
            text,
          );
        } else {
          const newId = await chatService.sendMessage(
            gridId.value,
            props.tileId,
            text,
          );
          persistSessionMessageId(newId);
          await nextTick();
          scrollToBottom("smooth");
        }
      } catch (error) {
        console.error("Failed to send chat message:", error);
      }

      
      inputRef.value?.focus();
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (!canSend.value) return;
      if (event.key === "Escape" && editingMessageId.value) {
        event.preventDefault();
        cancelEditing();
        return;
      }
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

    // Keep the newest messages in view through a resize only when the user was
    // already reading them; a reader scrolled up into history keeps their place.
    const onResize = () => {
      const wasNearBottom = isNearBottom();
      nextTick(() => {
        scheduleVisitorBubbleResize();
        if (wasNearBottom) scrollToBottom("auto");
      });
    };

    onMounted(() => {
      loadSessionMessageIds();
      nextTick(() => {
        scheduleVisitorBubbleResize();
        scrollToBottom("auto");
      });
    });

    watch(
      () => messages.value.length,
      async (newLength, oldLength) => {
        const wasNearBottom = isNearBottom();
        await nextTick();
        scheduleVisitorBubbleResize();
        if (oldLength === 0 || oldLength === undefined) {
          scrollToBottom("auto");
        } else if (wasNearBottom) {
          scrollToBottom("smooth");
        }
      },
    );

    watch(
      () =>
        sortedMessages.value
          .map((message) => `${message.id}:${message.text}`)
          .join("\n"),
      async () => {
        await nextTick();
        scheduleVisitorBubbleResize();
      },
    );

    watch(
      [gridId, () => props.tileId],
      () => {
        subscribe();
      },
      { immediate: true },
    );

    onUnmounted(() => {
      if (resizeFrame !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = null;
      }
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
      isMyMessage,
      canEditMessage,
      canDeleteMessage,
      canSend,
      composerPlaceholder,
      sendMessage,
      deleteMessage,
      startEditing,
      cancelEditing,
      editingMessageId,
      onBubbleMousedown,
      onBubbleClick,
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
  margin: 0 -10px;
  padding: 0 10px;
  /* Deliberately `auto`, not `contain`. `contain` blocks scroll chaining to the
     page, so once this list has nothing left to scroll — few messages, or
     already at an edge — the browser finds no scroll target and never claims
     the gesture. Without that claim it fires no `pointercancel`, which is the
     only signal that makes Griddle abandon a pending tile drag, so a swipe
     meant to scroll the page picks the tile up instead. Chaining lets the page
     take over at the list's limits and Griddle backs off.
     Interim: the underlying cause is drag arming on a movement threshold — see
     Phase 8 in notes/mobile-2-early-access-plan.md. */
  overscroll-behavior: auto;
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
  display: flex;
  width: 100%;
}

.chat-message.is-mine {
  justify-content: flex-end;
}

.chat-message.is-theirs {
  justify-content: flex-start;
}

.chat-bubble-wrapper {
  position: relative;
  display: inline-flex;
  max-width: 82%;
}

.chat-message.is-other.is-mine .chat-bubble-wrapper {
  justify-content: flex-end;
}

.chat-delete-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  display: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: 4px;
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


.chat-bubble-wrapper:hover .chat-delete-btn {
  display: flex;
}

.chat-bubble {
  box-sizing: border-box;
  width: fit-content;
  max-width: 100%;
  padding: 8px 12px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.4;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}

.chat-bubble-text {
  display: block;
}

.chat-message.is-mine .chat-bubble {
  color: var(--color-tile-background);
  background: var(--color-text-primary);
}

.chat-message.is-theirs .chat-bubble {
  background: color-mix(
    in srgb,
    var(--color-text-primary) 10%,
    var(--color-tile-background)
  );
  color: var(--color-text-primary);
}

.chat-message.is-mine .chat-bubble {
  border-bottom-right-radius: 6px;
}

.chat-message.is-theirs .chat-bubble {
  border-bottom-left-radius: 6px;
}

.chat-bubble-wrapper.is-editable {
  cursor: pointer;
}

.chat-bubble-wrapper.is-editing .chat-bubble {
  outline: 1.5px solid var(--color-figma-purple);
  outline-offset: -1.5px;
}

.chat-editing-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: 11px;
  color: color-mix(in srgb, var(--color-text-primary) 60%, transparent);
  border-radius: 8px;
  background: color-mix(
    in srgb,
    var(--color-text-primary) 6%,
    var(--color-tile-background)
  );
}

.chat-editing-cancel {
  border: none;
  background: none;
  color: color-mix(in srgb, var(--color-text-primary) 60%, transparent);
  font-size: 11px;
  cursor: pointer;
  padding: 0 4px;
  text-decoration: underline;
}

.chat-editing-cancel:hover {
  color: var(--color-text-primary);
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
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-color: transparent transparent;
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
  scrollbar-color: var(--color-border) transparent;
}

.chat-input:hover {
  scrollbar-color: var(--color-border) transparent;
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
  border: 2px solid color-mix(in srgb, var(--color-text-primary) 20%, transparent);
  padding: 4px;
  background: color-mix(in srgb, var(--color-tile-background) 85%, var(--color-text-primary) 15%);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition:
    transform var(--duration-fast) var(--easing-ease-out),
    background var(--duration-fast) var(--easing-ease-out),
    border-color var(--duration-fast) var(--easing-ease-out),
    box-shadow var(--duration-fast) var(--easing-ease-out);
  z-index: 10;
  transform: translateX(-50%);
}

.scroll-to-bottom:hover {
  background: var(--color-text-primary);
  color: var(--color-tile-background);
  border-color: var(--color-base-76);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
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
