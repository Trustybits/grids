# Bento Theme for Grids

## Overview

The Bento theme is a custom theme inspired by [Bento.me](https://bento.me), featuring a soft, warm aesthetic with gradient backgrounds, rounded corners, pastel colors, and subtle shadows.

## Design Philosophy

The Bento theme captures Bento's signature design characteristics:

- **Soft, Warm Gradients**: Background uses a multi-stop gradient from `#faf8f3` to `#f5f1e8` to `#fff9f0`
- **Glassmorphism**: Tiles use semi-transparent backgrounds (`rgba(255, 255, 255, 0.85)`) with backdrop blur
- **Subtle Borders**: Minimal borders with very low opacity (`rgba(0, 0, 0, 0.06)`)
- **Enhanced Roundness**: Border radius increased to 24px for tiles (vs 32px in other themes)
- **Elevated Shadows**: Multi-layered soft shadows for depth
- **Pastel Accent Colors**: All brand colors softened to match Bento's aesthetic

## Key Features

### Color Palette

#### Core Colors
- **Background**: `#faf8f3` with gradient overlay
- **Tile Background**: `rgba(255, 255, 255, 0.85)` (semi-transparent white)
- **Tile Border**: `rgba(0, 0, 0, 0.06)` (barely visible)
- **Text Primary**: `#2d2d2d` (warm dark gray)

#### Custom Bento Accent Colors
- **Peach**: `#ffb5a7`
- **Mint**: `#b5e7d3`
- **Lavender**: `#d4c5f9`
- **Butter**: `#ffe4b5`
- **Sky**: `#b8d8ff`
- **Coral**: `#ffcdb8`

#### Softened Brand Colors
All standard brand colors (Instagram, YouTube, Figma, etc.) have been softened to match Bento's pastel aesthetic:
- **Substack**: `#ff9775` (vs `#ff6719`)
- **Instagram Yellow**: `#ffd95f` (vs `#ffd600`)
- **Figma Purple**: `#a77fff` (vs `#874fff`)
- And more...

### Visual Effects

#### Shadows
```scss
--shadow-tile: 0 4px 16px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.02);
--shadow-tile-hover: 0 8px 24px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04);
```

#### Border Radius
```scss
--tile-border-radius: 24px;
--radius-sm: 12px;
--radius-md: 20px;
--radius-lg: 28px;
--radius-xl: 32px;
```

#### Backdrop Filter
Tiles use enhanced backdrop filtering:
```scss
backdrop-filter: blur(20px) saturate(180%);
```

### Hover Effects

Tiles in the Bento theme have special hover interactions:
- **Shadow Enhancement**: Shadow increases from 4px to 8px elevation
- **Lift Effect**: Tiles lift up 2px on hover (`transform: translateY(-2px)`)
- **Smooth Transitions**: All transitions use `var(--duration-normal)` and `var(--easing-smooth)`

## Implementation Details

### Theme Structure

The Bento theme is defined in three places:

1. **`src/styles/themes.scss`**: CSS custom properties and body class styling
2. **`src/themes/index.ts`**: Theme registry with color definitions
3. **`src/components/ThemeToggle.vue`**: Theme switcher with Bento icon

### CSS Architecture

```scss
body.theme-bento {
  background: linear-gradient(135deg, #faf8f3 0%, #f5f1e8 50%, #fff9f0 100%);
  background-attachment: fixed; // Prevents gradient from scrolling
}

body.theme-bento .card-body {
  backdrop-filter: blur(20px) saturate(180%);
  box-shadow: var(--shadow-tile);
}

body.theme-bento .tile-wrapper:hover .card-body {
  box-shadow: var(--shadow-tile-hover);
  transform: translateY(-2px);
}
```

### Theme Cycling

The theme toggle button now cycles through three themes:
1. **Light** (sun icon)
2. **Bento** (grid icon)
3. **Dark** (moon icon)

## Usage

### Switching to Bento Theme

Users can cycle to the Bento theme by clicking the theme toggle button in the top-right corner. The button will show a 2x2 grid icon when Bento theme is active.

### Programmatic Usage

```typescript
import { useThemeStore } from '@/stores/theme';

const themeStore = useThemeStore();
themeStore.setTheme('bento');
```

### Checking Current Theme

```typescript
const themeStore = useThemeStore();
const isBentoTheme = themeStore.currentThemeId === 'bento';
```

## Browser Compatibility

The Bento theme uses modern CSS features:
- `backdrop-filter` (supported in all modern browsers)
- CSS custom properties (supported in all modern browsers)
- `rgba()` colors (universal support)
- Multi-stop gradients (universal support)
- `background-attachment: fixed` (universal support)

**Note**: `backdrop-filter` may have reduced performance on older devices.

## Performance Considerations

1. **Fixed Gradient Background**: Uses `background-attachment: fixed` for a smooth, non-scrolling gradient
2. **GPU Acceleration**: `backdrop-filter` is GPU-accelerated for smooth performance
3. **Will-change Hints**: Applied where appropriate to optimize animations
4. **Transform-based Animations**: All hover effects use `transform` for 60fps performance

## Customization

To customize the Bento theme colors:

1. Edit `src/themes/index.ts` for the theme registry colors
2. Edit `src/styles/themes.scss` for CSS custom properties
3. Adjust gradient stops in the `background` property for different warmth

### Example: Adjusting Background Warmth

```scss
// Warmer gradient
background: linear-gradient(135deg, #fff9f0 0%, #fff3e0 50%, #ffe4d0 100%);

// Cooler gradient
background: linear-gradient(135deg, #f5f5f5 0%, #eeeeee 50%, #e8e8e8 100%);
```

## Accessibility

- **Contrast Ratios**: All text meets WCAG AA standards for contrast
- **Focus States**: Maintained from base theme
- **Color Independence**: No information conveyed by color alone
- **Theme Preference**: Respects user's stored theme preference

## Future Enhancements

Potential improvements for the Bento theme:
- [ ] Per-tile gradient overlays
- [ ] Animated gradient on page load
- [ ] Custom Bento-themed illustrations
- [ ] Additional pastel color variants
- [ ] Seasonal gradient palettes
- [ ] Dark mode variant with purple/blue gradients

## Credits

Inspired by the beautiful design work of the Bento team at [bento.me](https://bento.me).

## Related Files

- `src/styles/themes.scss` - Theme CSS definitions
- `src/themes/index.ts` - Theme registry
- `src/stores/theme.ts` - Theme store logic
- `src/components/ThemeToggle.vue` - Theme switcher UI
- `src/types/theme.ts` - TypeScript theme interfaces
