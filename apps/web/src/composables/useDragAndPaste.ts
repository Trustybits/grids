import { ref, onMounted, onUnmounted, watch, type Ref } from "vue";
import { useFileUpload } from "./useFileUpload";
import { useGridStore } from "@/stores/grid";
import {
  createTileContent,
  createTileContentFromEmbedUrl,
} from "@/utils/TileUtils";
import { ContentType } from "@/types/TileContent";
import { classifyFileForUpload } from "@/utils/UploadFileClassification";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";

interface LinkPreviewResponse {
  url?: string;
  domain?: string;
  faviconUrl?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

export function useDragAndPaste(containerRef: Ref<HTMLElement | null>) {
  const gridStore = useGridStore();
  const { uploadFileOptimistic, uploadDocumentsOptimistic } =
    useFileUpload();
  const isDraggingOver = ref(false);
  let dragCounter = 0;
  let activeContainer: HTMLElement | null = null;

  const handlePaste = async (event: ClipboardEvent) => {
    // Only handle paste if user is owner and we're on the grid page
    if (!gridStore.canEdit) return;

    // Don't intercept paste events targeting text inputs, textareas,
    // contenteditable elements, or elements inside modals — let the
    // browser handle those natively so users can paste into form fields.
    // We check both the event target AND document.activeElement because
    // TipTap/ProseMirror editors may bubble paste events where the target
    // is a wrapper element rather than the contenteditable div itself.
    const target = event.target as HTMLElement;
    const active = document.activeElement as HTMLElement | null;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable ||
      target.closest("[contenteditable]") ||
      target.closest(".modal-overlay") ||
      active?.isContentEditable ||
      active?.closest("[contenteditable]")
    ) {
      return;
    }

    const items = event.clipboardData?.items;
    if (!items) return;

    let handled = false;

    // Check for files first (images/videos)
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          handled = true;

          try {
            if (classifyFileForUpload(file) === "document") {
              await uploadDocumentsOptimistic([file]);
            } else {
              await uploadFileOptimistic(file);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to upload file.";
            console.error("Failed to upload file from paste:", error);
            alert(errorMessage);
          }
        }
      }
    }

    // If no files were handled, check for text (URLs or plain text)
    if (!handled) {
      const text = event.clipboardData?.getData("text/plain");
      if (text && text.trim()) {
        const trimmedText = text.trim();

        if (
          trimmedText.startsWith("<iframe") ||
          trimmedText.startsWith("<IFRAME")
        ) {
          // Paste is an iframe embed code — route through embed URL handler
          event.preventDefault();
          const embedContent = createTileContentFromEmbedUrl(trimmedText);
          gridStore.addTile(embedContent);
        } else if (isUrl(trimmedText)) {
          // Paste is a URL — create a link tile
          event.preventDefault();
          await handleUrlPaste(trimmedText);
        } else {
          // Plain text — create a new text tile with the pasted content.
          // The text field must be stringified TipTap JSON (not raw text),
          // because TextContent.vue does JSON.parse(content.text) to feed
          // the TipTap editor.
          event.preventDefault();
          const tiptapDoc = {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: trimmedText }],
              },
            ],
          };
          const textContent = createTileContent(ContentType.SMART_TEXT, {
            text: JSON.stringify(tiptapDoc),
          });
          const tileId = gridStore.addTile(textContent);
          // Signal TextContent to auto-enter edit mode with cursor at end
          if (tileId) {
            gridStore.pendingFocusTileId = tileId;
          }
        }
      }
    }
  };

  const isSmartTextDrag = (event: DragEvent): boolean =>
    !!event.dataTransfer?.types.includes("application/x-smarttext-drag");

  const handleDrop = async (event: DragEvent) => {
    if (isSmartTextDrag(event)) return;
    event.preventDefault();
    isDraggingOver.value = false;
    dragCounter = 0;

    if (!gridStore.canEdit) return;

    const files = event.dataTransfer?.files;
    const urlData =
      event.dataTransfer?.getData("text/uri-list") ||
      event.dataTransfer?.getData("text/plain");

    // Handle files
    if (files && files.length > 0) {
      type FileGroup = { kind: "media" | "document"; files: File[] };
      const groups: FileGroup[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files.item(i);
        if (!file) continue;
        const classified = classifyFileForUpload(file);
        if (!classified) continue;
        const bucket: "media" | "document" =
          classified === "document" ? "document" : "media";
        const last = groups[groups.length - 1];
        if (last && last.kind === bucket) {
          last.files.push(file);
        } else {
          groups.push({ kind: bucket, files: [file] });
        }
      }

      for (const group of groups) {
        if (group.kind === "document") {
          try {
            await uploadDocumentsOptimistic(group.files);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Failed to upload file.";
            console.error("Failed to upload dropped file:", error);
            alert(errorMessage);
          }
        } else {
          for (const file of group.files) {
            try {
              await uploadFileOptimistic(file);
            } catch (error) {
              const errorMessage =
                error instanceof Error
                  ? error.message
                  : "Failed to upload file.";
              console.error("Failed to upload dropped file:", error);
              alert(errorMessage);
            }
          }
        }
      }
    }
    // Handle URLs
    else if (urlData && urlData.trim()) {
      const urls = urlData.split("\n").filter((url) => url.trim());
      for (const url of urls) {
        await handleUrlDrop(url.trim());
      }
    }
  };

  const handleDragOver = (event: DragEvent) => {
    if (!gridStore.canEdit || isSmartTextDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragEnter = (event: DragEvent) => {
    if (!gridStore.canEdit || isSmartTextDrag(event)) return;
    event.preventDefault();
    dragCounter++;
    isDraggingOver.value = true;
  };

  const handleDragLeave = (event: DragEvent) => {
    if (!gridStore.canEdit || isSmartTextDrag(event)) return;
    event.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      isDraggingOver.value = false;
    }
  };

  /**
   * Determine whether pasted text is a standalone URL.
   * Must be strict: multi-word text like "check out amazon.com for deals"
   * should NOT be treated as a URL — only single-token strings that are
   * clearly a URL or bare domain (e.g. "https://example.com" or "example.com").
   */
  const isUrl = (text: string): boolean => {
    // URLs never contain whitespace; reject multi-word text immediately
    if (/\s/.test(text)) return false;

    try {
      // Support non-web schemes used for Link Tiles.
      if (/^(mailto|tel):/i.test(text)) {
        new URL(text);
        return true;
      }

      // If it already has a scheme, validate directly
      if (text.startsWith("http://") || text.startsWith("https://")) {
        new URL(text);
        return true;
      }

      // Bare domain heuristic: must contain a dot and parse as a valid URL
      // when we prepend https://
      if (text.includes(".")) {
        new URL(`https://${text}`);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  const handleUrlPaste = async (url: string) => {
    const trimmed = (url || "").trim();
    const formattedUrl = /^(mailto|tel):/i.test(trimmed)
      ? trimmed
      : trimmed.startsWith("http")
        ? trimmed
        : `https://${trimmed}`;

    // Check if this URL should be a special content type (YouTube, music, image, video, etc.)
    if (!/^(mailto|tel):/i.test(formattedUrl)) {
      const detectedContent = createTileContentFromEmbedUrl(formattedUrl);
      if (
        detectedContent.type === ContentType.YOUTUBE ||
        detectedContent.type === ContentType.MUSIC ||
        detectedContent.type === ContentType.IMAGE ||
        detectedContent.type === ContentType.VIDEO
      ) {
        gridStore.addTile(detectedContent);
        return;
      }
    }

    // Otherwise, create a link tile and fetch metadata
    const linkContent = createTileContent(ContentType.LINK, {
      link: formattedUrl,
    });
    const tileId = gridStore.addTile(linkContent);

    if (tileId) {
      // Fetch link preview in background
      try {
        if (/^(mailto|tel):/i.test(formattedUrl)) return;
        const data = await getServiceFactory().getCloudFunctionsService().callFunction<{ url: string }, LinkPreviewResponse>("getLinkPreview", { url: formattedUrl });

        gridStore.patchTileContent(tileId, {
          link: data.url,
          domain: data.domain,
          faviconUrl: data.faviconUrl,
          metaTitle: data.title,
          metaDescription: data.description,
          metaImageUrl: data.imageUrl,
          metaSiteName: data.siteName,
        });
      } catch (error) {
        console.error("Failed to fetch link preview:", error);
      }
    }
  };

  const handleUrlDrop = async (url: string) => {
    const trimmed = (url || "").trim();
    const formattedUrl = /^(mailto|tel):/i.test(trimmed)
      ? trimmed
      : trimmed.startsWith("http")
        ? trimmed
        : `https://${trimmed}`;

    // Check if this URL should be a special content type (YouTube, music, image, video, etc.)
    if (!/^(mailto|tel):/i.test(formattedUrl)) {
      const detectedContent = createTileContentFromEmbedUrl(formattedUrl);
      if (
        detectedContent.type === ContentType.YOUTUBE ||
        detectedContent.type === ContentType.MUSIC ||
        detectedContent.type === ContentType.IMAGE ||
        detectedContent.type === ContentType.VIDEO
      ) {
        gridStore.addTile(detectedContent);
        return;
      }
    }

    // Otherwise, create a link tile and fetch metadata
    const linkContent = createTileContent(ContentType.LINK, {
      link: formattedUrl,
    });
    const tileId = gridStore.addTile(linkContent);

    if (tileId) {
      // Fetch link preview in background
      try {
        if (/^(mailto|tel):/i.test(formattedUrl)) return;
        const data = await getServiceFactory().getCloudFunctionsService().callFunction<{ url: string }, LinkPreviewResponse>("getLinkPreview", { url: formattedUrl });

        gridStore.patchTileContent(tileId, {
          link: data.url,
          domain: data.domain,
          faviconUrl: data.faviconUrl,
          metaTitle: data.title,
          metaDescription: data.description,
          metaImageUrl: data.imageUrl,
          metaSiteName: data.siteName,
        });
      } catch (error) {
        console.error("Failed to fetch link preview:", error);
      }
    }
  };

  const addContainerListeners = (container: HTMLElement) => {
    if (activeContainer === container) return;
    if (activeContainer) removeContainerListeners(activeContainer);

    container.addEventListener("drop", handleDrop);
    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("dragenter", handleDragEnter);
    container.addEventListener("dragleave", handleDragLeave);
    activeContainer = container;
  };

  const removeContainerListeners = (container: HTMLElement) => {
    container.removeEventListener("drop", handleDrop);
    container.removeEventListener("dragover", handleDragOver);
    container.removeEventListener("dragenter", handleDragEnter);
    container.removeEventListener("dragleave", handleDragLeave);

    if (activeContainer === container) {
      activeContainer = null;
    }
  };

  const stopContainerWatch = watch(
    containerRef,
    (container) => {
      if (container) {
        addContainerListeners(container);
      } else if (activeContainer) {
        removeContainerListeners(activeContainer);
      }
    },
    { flush: "post" },
  );

  onMounted(() => {
    document.addEventListener("paste", handlePaste);
  });

  onUnmounted(() => {
    document.removeEventListener("paste", handlePaste);
    stopContainerWatch();

    if (activeContainer) {
      removeContainerListeners(activeContainer);
    }
  });

  return {
    isDraggingOver,
  };
}
