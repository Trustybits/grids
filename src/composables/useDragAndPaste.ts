import { ref, onMounted, onUnmounted, type Ref } from "vue";
import { useFileUpload } from "./useFileUpload";
import { useLayoutStore } from "@/stores/layout";
import { createTileContent, isDirectImageUrl, isDirectVideoUrl } from "@/utils/TileUtils";
import { ContentType } from "@/types/TileContent";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";

export function useDragAndPaste(containerRef: Ref<HTMLElement | null>) {
  const layoutStore = useLayoutStore();
  const { uploadFile } = useFileUpload();
  const isDraggingOver = ref(false);
  let dragCounter = 0;

  const handlePaste = async (event: ClipboardEvent) => {
    // Only handle paste if user is owner and we're on the grid page
    if (!layoutStore.isOwner) return;

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
            const content = await uploadFile(file);
            if (content) {
              layoutStore.addTile(content);
            }
          } catch (error: any) {
            console.error("Failed to upload file from paste:", error);
            alert(error.message || "Failed to upload file.");
          }
        }
      }
    }

    // If no files were handled, check for text (URLs)
    if (!handled) {
      const text = event.clipboardData?.getData("text/plain");
      if (text && text.trim()) {
        const trimmedText = text.trim();
        
        // Check if it looks like a URL
        if (isUrl(trimmedText)) {
          event.preventDefault();
          await handleUrlPaste(trimmedText);
        }
      }
    }
  };

  const handleDrop = async (event: DragEvent) => {
    event.preventDefault();
    isDraggingOver.value = false;
    dragCounter = 0;

    if (!layoutStore.isOwner) return;

    const files = event.dataTransfer?.files;
    const urlData = event.dataTransfer?.getData("text/uri-list") || event.dataTransfer?.getData("text/plain");

    // Handle files
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
          const content = await uploadFile(file);
          if (content) {
            layoutStore.addTile(content);
          }
        } catch (error: any) {
          console.error("Failed to upload dropped file:", error);
          alert(error.message || "Failed to upload file.");
        }
      }
    }
    // Handle URLs
    else if (urlData && urlData.trim()) {
      const urls = urlData.split('\n').filter(url => url.trim());
      for (const url of urls) {
        await handleUrlDrop(url.trim());
      }
    }
  };

  const handleDragOver = (event: DragEvent) => {
    if (!layoutStore.isOwner) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragEnter = (event: DragEvent) => {
    if (!layoutStore.isOwner) return;
    event.preventDefault();
    dragCounter++;
    isDraggingOver.value = true;
  };

  const handleDragLeave = (event: DragEvent) => {
    if (!layoutStore.isOwner) return;
    event.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      isDraggingOver.value = false;
    }
  };

  const isUrl = (text: string): boolean => {
    try {
      // Check for common URL patterns
      if (text.startsWith("http://") || text.startsWith("https://") || text.includes(".com") || text.includes(".org") || text.includes(".net")) {
        new URL(text.startsWith("http") ? text : `https://${text}`);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleUrlPaste = async (url: string) => {
    const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
    
    // Check if it's a direct image or video URL
    if (isDirectImageUrl(formattedUrl)) {
      const content = createTileContent(ContentType.IMAGE, { src: formattedUrl });
      layoutStore.addTile(content);
    } else if (isDirectVideoUrl(formattedUrl)) {
      const content = createTileContent(ContentType.VIDEO, { src: formattedUrl });
      layoutStore.addTile(content);
    } else {
      // Create a link tile and fetch metadata
      const linkContent = createTileContent(ContentType.LINK, { link: formattedUrl });
      const tileId = layoutStore.addTile(linkContent);

      if (tileId) {
        // Fetch link preview in background
        try {
          const getLinkPreview = httpsCallable(functions, "getLinkPreview");
          const result = await getLinkPreview({ url: formattedUrl });
          const data = result.data as any;

          layoutStore.patchTileContent(tileId, {
            link: data?.url,
            domain: data?.domain,
            faviconUrl: data?.faviconUrl,
            metaTitle: data?.title,
            metaDescription: data?.description,
            metaImageUrl: data?.imageUrl,
            metaSiteName: data?.siteName,
          });
        } catch (error) {
          console.error("Failed to fetch link preview:", error);
        }
      }
    }
  };

  const handleUrlDrop = async (url: string) => {
    const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
    
    // Check if it's a direct image or video URL
    if (isDirectImageUrl(formattedUrl)) {
      const content = createTileContent(ContentType.IMAGE, { src: formattedUrl });
      layoutStore.addTile(content);
    } else if (isDirectVideoUrl(formattedUrl)) {
      const content = createTileContent(ContentType.VIDEO, { src: formattedUrl });
      layoutStore.addTile(content);
    } else {
      // Create a link tile and fetch metadata
      const linkContent = createTileContent(ContentType.LINK, { link: formattedUrl });
      const tileId = layoutStore.addTile(linkContent);

      if (tileId) {
        // Fetch link preview in background
        try {
          const getLinkPreview = httpsCallable(functions, "getLinkPreview");
          const result = await getLinkPreview({ url: formattedUrl });
          const data = result.data as any;

          layoutStore.patchTileContent(tileId, {
            link: data?.url,
            domain: data?.domain,
            faviconUrl: data?.faviconUrl,
            metaTitle: data?.title,
            metaDescription: data?.description,
            metaImageUrl: data?.imageUrl,
            metaSiteName: data?.siteName,
          });
        } catch (error) {
          console.error("Failed to fetch link preview:", error);
        }
      }
    }
  };

  onMounted(() => {
    if (!containerRef.value) return;

    // Add paste listener to document
    document.addEventListener("paste", handlePaste);

    // Add drag and drop listeners to container
    const container = containerRef.value;
    container.addEventListener("drop", handleDrop);
    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("dragenter", handleDragEnter);
    container.addEventListener("dragleave", handleDragLeave);
  });

  onUnmounted(() => {
    document.removeEventListener("paste", handlePaste);

    if (containerRef.value) {
      const container = containerRef.value;
      container.removeEventListener("drop", handleDrop);
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("dragenter", handleDragEnter);
      container.removeEventListener("dragleave", handleDragLeave);
    }
  });

  return {
    isDraggingOver,
  };
}
