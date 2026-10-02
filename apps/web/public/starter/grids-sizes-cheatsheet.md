# Sizes cheat sheet

Every number you need to make images, videos and files that sit perfectly on a grid. Keep this open while you export.

> **The one rule:** a tile is measured in grid squares. Each square is **75 px**, and the gap between squares is **48 px**. Everything below comes from those two numbers.

---

## Grid basics

| Setting | Value |
|---|---|
| Square (one cell) | 75 × 75 px |
| Gap between squares | 48 px |
| Tile corner radius | 32 px |
| Padding inside text tiles | about 22 px |
| Desktop | 12 columns · 1524 px wide |
| Tablet | 8 columns · 1032 px wide |
| Phone | 4 columns · 540 px wide, scaled down to fit the screen |

A tile that is **n** squares across is `n × 75 + (n − 1) × 48` pixels wide. The same goes for height.

## Tile sizes in pixels

| Squares | On screen | Export at (2×, for sharp screens) |
|---|---|---|
| 1 | 75 px | 150 px |
| 2 | 198 px | 400 px |
| 3 | 321 px | 650 px |
| 4 | 444 px | 900 px |
| 5 | 567 px | 1140 px |
| 6 | 690 px | 1380 px |
| 8 | 936 px | 1880 px |
| 12 | 1476 px | 2960 px |

So a **4 × 2** tile is 444 × 198 px on screen: export it at **900 × 400**.

### Common tiles

| Tile | Size (cols × rows) | On screen | Export at |
|---|---|---|---|
| Small icon or sticker | 1 × 1 | 75 × 75 | 150 × 150 |
| Square photo | 2 × 2 | 198 × 198 | 400 × 400 |
| Big square photo | 4 × 4 | 444 × 444 | 900 × 900 |
| Wide banner | 4 × 2 | 444 × 198 | 900 × 400 |
| Tall poster | 2 × 4 | 198 × 444 | 400 × 900 |
| Video (16:9) | 5 × 3 | 567 × 321 | 1920 × 1080 |
| Hero strip | 8 × 3 | 936 × 321 | 1880 × 650 |

### Matching an aspect ratio

Already have the picture? Pick the tile that crops it the least.

| Your media | Best tile | Why |
|---|---|---|
| 1:1 square | 2 × 2, 3 × 3, 4 × 4 | exact |
| 16:9 video or screenshot | **5 × 3** | 567 × 321 — almost exactly 16:9 |
| 4:3 photo | 4 × 3 | 444 × 321 |
| 3:2 camera photo | 3 × 2 | 321 × 198 |
| 9:16 phone video / story | 3 × 5 | 321 × 567 |
| 4:5 Instagram portrait | 4 × 5 | 444 × 567 |

Anything else still works. The tile fills itself and crops the overflow, and the **Crop** button picks which part shows.

---

## Background image

Found in the grid menu under **Add Background Image**.

- **Size:** 2560 × 1440 px (16:9). 1920 × 1080 is the minimum for sharp desktops.
- **How it's drawn:** it fills the whole window and crops the edges, stays centred, and **does not scroll**. The tiles move over it.
- **Phones crop hard.** A portrait screen shows only the middle third of a 16:9 image. Keep the subject in the centre.
- **It shows through the gaps.** Most tiles are solid, so the background mostly appears in the 48 px gaps and around the edges. Calm images, gradients and textures work better than busy photos.
- **Format:** JPG or WebP for photos, under about 1 MB. SVG works too, which is good for patterns.
- **In dark mode**, darker images keep the black tiles from looking like holes.

## Social share image

Grid menu, **Social Share Image**. This is the picture people see when your link is pasted into a chat or a post.

- **Size:** 1200 × 630 px, PNG or JPG.
- Some apps crop it to a square. Keep your name or logo inside the middle 630 × 630.
- Don't have one? Grids makes one for you from a screenshot of your page.

## Profile photo

- Shown at 152 px in the full profile tile and 75 px in compact layouts.
- **Upload:** a square, at least 512 × 512 px.
- It's cropped to fit the frame, so keep your face in the middle.

## Video

- **Format:** MP4 (H.264) plays everywhere.
- **Resolution:** 1920 × 1080 for a 5 × 3 tile. 1280 × 720 is fine for 4 × 2 and smaller.
- **Loops:** short, silent clips feel like moving photos. Keep them under about 20 MB so the page loads fast.
- **GIFs:** a short MP4 loop looks better and is many times smaller.

## Documents tile

| File | Opens as | Tips |
|---|---|---|
| `.pdf` | Real pages, with thumbnails, zoom and a two-page spread | Any page size — Letter or A4 both work. Fonts are embedded, so it looks exactly as you exported it. |
| `.docx` | Pages on letter-size paper | Set Word to Letter to avoid reflow. Headers, footers, tables and page breaks all show. |
| `.md` | A dark reader, up to 720 px wide | `#`, `##` and `###` headings become the table of contents. Link images with full `https://` addresses. |
| `.txt` | Monospace text | Good for changelogs and poems. |
| `.doc` | Download only | Save as `.docx` to get a preview. |

- One tile can hold several files. Switch with the strip at the bottom of the reader or the arrow keys.
- Give the tile a custom **title** and **description** so visitors know what's inside.

## Upload limits

Nothing is blocked for size. Past these points you'll get a warning that it may take a while:

| Kind | Warning above |
|---|---|
| Images | 25 MB |
| Video | 1 GB |
| Documents | 100 MB |

Big files still count toward your storage, so compress what you can.

---

## Colours

The house palette in the tile colour picker. Use these hex codes in your own graphics so they match.

| Name | Hex |
|---|---|
| Red | `#FFAFA3` |
| Orange | `#FFD3A8` |
| Yellow | `#FFE299` |
| Green | `#B3EFBD` |
| Cyan | `#B3F4EF` |
| Blue | `#A8DAFF` |
| Purple | `#D3BDFF` |
| Pink | `#FFA8DB` |

**Dark mode:** the page is `#10100E`, tiles are `#000000`, and tile outlines are white at 13%.
**Light mode:** the page is `#FFFEF5` and the ink is `#33312C`.

## Layout ideas

Some starting shapes. Sizes are columns × rows on the 12-column desktop grid.

### The classic link-in-bio
- Profile, **4 × 4**, top left
- Four link tiles, **2 × 2** each, in a block beside it
- One **8 × 3** photo or video strip underneath

### The portfolio
- Profile, **3 × 3**
- A **5 × 3** video reel next to it
- A row of **4 × 4** project images, each linked to its case study
- A documents tile holding your CV and a PDF case study

### The musician
- A **4 × 4** cover-art image
- A music tile at **4 × 2** for the latest release
- A map for the next show, and a chat tile as a guestbook

### The one-pager for a small shop
- A **12 × 3** hero banner (export at 2960 × 650)
- Map at **4 × 4** with your address
- Documents tile with the menu or price list as a PDF
- Link tiles for booking and Instagram

### Tips that always help
- **One big thing per screen.** A single 4 × 4 or larger tile anchors the page.
- **Leave a gap on purpose.** With **Gravity** off, an empty square reads as breathing room.
- **Two accent colours, not eight.**
- **Check the phone view last.** Save a Mobile Layout if the order feels wrong.
