# Storage Refactor Grid URL Inventory

This inventory classifies URL values that can be stored in, rendered by, or derived for a grid. For the storage refactor, "archive" means a user-owned file represented by `users/{uid}/uploads/{hash}` and counted once toward that user's quota. Hash fields are the authoritative archive lookup key; URL parsing is only for rendering, migration, validation, and legacy fallback.

## Classification Legend

- **Archive**: should be backed by the file archive, quota, refCount reconciliation, duplication import/copy rules, and the per-file `shareable` flag.
- **Conditional archive**: archive-backed only when the URL is a user-owned uploaded/copied file and has a matching hash field. External URLs in the same field are not archive files.
- **Not archive**: should be ignored by archive accounting, refCount reconciliation, duplicate-file copying, and File Archive UI.

## Grid-Level URLs

| Location | Classification | Used for | Notes |
| --- | --- | --- | --- |
| `Grid.backgroundImageSrc` | Archive | Grid/page background image. | Current uploads use `uploadFileToUrl(..., { fileType: "images" })`. Refactor should pair this with `Grid.backgroundImageHash`. Empty string means no background image. |
| `Grid.ogImageSrc` | Not archive | Custom social share/Open Graph image for a grid. | Keep outside archive and quota. Preserve fixed-path behavior under `og-images/custom/{uid}/{gridId}/og`. Generated OG images under `og-images/slug/{slug}.png` and `og-images/grid/{gridId}.png` are also not archive files. |
| `generatedOgImageUrl(...)`, `defaultOgImageUrl(...)`, `ogImageCheckUrl(...)` | Not archive | Runtime URLs used by the OG image modal/share flow to generate, check, or display social preview images. | These are route/function URLs, not grid-owned uploaded files. |

## Tile Content URLs

| Location | Classification | Used for | Notes |
| --- | --- | --- | --- |
| `ImageContent.src` | Archive | Image tile media source. | Pair with `ImageContent.srcHash`. During optimistic upload this may temporarily be a `blob:` URL; only the resolved storage URL/hash should persist. |
| `VideoContent.src` | Archive | Video tile media source. | Pair with `VideoContent.srcHash`. During optimistic upload this may temporarily be a `blob:` URL; only the resolved storage URL/hash should persist. |
| `DocumentsContent.items[].url` | Archive | Original document file opened by the document tile previewer/downloader. | Pair each item with `DocumentItem.hash`. During optimistic upload this may temporarily be a `blob:` URL; only the resolved storage URL/hash should persist. |
| `DocumentsContent.items[].thumbnailUrl` | Not archive | First-page raster preview for PDFs. | Generated server-side at `thumbnails/documents/{uid}/{itemId}.png`. It is a derived preview, not a user archive file, and should not count against archive quota/refCount. |
| `LinkContent.customImageUrl` | Conditional archive | Owner-selected override image for a link tile preview/background. | Archive-backed when uploaded from a local file through the image picker; pair with `LinkContent.customImageHash`. Not archive when set from an arbitrary image URL through the toolbar. |
| `LinkContent.metaImageUrl` | Not archive | Scraped Open Graph/Twitter preview image for a link. | Comes from link preview metadata and may point at the target site's CDN. Do not copy into archive unless the user explicitly uploads/imports it through an archive-aware flow. |
| `LinkContent.faviconUrl` | Not archive | Link tile favicon. | Comes from scraped metadata or Google favicon URL construction. It is third-party metadata, not a user file. |
| `LinkContent.link` | Not archive | Primary destination opened by the link tile. | Navigation target only. |
| `ProfileBioContent.profilePhotoUrl` | Archive | Profile tile avatar/photo; also feeds page favicon/user menu behavior from grid profile content. | Pair with `ProfileBioContent.profilePhotoHash`. External profile image imports should be copied into archive before being persisted here. |
| `TextContent.tileLink`, `SmartTextContent.tileLink`, `ImageContent.tileLink`, `VideoContent.tileLink` | Not archive | Optional click-through destination for a tile. | Navigation target only. It may be internal or external but is not a file reference. |
| `SmartTextContent.text` Tiptap image node `attrs.src` | Archive | Inline image inserted into a smart text tile with `/image`. | Current flow uploads the selected image and stores the returned URL inside the serialized editor JSON. The refactor needs explicit reference extraction for this JSON field and a hash strategy for inline images; otherwise these uploads will be missed by refCount, quota, archive UI, and duplication. |
| `SmartTextContent.text` Tiptap link mark `attrs.href` | Not archive | Inline rich-text hyperlink. | Navigation target only. |
| `TextContent.text` embedded links, if present in serialized content | Not archive | Text content hyperlinks. | Treat as navigation targets unless a future editor feature stores archive-backed image nodes here. If images become possible in plain text content, add them to the reference extractor with hash support. |
| `EmbedContent.src` | Not archive | External embed URL, iframe source, or direct external image/video URL rendered by an embed tile. | Current embed creation is URL-entry based, not user-file upload based. Do not treat as archive unless a future upload-backed embed flow adds a hash field. |
| `YouTubeContent.youtubeUrl` | Not archive | Original YouTube video/playlist/channel URL and open-in-YouTube destination. | Third-party URL. |
| `YouTubeContent.thumbnails.*.url`, `playlistItems[].thumbnails.*.url`, `channelData.thumbnails.*.url`, `recentVideos[].thumbnails.*.url` | Not archive | YouTube tile thumbnail images. | Third-party API metadata. |
| `YouTubeContent.channelThumbnail` | Not archive | YouTube channel avatar image. | Third-party API metadata. |
| `YouTubeChannelData.customUrl` | Not archive | YouTube channel handle/custom URL metadata. | Third-party navigation/metadata value, not a file. |
| `MusicContent.albumArt` | Not archive | Music tile cover art. | Third-party provider metadata from Spotify/Apple Music. |
| `MusicContent.previewUrl` | Not archive | Music preview audio source. | Third-party provider media preview, not a user-owned file. |
| `MusicContent.trackUrl` | Not archive | External track destination. | Navigation target only. |
| `MusicContent.artistUrl` | Not archive | External artist destination. | Navigation target only. |

## Grid-Rendered URLs That Are Not Persisted User Files

| Source | Classification | Used for | Notes |
| --- | --- | --- | --- |
| Static app/public assets imported by tile components or demo data | Not archive | Default illustrations, demo content, decorative tile assets, and local UI imagery. | These are build/runtime assets owned by the app, not user archive files. |
| Mapbox style, tile, geocoding, plane, or weather/cloud requests | Not archive | Map tile rendering and related runtime data. | `MapContent` stores map state such as coordinates/style flags, not user-file URLs. |
| Notion API URLs used by roadmap feed functions | Not archive | Roadmap feed sync. | `RoadmapFeedContent` stores the Notion database ID and cached item data, not file URLs. |
| Temporary `blob:` URLs | Not archive | Local optimistic previews before upload completion. | Must never be persisted. Existing persistence utilities replace known blob URLs with resolved storage URLs and strip unresolved blob URLs as a safety net. |
| `data:` URLs | Not archive | Inline/generated browser data when present. | Should not be archived or persisted as file references. If any flow creates them, normalize through upload first or strip/ignore them. |

## Reference Extraction Implications

1. Archive extraction should include only archive-backed fields and should return both URL and hash when present.
2. For migrated/new archive files, the hash field must drive lookups into `users/{uid}/uploads/{hash}`. The URL is secondary.
3. Legacy URL-only archive candidates should be classified by storage path only during migration/backfill/fallback.
4. External/provider/generated URLs must be ignored even when they are displayed inside a grid.
5. Smart text inline images are the main non-obvious archive case because the URL is nested inside serialized editor JSON instead of a typed top-level field.
