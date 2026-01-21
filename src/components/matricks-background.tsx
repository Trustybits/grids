// Sample Usage:
// <MatrixBackground
//         emphasizedMessages={[
//           "WELCOME TO JOJU",
//           "MANAGE YOUR\nACCOMPLISHMENTS",  // Multi-line example
//           "BUILD YOUR\nPORTFOLIO",         // Two-line example
//           "SHOWCASE\nYOUR WORK"           // Three-line example
//         ]}
//         typingSpeed={10} // Characters per second
//         messageDuration={3000} // Each message displays for 3 seconds
//         fadeOutDuration={1000}
//         emphasizedPosition={{ x: 50, y: 30 }}
//         textAlignment="center"
//         lineHeight={1.5}
//         primaryColor="50, 50, 50" // Slightly brighter green
//         fontSize={18} // Larger characters
//         animationSpeed={0.5}
//         animationPattern="random" // Choose from "random", "wave", "rain", or "ripple"
//         patternSpeed={0.5} // Faster rain animation
//         characterSpacing={1.5} // Faster animations
//         emphasizedColor="255, 255, 255" // White emphasized text
//         emphasizedGlow={true}
//         emphasizedPulse={true}
//         emphasizedSize={18} // Larger emphasized text
//         customFont="JojuOne" // Using our custom JojuOne font
//         rippleLowColor="0, 255, 0" // RGB color at ripple low
//         rippleHighColor="255, 255, 255" // RGB color at ripple peak
//         rippleIntensity={1.5} // Multiplier for ripple brightness
//         rippleDensity={1.5} // Ripple spawn frequency multiplier
//         flashFrequency={0.002} // How often flashes occur
//         maxFlashIntensity={0.9} // Maximum brightness for random flashes
//         vignetteEnabled={true} // Enable vignette effect
//         vignetteIntensity={0.7} // Vignette darkness (0-1)
//         vignetteSpread={0.8} // How far vignette extends from edges (0-1)
//         vignetteColor="0, 0, 0" // RGB color for vignette
//       />

export interface MatricksBackgroundOptions {
  emphasizedText?: string
  emphasizedMessages?: string[] // Array of messages to cycle through
  typingSpeed?: number // Speed of typing animation (characters per second)
  messageDuration?: number // How long each message stays visible (ms)
  fadeOutDuration?: number // How long the fade-out animation lasts (ms)
  emphasizedPosition?: { x: number; y: number }
  textAlignment?: "center" | "left" // Text alignment option
  lineHeight?: number // Vertical spacing between lines for multi-line text
  customFont?: string
  // Main styling controls
  primaryColor?: string
  fontSize?: number
  animationSpeed?: number
  characterSpacing?: number // Spacing multiplier between characters
  patternSpeed?: number // Speed multiplier for animation patterns
  // Ripple effect controls
  rippleLowColor?: string // RGB color at ripple low (e.g., "50, 50, 50")
  rippleHighColor?: string // RGB color at ripple peak (e.g., "255, 255, 255")
  rippleIntensity?: number // Multiplier for ripple brightness (0-2, default 1)
  rippleDensity?: number // Ripple spawn frequency multiplier (0.1-3, default 1, lower = fewer ripples)
  // Flash/flicker controls
  flashFrequency?: number // How often flashes occur (0-1, default 0.001)
  maxFlashIntensity?: number // Maximum brightness for random flashes (0-1, default 0.7)
  // Vignette controls
  vignetteEnabled?: boolean // Enable/disable vignette effect
  vignetteIntensity?: number // Vignette darkness (0-1, default 0.5)
  vignetteSpread?: number // How far vignette extends from edges (0-1, default 0.7)
  vignetteColor?: string // RGB color for vignette (default "0, 0, 0" for black)
  // Emphasized text controls
  emphasizedColor?: string
  emphasizedGlow?: boolean
  emphasizedPulse?: boolean
  emphasizedSize?: number
  animationPattern?: "wave" | "rain" | "ripple" | "random" | "grids" // Animation pattern
  // Background fade controls
  fadeFillColor?: string // RGB values (e.g. "0, 0, 0")
  fadeFillAlpha?: number // 0-1, lower = longer trails

  characters?: string

  // Grids pattern controls
  gridsTileCount?: number
  gridsTileSizes?: Array<{ w: number; h: number }>
  gridsTileMinSize?: { w: number; h: number }
  gridsTileMaxSize?: { w: number; h: number }
  gridsTileChangeEveryFrames?: number
  gridsTileTransitionFrames?: number
  gridsTileAllowOverlap?: boolean
  gridsUnitSizeChars?: number // How many character-cells represent one "tile unit".
  gridsUnitChoices?: number[] // Allowed unit sizes for a tile side, e.g. [2,3,4]
  gridsTileGapUnits?: number // Minimum spacing between tiles (in tile units).
  gridsCornerRadiusChars?: number // Corner radius (in character-cells) used to mask corners.
  gridsBackgroundOpacityScale?: number // Extra dimming for non-tile background cells.
  gridsTileOpacityBase?: number // Base opacity for tile cells.
  gridsTileOpacityPulse?: number // Pulsing opacity amplitude for tile cells.
  gridsTileMoveChance?: number // Chance a tile also repositions when it changes size.
  gridsTileCharChangeEveryFrames?: number // How often tile interior characters update.
}
export const startMatricksBackground = (
  canvas: HTMLCanvasElement,
  options: MatricksBackgroundOptions = {},
  dimensions?: { width: number; height: number }
) => {
  const {
    emphasizedText = "",
    emphasizedMessages = [],
    typingSpeed = 5,
    messageDuration = 3000,
    fadeOutDuration = 1000, // Default fade-out duration of 1 second
    emphasizedPosition = { x: 50, y: 50 },
    textAlignment = "center", // Default to center alignment
    lineHeight = 1.5, // Default line height multiplier
    customFont = "font-matrix",
    primaryColor = "0, 255, 0", // RGB values for green
    fontSize = 16,
    animationSpeed = 1,
    patternSpeed = 1,
    rippleLowColor = "0, 255, 0",
    rippleHighColor = "255, 255, 255",
    rippleIntensity = 1,
    rippleDensity = 1,
    flashFrequency = 0.001,
    maxFlashIntensity = 0.7,
    vignetteEnabled = true,
    vignetteIntensity = 0.5,
    vignetteSpread = 0.7,
    vignetteColor = "0, 0, 0",
    characterSpacing = 1.2, // Default spacing multiplier between characters
    emphasizedColor = "0, 255, 0", // RGB values for emphasized text color
    emphasizedGlow = true,
    emphasizedPulse = true,
    emphasizedSize, // Defaults to fontSize if not provided
    animationPattern = "random", // Defaults to random animation
    fadeFillColor = "0, 0, 0",
    fadeFillAlpha = 0.1,

    characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ",

    gridsTileCount = 24,
    // NOTE: these sizes are in "tile units" (not character-cells). They will
    // be multiplied by gridsUnitSizeChars.
    gridsTileSizes = [],
    gridsTileMinSize = { w: 4, h: 4 },
    gridsTileMaxSize = { w: 16, h: 16 },
    gridsTileChangeEveryFrames = 260,
    gridsTileTransitionFrames = 90,
    gridsTileAllowOverlap = false,
    gridsUnitSizeChars = 3,
    gridsUnitChoices = [4, 8, 12, 16],
    gridsTileGapUnits = 1,
    gridsCornerRadiusChars = 4,
    gridsBackgroundOpacityScale = 0.22,
    gridsTileOpacityBase = 0.45,
    gridsTileOpacityPulse = 0.08,
    gridsTileMoveChance = 0.15,
    gridsTileCharChangeEveryFrames = 24,
  } = options

  const ctx = canvas.getContext("2d")
  if (!ctx) return () => undefined

  const width = dimensions?.width ?? window.innerWidth
  const height = dimensions?.height ?? window.innerHeight

  canvas.width = width
  canvas.height = height

    const charArray = characters.split("")

    // Use the characterSpacing prop to control gaps between characters
    const effectiveFontSize = fontSize * characterSpacing
    
    // Add extra columns and rows to ensure full coverage with a buffer
    // This ensures we don't have empty space at the edges
    const columns = Math.ceil(canvas.width / effectiveFontSize) + 2
    const rows = Math.ceil(canvas.height / effectiveFontSize) + 2
    
    // Calculate offset to center the grid
    const offsetX = (columns * effectiveFontSize - canvas.width) / 2
    const offsetY = (rows * effectiveFontSize - canvas.height) / 2

    const centerX = Math.floor((emphasizedPosition.x / 100) * columns)
    const centerY = Math.floor((emphasizedPosition.y / 100) * rows)
    
    // Calculate the maximum message length for centering and clearing
    // Consider all lines in multi-line messages
    const getMaxLineLength = (message: string) => {
      return Math.max(...message.split("\n").map(line => line.length))
    }

    const clampTileUnitSize = (size: { w: number; h: number }) => {
      return {
        w: Math.max(gridsTileMinSize.w, Math.min(gridsTileMaxSize.w, size.w)),
        h: Math.max(gridsTileMinSize.h, Math.min(gridsTileMaxSize.h, size.h)),
      }
    }

    const pickTileUnitSize = () => {
      if (gridsTileSizes.length > 0) {
        return clampTileUnitSize(gridsTileSizes[Math.floor(Math.random() * gridsTileSizes.length)])
      }

      const w = gridsUnitChoices[Math.floor(Math.random() * gridsUnitChoices.length)]
      const h = gridsUnitChoices[Math.floor(Math.random() * gridsUnitChoices.length)]
      return clampTileUnitSize({ w, h })
    }

    const toCharSize = (unitSize: { w: number; h: number }) => {
      return {
        w: Math.max(1, Math.round(unitSize.w * gridsUnitSizeChars)),
        h: Math.max(1, Math.round(unitSize.h * gridsUnitSizeChars)),
      }
    }

    const gridsPlacementStepChars = Math.max(1, Math.round(gridsUnitSizeChars))
    const gridsTileGapChars = Math.max(0, Math.round(gridsTileGapUnits * gridsUnitSizeChars))

    const snapToGrid = (pos: number) => {
      return Math.max(0, Math.round(pos / gridsPlacementStepChars) * gridsPlacementStepChars)
    }

    const clampSnappedPos = (pos: number, maxPos: number) => {
      const maxSnapped = Math.max(0, Math.floor(maxPos / gridsPlacementStepChars) * gridsPlacementStepChars)
      return Math.max(0, Math.min(snapToGrid(pos), maxSnapped))
    }

    const pickSnappedPos = (maxPos: number) => {
      const maxSnapped = Math.max(0, Math.floor(maxPos / gridsPlacementStepChars))
      return Math.floor(Math.random() * (maxSnapped + 1)) * gridsPlacementStepChars
    }

    const getTileSizeAtFrame = (tile: GridsTile, frame: number) => {
      const denom = Math.max(1, gridsTileTransitionFrames)
      const t = Math.min(1, Math.max(0, (frame - tile.transitionStartFrame) / denom))
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      const w = Math.max(1, Math.round(tile.startW + (tile.targetW - tile.startW) * eased))
      const h = Math.max(1, Math.round(tile.startH + (tile.targetH - tile.startH) * eased))
      return { w, h }
    }

    const rectsOverlap = (
      a: { x: number; y: number; w: number; h: number },
      b: { x: number; y: number; w: number; h: number },
      gap: number
    ) => {
      // Enforce an additional minimum spacing between rectangles.
      return (
        a.x < b.x + b.w + gap &&
        a.x + a.w + gap > b.x &&
        a.y < b.y + b.h + gap &&
        a.y + a.h + gap > b.y
      )
    }

    const hashU32 = (n: number) => {
      // Fast integer hash to generate stable pseudo-randomness without extra state.
      let x = n >>> 0
      x ^= x >>> 16
      x = Math.imul(x, 0x7feb352d)
      x ^= x >>> 15
      x = Math.imul(x, 0x846ca68b)
      x ^= x >>> 16
      return x >>> 0
    }

    const buildTileLookup = (tiles: GridsTile[], frame: number) => {
      const lookup: number[][] = []
      const occupiedRects: Array<{ x: number; y: number; w: number; h: number }> = []
      for (let col = 0; col < columns; col++) {
        lookup[col] = []
        for (let row = 0; row < rows; row++) lookup[col][row] = -1
      }

      for (const tile of tiles) {
        const { w, h } = getTileSizeAtFrame(tile, frame)
        tile.currentW = w
        tile.currentH = h

        const startCol = Math.max(0, tile.x)
        const startRow = Math.max(0, tile.y)
        const endCol = Math.min(columns, tile.x + w)
        const endRow = Math.min(rows, tile.y + h)

        // When a gap is configured, treat too-close tiles as colliding even if
        // their raw rectangles don't overlap.
        if (!gridsTileAllowOverlap && gridsTileGapChars > 0) {
          const rect = { x: tile.x, y: tile.y, w, h }
          let tooClose = false
          for (const placed of occupiedRects) {
            if (rectsOverlap(rect, placed, gridsTileGapChars)) {
              tooClose = true
              break
            }
          }
          if (tooClose) continue
          occupiedRects.push(rect)
        }

        // With no-overlap enabled, never partially draw a tile. If any cell
        // is occupied, skip this tile (leaving the background visible).
        if (!gridsTileAllowOverlap) {
          let hasCollision = false
          for (let col = startCol; col < endCol; col++) {
            for (let row = startRow; row < endRow; row++) {
              if (lookup[col][row] !== -1) {
                hasCollision = true
                break
              }
            }
            if (hasCollision) break
          }
          if (hasCollision) continue
        }

        for (let col = startCol; col < endCol; col++) {
          for (let row = startRow; row < endRow; row++) {
            if (lookup[col][row] !== -1 && !gridsTileAllowOverlap) continue
            lookup[col][row] = tile.id
          }
        }
      }

      return lookup
    }

    const gridTiles: GridsTile[] = []
    if (animationPattern === "grids") {
      const perTileAttempts = 32
      let globalAttempts = 0
      while (gridTiles.length < gridsTileCount && globalAttempts < gridsTileCount * perTileAttempts) {
        globalAttempts++
        const size = toCharSize(pickTileUnitSize())

        const maxX = Math.max(0, columns - size.w)
        const maxY = Math.max(0, rows - size.h)
        const x = pickSnappedPos(maxX)
        const y = pickSnappedPos(maxY)
        const proposed = { x, y, w: size.w, h: size.h }

        let collides = false
        for (const other of gridTiles) {
          const otherRect = { x: other.x, y: other.y, w: other.targetW, h: other.targetH }
          if (rectsOverlap(proposed, otherRect, gridsTileGapChars)) {
            collides = true
            break
          }
        }
        if (collides) continue

        const id = gridTiles.length
        gridTiles.push({
          id,
          x,
          y,
          startW: size.w,
          startH: size.h,
          targetW: size.w,
          targetH: size.h,
          transitionStartFrame: 0,
          nextChangeFrame: Math.floor(Math.random() * gridsTileChangeEveryFrames) + gridsTileChangeEveryFrames,
          seed: Math.floor(Math.random() * 1000000),
        })
      }
    }
    
    const maxMessageLength = emphasizedMessages.length > 0 
      ? Math.max(...emphasizedMessages.map(getMaxLineLength), emphasizedText?.length || 0)
      : emphasizedText?.length || 0
    
    // Set text start position based on alignment
    let textStartX = centerX
    if (textAlignment === "center") {
      textStartX = Math.round(centerX - maxMessageLength / 2)
    }
    const textStartY = centerY

    interface GridCell {
      char: string
      animationType: "pulse" | "flicker" | "wave" | "strobe" | "fade"
      phase: number
      speed: number
      intensity: number
      lastChange: number
      isEmphasized: boolean
      originalChar?: string
      rippleIntensity?: number
    }

    interface GridsTile {
      id: number
      x: number
      y: number
      startW: number
      startH: number
      targetW: number
      targetH: number
      transitionStartFrame: number
      nextChangeFrame: number
      seed: number
      currentW?: number
      currentH?: number
    }

    const grid: GridCell[][] = []

    for (let col = 0; col < columns; col++) {
      grid[col] = []
      for (let row = 0; row < rows; row++) {
        const animationTypes: GridCell["animationType"][] =
          animationPattern === "grids" ? ["pulse"] : ["pulse", "flicker", "wave", "strobe", "fade"]

        const isEmphasizedCell =
          !!emphasizedText && row === textStartY && col >= textStartX && col < textStartX + (emphasizedText?.length || 0)

        const emphasizedChar = isEmphasizedCell ? emphasizedText[col - textStartX] : null

        // Initialize cell properties based on animation pattern
        let initialPhase = Math.random() * Math.PI * 2
        let initialSpeed = (Math.random() * 0.05 + 0.01) * animationSpeed
        let initialIntensity = Math.random() * 0.8 + 0.2
        
        // Customize cell initialization based on animation pattern
        switch (animationPattern) {
          case "wave":
            // Create horizontal waves by syncing phases based on row position
            initialPhase = (row / rows) * Math.PI * 2
            initialSpeed = (0.03 + Math.random() * 0.02) * animationSpeed
            break
            
          case "rain":
            // Matrix-style rain effect - faster animation for higher rows
            initialPhase = (row / rows) * Math.PI * 2
            initialSpeed = ((rows - row) / rows * 0.08 + 0.02) * animationSpeed
            initialIntensity = Math.min(1, (rows - row) / rows * 1.2 + 0.2)
            break
            
          case "ripple":
            // Create ripple effects from center points
            const distanceFromCenter = Math.sqrt(
              Math.pow((col - columns / 2) / columns, 2) + 
              Math.pow((row - rows / 2) / rows, 2)
            )
            initialPhase = distanceFromCenter * Math.PI * 4
            initialSpeed = (0.03 + Math.random() * 0.02) * animationSpeed
            initialIntensity = Math.max(0.2, 1 - distanceFromCenter)
            break
            
          case "random":
          default:
            // Random animation (default) - no changes to initial values
            break
        }

        if (animationPattern === "grids") {
          // Keep the background field calm behind the landing page content.
          initialSpeed = (0.004 + Math.random() * 0.004) * animationSpeed
          initialIntensity = 0.35 + Math.random() * 0.25
        }

        grid[col][row] = {
          char: emphasizedChar || charArray[Math.floor(Math.random() * charArray.length)],
          animationType: animationTypes[Math.floor(Math.random() * animationTypes.length)],
          phase: initialPhase,
          speed: initialSpeed,
          intensity: initialIntensity,
          lastChange: 0,
          isEmphasized: isEmphasizedCell,
          originalChar: emphasizedChar || undefined,
        }
      }
    }

    // Create rain columns
    const rainColumns: { active: boolean, headPosition: number, length: number, leadCharBrightness: number, speed: number }[] = []
    for (let col = 0; col < columns; col++) {
      rainColumns.push({
        active: Math.random() < 0.5,
        headPosition: Math.random() * rows,
        length: Math.floor(Math.random() * 10 + 5),
        leadCharBrightness: Math.random() * 0.5 + 0.5,
        speed: (Math.random() * 0.3 + 0.2) * patternSpeed // Column-specific speed affected by patternSpeed
      })
    }

    let frameCount = 0
    let messageIndex = 0
    let typingProgress = 0
    let lastMessageTime = 0
    let fadeOutProgress = 0
    let animationState = "typing" // "typing", "display", "fadeOut"
    
    // Create ripple centers for ripple animation
    const rippleCenters: {x: number, y: number, phase: number, speed: number}[] = []
    if (animationPattern === "ripple") {
      for (let i = 0; i < 5; i++) {
        rippleCenters.push({
          x: Math.random() * columns,
          y: Math.random() * rows,
          phase: Math.random() * Math.PI * 2,
          speed: (Math.random() * 0.03 + 0.01) * animationSpeed
        })
      }
    }

    let animationFrameId: number | null = null

    const draw = () => {
      frameCount++

      ctx.fillStyle = `rgba(${fadeFillColor}, ${fadeFillAlpha})`
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.font = `${fontSize}px ${customFont}, monospace`
      ctx.textAlign = "start"
      ctx.textBaseline = "top"

      // Update animation based on pattern
      if (animationPattern === "ripple") {
        // Add new ripple centers occasionally, frequency affected by patternSpeed and rippleDensity
        const spawnInterval = Math.floor(120 / (patternSpeed * rippleDensity))
        if (frameCount % spawnInterval === 0) {
          rippleCenters.push({
            x: Math.random() * columns,
            y: Math.random() * rows,
            phase: 0, // Start at beginning of ripple
            speed: (Math.random() * 0.03 + 0.01) * animationSpeed * patternSpeed
          })
          
          // Remove old ripples that have fully faded (phase > 15 means fully expanded and faded)
          while (rippleCenters.length > 0 && rippleCenters[0].phase > 15) {
            rippleCenters.shift()
          }
        }
        
        // Update ripple phases with patternSpeed
        for (const ripple of rippleCenters) {
          ripple.phase += ripple.speed * patternSpeed
        }
      }

      // Update rain columns
      if (animationPattern === "rain") {
        for (let col = 0; col < columns; col++) {
          const rainColumn = rainColumns[col]
          if (rainColumn.active) {
            rainColumn.headPosition += rainColumn.speed * patternSpeed
            if (rainColumn.headPosition > rows) {
              rainColumn.headPosition = 0
              rainColumn.length = Math.floor(Math.random() * 10 + 5)
              rainColumn.leadCharBrightness = Math.random() * 0.5 + 0.5
              rainColumn.speed = (Math.random() * 0.3 + 0.2) * patternSpeed // Randomize speed for next fall
            }
          } else {
            if (Math.random() < 0.02 * patternSpeed) { // Activation chance affected by patternSpeed
              rainColumn.active = true
              rainColumn.headPosition = 0
              rainColumn.length = Math.floor(Math.random() * 10 + 5)
              rainColumn.leadCharBrightness = Math.random() * 0.5 + 0.5
              rainColumn.speed = (Math.random() * 0.3 + 0.2) * patternSpeed
            }
          }
        }
      }

      let gridsTileLookup: number[][] | null = null
      if (animationPattern === "grids") {
        // Ensure sizes are initialized for collision checks.
        for (const tile of gridTiles) {
          const { w, h } = getTileSizeAtFrame(tile, frameCount)
          tile.currentW = w
          tile.currentH = h
        }

        for (const tile of gridTiles) {
          if (frameCount >= tile.nextChangeFrame) {
            const current = getTileSizeAtFrame(tile, frameCount)
            const attemptCount = 14
            let didUpdate = false

            for (let attempt = 0; attempt < attemptCount; attempt++) {
              const nextUnits = pickTileUnitSize()
              const next = toCharSize(nextUnits)

              const wantsMove = Math.random() < gridsTileMoveChance
              const maxX = Math.max(0, columns - next.w)
              const maxY = Math.max(0, rows - next.h)
              const nextX = wantsMove ? pickSnappedPos(maxX) : clampSnappedPos(tile.x, maxX)
              const nextY = wantsMove ? pickSnappedPos(maxY) : clampSnappedPos(tile.y, maxY)

              const proposed = { x: nextX, y: nextY, w: next.w, h: next.h }
              let collides = false

              for (const other of gridTiles) {
                if (other.id === tile.id) continue
                const otherSize = getTileSizeAtFrame(other, frameCount)
                const otherRect = { x: other.x, y: other.y, w: otherSize.w, h: otherSize.h }
                if (rectsOverlap(proposed, otherRect, gridsTileGapChars)) {
                  collides = true
                  break
                }
              }

              if (!collides) {
                tile.startW = current.w
                tile.startH = current.h
                tile.targetW = next.w
                tile.targetH = next.h
                tile.x = nextX
                tile.y = nextY
                tile.transitionStartFrame = frameCount
                tile.nextChangeFrame = frameCount + gridsTileChangeEveryFrames
                didUpdate = true
                break
              }
            }

            if (!didUpdate) {
              // If no valid placement exists, keep current dimensions/position and try again later.
              tile.nextChangeFrame = frameCount + Math.floor(gridsTileChangeEveryFrames / 2)
            }
          }
        }

        gridsTileLookup = buildTileLookup(gridTiles, frameCount)
      }

      for (let col = 0; col < columns; col++) {
        for (let row = 0; row < rows; row++) {
          const cell = grid[col][row]
          // Apply the offset to center the grid and ensure full coverage
          const x = col * effectiveFontSize - offsetX
          const y = row * effectiveFontSize - offsetY

          const tileId = animationPattern === "grids" && gridsTileLookup ? gridsTileLookup[col][row] : -1
          const tile = tileId !== -1 ? gridTiles[tileId] : null
          const inTileBounds = !!tile

          const isCornerMasked = (() => {
            if (!tile) return false
            const w = tile.currentW ?? tile.targetW
            const h = tile.currentH ?? tile.targetH
            const rx = col - tile.x
            const ry = row - tile.y
            const r = Math.max(0, gridsCornerRadiusChars)
            if (r <= 0) return false

            const inTL = rx < r && ry < r
            const inTR = rx >= w - r && ry < r
            const inBL = rx < r && ry >= h - r
            const inBR = rx >= w - r && ry >= h - r
            if (!(inTL || inTR || inBL || inBR)) return false

            const cx = inTL || inBL ? r - 1 : w - r
            const cy = inTL || inTR ? r - 1 : h - r
            const dx = rx - cx
            const dy = ry - cy
            return dx * dx + dy * dy >= r * r
          })()

          // Character change logic based on animation pattern
          if (!cell.isEmphasized) {
            let changeChance = 0.3 // Default chance to change character
            
            switch (animationPattern) {
              case "rain":
                // Matrix-style rain - character changes based on column activity
                const rainColumn = rainColumns[col]
                if (rainColumn.active) {
                  // Calculate head and tail positions
                  const headRow = Math.floor(rainColumn.headPosition)
                  const tailRow = Math.floor(rainColumn.headPosition - rainColumn.length)
                  
                  // Leading character changes every frame
                  if (row === headRow) {
                    changeChance = 1.0 // Always change the leading character
                  }
                  // Characters in the trail change less frequently
                  else if (row < headRow && row > tailRow) {
                    const distanceFromHead = headRow - row
                    changeChance = 0.3 * Math.max(0.2, 1 - (distanceFromHead / rainColumn.length))
                  }
                  // Characters outside the trail rarely change
                  else {
                    changeChance = 0.01
                  }
                } else {
                  changeChance = 0.01 // Very low chance when column not active
                }
                break
                
              case "wave":
                // Characters change based on wave position
                changeChance = (Math.sin(frameCount * 0.05 + row * 0.2) + 1) * 0.2
                break
                
              case "ripple":
                // Characters near ripple edges change more frequently
                let rippleChangeChance = 0
                for (const ripple of rippleCenters) {
                  const distance = Math.sqrt(Math.pow(col - ripple.x, 2) + Math.pow(row - ripple.y, 2))
                  const rippleEdge = ripple.phase * 10
                  const proximity = Math.abs(distance - rippleEdge)
                  if (proximity < 2) {
                    rippleChangeChance = Math.max(rippleChangeChance, 0.8)
                  }
                }
                changeChance = Math.max(changeChance, rippleChangeChance)
                break
                
              case "random":
              default:
                // Random animation (default) - no changes to initial values
                break
            }
            
            if (frameCount - cell.lastChange > (60 + Math.random() * 120) / animationSpeed) {
              if (Math.random() < changeChance) {
                cell.char = charArray[Math.floor(Math.random() * charArray.length)]
                cell.lastChange = frameCount
              }
            }
          }

          // Update cell phase based on animation pattern
          switch (animationPattern) {
            case "rain":
              // Matrix-style rain effect - column-based animation
              const rainColumn = rainColumns[col]
              if (rainColumn.active) {
                // Calculate head and tail positions
                const headRow = Math.floor(rainColumn.headPosition)
                const tailRow = Math.floor(rainColumn.headPosition - rainColumn.length)
                
                // Leading character is brightest (white/bright green)
                if (row === headRow) {
                  cell.intensity = rainColumn.leadCharBrightness
                }
                // Characters in the trail have decreasing intensity
                else if (row < headRow && row > tailRow) {
                  const distanceFromHead = headRow - row
                  cell.intensity = Math.max(0.2, 1 - (distanceFromHead / rainColumn.length) * 0.8)
                }
                // Characters outside the trail have low intensity
                else {
                  cell.intensity = 0.1 + Math.random() * 0.05
                }
              } else {
                cell.intensity = 0.1 + Math.random() * 0.05
              }
              
              // Update phase at different rates based on position in column
              cell.phase += cell.speed * (rainColumn.active && row <= Math.floor(rainColumn.headPosition) ? 1.5 : 0.3)
              break
              
            case "wave":
              // Wave effect - synchronized horizontal waves
              cell.phase += cell.speed
              break
              
            case "ripple":
              // Ripple effect - update based on distance from ripple centers
              let maxRippleEffect = 0
              for (const ripple of rippleCenters) {
                const distance = Math.sqrt(Math.pow(col - ripple.x, 2) + Math.pow(row - ripple.y, 2))
                const rippleEdge = ripple.phase * 10
                const proximity = Math.abs(distance - rippleEdge)
                
                // Calculate fade factor based on ripple age
                // Ripples start fading after phase 8, fully fade by phase 15
                const fadeFactor = ripple.phase < 8 ? 1 : Math.max(0, 1 - (ripple.phase - 8) / 7)
                
                if (proximity < 3) {
                  const effectStrength = ((3 - proximity) / 3) * fadeFactor
                  maxRippleEffect = Math.max(maxRippleEffect, effectStrength)
                }
              }
              cell.phase += cell.speed * (1 + maxRippleEffect * 2)
              cell.rippleIntensity = maxRippleEffect
              break
              
            case "random":
            default:
              // Default random animation
              cell.phase += cell.speed
              break
          }

          let opacity = 0.1
          let green = 100

          switch (cell.animationType) {
            case "pulse":
              opacity = (Math.sin(cell.phase) * 0.4 + 0.6) * cell.intensity
              green = Math.floor(255 * opacity)
              break

            case "flicker":
              if (Math.random() < 0.05) {
                opacity = Math.random() * 0.9 + 0.1
              } else {
                opacity = Math.sin(cell.phase * 2) * 0.3 + 0.4
              }
              opacity *= cell.intensity
              green = Math.floor(255 * opacity)
              break

            case "wave":
              const waveOffset = (col + row) * 0.1
              opacity = (Math.sin(cell.phase + waveOffset) * 0.5 + 0.5) * cell.intensity
              green = Math.floor(255 * opacity)
              break

            case "strobe":
              opacity = Math.sin(cell.phase * 8) > 0.7 ? 0.9 * cell.intensity : 0.1 * cell.intensity
              green = Math.floor(255 * opacity)
              break

            case "fade":
              const fadePhase = (cell.phase % (Math.PI * 4)) / (Math.PI * 4)
              opacity = (Math.sin(fadePhase * Math.PI) * 0.8 + 0.2) * cell.intensity
              green = Math.floor(255 * opacity)
              break
          }

          // Apply additional opacity effects based on animation pattern
          if (!cell.isEmphasized) {
            switch (animationPattern) {
              case "rain":
                // Matrix-style rain - no additional opacity changes needed
                // (already handled in the cell.intensity setting above)
                break
              
              case "grids":
                // Dim the background field so the tile regions read brighter by contrast.
                // We also treat corner-masked cells as background so tiles can look rounded.
                if (!inTileBounds || isCornerMasked) {
                  opacity *= gridsBackgroundOpacityScale
                }
                break
                
              case "wave":
                // Wave effect - add wave-based brightness
                opacity *= 0.5 + Math.abs(Math.sin(frameCount * 0.02 + row * 0.2)) * 0.5
                break
                
              case "ripple":
                // Ripple effect - cells near ripple edges are brighter
                let maxRippleIntensity = 0
                for (const ripple of rippleCenters) {
                  const distance = Math.sqrt(Math.pow(col - ripple.x, 2) + Math.pow(row - ripple.y, 2))
                  const rippleEdge = ripple.phase * 10
                  const proximity = Math.abs(distance - rippleEdge)
                  
                  // Calculate fade factor based on ripple age
                  const fadeFactor = ripple.phase < 8 ? 1 : Math.max(0, 1 - (ripple.phase - 8) / 7)
                  
                  if (proximity < 2) {
                    const effectStrength = ((2 - proximity) / 2) * fadeFactor
                    maxRippleIntensity = Math.max(maxRippleIntensity, effectStrength)
                  }
                }
                
                // Apply ripple intensity multiplier and store for color interpolation
                maxRippleIntensity *= rippleIntensity
                cell.rippleIntensity = maxRippleIntensity
                
                opacity *= 0.4 + maxRippleIntensity * 0.6
                break
            }
          }

          if (cell.isEmphasized) {
            const currentEmphasizedSize = emphasizedSize || fontSize
            if (currentEmphasizedSize !== fontSize) {
              ctx.font = `${currentEmphasizedSize}px ${customFont}, monospace`
            }

            const pulse = emphasizedPulse ? Math.sin(frameCount * 0.05 * animationSpeed) * 0.3 + 0.7 : 1
            const glow = emphasizedGlow ? Math.sin(frameCount * 0.03 * animationSpeed) * 0.3 + 0.7 : 0.5

            if (emphasizedGlow) {
              ctx.shadowColor = `rgba(${emphasizedColor}, ${glow * 0.6})`
              ctx.shadowBlur = 8
            }

            ctx.fillStyle = `rgba(${emphasizedColor}, ${pulse})`
          } else {
            if (emphasizedSize && emphasizedSize !== fontSize) {
              ctx.font = `${fontSize}px ${customFont}, monospace`
            }

            // Check if this cell is in a ripple with significant intensity
            const rippleEffect = cell.rippleIntensity || 0
            
            if (rippleEffect > 0.3) {
              // Strong ripple: interpolate between low and high colors
              const lowRGB = rippleLowColor.split(',').map(c => parseInt(c.trim()))
              const highRGB = rippleHighColor.split(',').map(c => parseInt(c.trim()))
              const interpolatedR = Math.floor(lowRGB[0] + (highRGB[0] - lowRGB[0]) * rippleEffect)
              const interpolatedG = Math.floor(lowRGB[1] + (highRGB[1] - lowRGB[1]) * rippleEffect)
              const interpolatedB = Math.floor(lowRGB[2] + (highRGB[2] - lowRGB[2]) * rippleEffect)
              
              ctx.fillStyle = `rgba(${interpolatedR}, ${interpolatedG}, ${interpolatedB}, ${opacity})`
            } else if (animationPattern !== "grids" && Math.random() < flashFrequency) {
              // Random bright flash with configurable intensity
              ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(opacity * maxFlashIntensity, maxFlashIntensity)})`
            } else {
              // Normal color
              ctx.fillStyle = `rgba(${primaryColor}, ${opacity})`
            }
          }

          if (!cell.isEmphasized && animationPattern === "grids" && tile && !isCornerMasked) {
            const denom = Math.max(1, gridsTileCharChangeEveryFrames)
            const tick = Math.floor(frameCount / denom)
            const n = tile.seed ^ (col * 374761393) ^ (row * 668265263) ^ (tick * 1442695041)
            const tileChar = charArray[hashU32(n) % Math.max(1, charArray.length)]
            cell.char = tileChar

            const tilePulse = Math.sin((frameCount + tile.seed) * 0.012) * gridsTileOpacityPulse
            const tileOpacity = Math.min(0.85, Math.max(0.05, gridsTileOpacityBase + tilePulse))
            ctx.fillStyle = `rgba(${primaryColor}, ${tileOpacity})`
          }

          ctx.fillText(cell.char, x, y)

          if (cell.isEmphasized && emphasizedGlow) {
            ctx.shadowColor = "transparent"
            ctx.shadowBlur = 0
          }
        }
      }

      if (emphasizedMessages.length > 0) {
        const currentTime = Date.now()
        const message = emphasizedMessages[messageIndex]
        
        // State machine for message animation
        switch (animationState) {
          case "typing":
            // Typing animation phase
            if (typingProgress < message.length) {
              typingProgress = Math.min(typingProgress + (currentTime - lastMessageTime) / (1000 / typingSpeed), message.length)
              lastMessageTime = currentTime
            } else {
              // Typing complete, move to display state
              animationState = "display"
              lastMessageTime = currentTime
            }
            break;
            
          case "display":
            // Display phase - keep message visible for messageDuration
            if (currentTime - lastMessageTime > messageDuration) {
              // Display time complete, move to fade out
              animationState = "fadeOut"
              lastMessageTime = currentTime
              fadeOutProgress = 0
            }
            break;
            
          case "fadeOut":
            // Fade out phase
            fadeOutProgress = Math.min((currentTime - lastMessageTime) / fadeOutDuration, 1)
            if (fadeOutProgress >= 1) {
              // Fade out complete, move to next message
              messageIndex = (messageIndex + 1) % emphasizedMessages.length
              typingProgress = 0
              fadeOutProgress = 0
              animationState = "typing"
              lastMessageTime = currentTime
            }
            break;
        }

        // Display the current message with appropriate animation
        const displayedMessage = message.substring(0, Math.floor(typingProgress))
        
        // Split message into lines for multi-line support
        const messageLines = displayedMessage.split("\n")
        
        // Calculate maximum line length for clearing area
        const maxLineLength = Math.max(...messageLines.map(line => line.length), 1)
        
        // Clear previous message characters first (to handle different message lengths)
        for (let col = 0; col < columns; col++) {
          for (let row = 0; row < rows; row++) {
            // Check if this cell is in any potential line of text
            let isMessageCell = false
            for (let lineIndex = 0; lineIndex < Math.max(messageLines.length, 5); lineIndex++) {
              const lineY = textStartY + Math.floor(lineIndex * lineHeight * fontSize / effectiveFontSize)
              if (row === lineY) {
                // For center alignment, check within the centered area
                if (textAlignment === "center") {
                  const potentialMaxWidth = Math.max(...emphasizedMessages.map(getMaxLineLength))
                  const clearStartX = Math.round(centerX - potentialMaxWidth / 2)
                  if (col >= clearStartX && col < clearStartX + potentialMaxWidth) {
                    isMessageCell = true
                    break
                  }
                } 
                // For left alignment, check from the start position
                else if (col >= textStartX && col < textStartX + maxMessageLength) {
                  isMessageCell = true
                  break
                }
              }
            }
            
            if (isMessageCell) {
              // Reset emphasized cells that are not part of the current message
              if (grid[col][row].isEmphasized) {
                grid[col][row].isEmphasized = false;
                grid[col][row].char = charArray[Math.floor(Math.random() * charArray.length)];
              }
            }
          }
        }
        
        // Apply current message with proper alignment and multi-line support
        for (let lineIndex = 0; lineIndex < messageLines.length; lineIndex++) {
          const line = messageLines[lineIndex]
          
          // Calculate line position based on alignment
          let lineStartX = textStartX
          if (textAlignment === "center") {
            lineStartX = Math.round(centerX - line.length / 2)
          }
          
          // Calculate vertical position with line height
          const lineStartY = textStartY + Math.floor(lineIndex * lineHeight * fontSize / effectiveFontSize)
          
          // Render each character in the line
          for (let charIndex = 0; charIndex < line.length; charIndex++) {
            const col = lineStartX + charIndex
            const row = lineStartY
            
            if (col >= 0 && col < columns && row >= 0 && row < rows) {
              grid[col][row].char = line[charIndex]
              grid[col][row].isEmphasized = true
              
              // Apply fade-out effect if in fadeOut state
              if (animationState === "fadeOut") {
                grid[col][row].intensity = Math.max(0.2, 1 - fadeOutProgress)
              } else {
                grid[col][row].intensity = 1
              }
            }
          }
        }
      }

      // Draw vignette overlay
      if (vignetteEnabled) {
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY)
        const vignetteRadius = maxRadius * vignetteSpread
        
        const gradient = ctx.createRadialGradient(centerX, centerY, vignetteRadius, centerX, centerY, maxRadius)
        gradient.addColorStop(0, `rgba(${vignetteColor}, 0)`)
        gradient.addColorStop(1, `rgba(${vignetteColor}, ${vignetteIntensity})`)
        
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationFrameId != null) {
        cancelAnimationFrame(animationFrameId)
      }
    }
}
