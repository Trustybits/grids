# Bento Theme - Quick Start Guide

## How to Use

### For Users
1. Click the theme toggle button in the top-right corner
2. The button will cycle through: Light → Bento → Dark → Light
3. When Bento is active, you'll see a 2x2 grid icon
4. Your theme preference is automatically saved

### For Developers

#### Activate Bento Theme Programmatically
```typescript
import { useThemeStore } from '@/stores/theme';

const themeStore = useThemeStore();
themeStore.setTheme('bento');
```

#### Check if Bento Theme is Active
```typescript
const isBento = themeStore.currentThemeId === 'bento';
```

#### Get Current Theme Colors
```typescript
const theme = themeStore.currentTheme;
console.log(theme.colors.tileBackground); // rgba(255, 255, 255, 0.85)
```

## Key Visual Differences

| Feature | Light Theme | Bento Theme |
|---------|-------------|-------------|
| Background | Solid cream | Gradient cream |
| Tiles | Opaque | Semi-transparent |
| Borders | Solid dark | 6% opacity |
| Shadows | Standard | Multi-layered |
| Border Radius | 32px | 24px |
| Brand Colors | Vibrant | Pastels |

## CSS Variables Reference

### Colors
```scss
--color-content-background: #faf8f3
--color-tile-background: rgba(255, 255, 255, 0.85)
--color-tile-stroke: rgba(0, 0, 0, 0.06)
--color-text-primary: #2d2d2d
```

### Shadows
```scss
--shadow-tile: 0 4px 16px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.02)
--shadow-tile-hover: 0 8px 24px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04)
```

### Border Radius
```scss
--tile-border-radius: 24px
--radius-sm: 12px
--radius-md: 20px
--radius-lg: 28px
--radius-xl: 32px
```

## Creating Bento-Style Components

### Example: Custom Card
```vue
<template>
  <div class="bento-card">
    <h3>My Card</h3>
    <p>Content here</p>
  </div>
</template>

<style scoped>
.bento-card {
  background: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--tile-border-radius);
  padding: var(--tile-padding);
  box-shadow: var(--shadow-tile);
  backdrop-filter: blur(20px) saturate(180%);
  transition: all var(--duration-normal) var(--easing-smooth);
}

.bento-card:hover {
  box-shadow: var(--shadow-tile-hover);
  transform: translateY(-2px);
}
</style>
```

## Testing the Theme

### Manual Test Checklist
- [ ] Background gradient displays correctly
- [ ] Tiles are semi-transparent with blur
- [ ] Borders are subtle (barely visible)
- [ ] Hover effect lifts tiles up
- [ ] Shadows are soft and multi-layered
- [ ] Theme toggle shows correct icon
- [ ] Theme persists on page reload

### Browser Testing
- [ ] Chrome/Edge (backdrop-filter support)
- [ ] Firefox 103+ (backdrop-filter support)
- [ ] Safari (with -webkit- prefix)

## Troubleshooting

### Issue: Background gradient not showing
**Solution:** Check that `body.theme-bento` class is applied to `<body>` tag

### Issue: Tiles not transparent
**Solution:** Verify backdrop-filter is supported in your browser (not supported in IE11)

### Issue: Theme not persisting
**Solution:** Check localStorage for `themeId` key, ensure it's set to `'bento'`

### Issue: Colors look wrong
**Solution:** Clear browser cache, verify CSS is loading from `themes.scss`

## Best Practices

### DO ✅
- Use CSS variables for colors
- Apply backdrop-filter to glassmorphism elements
- Use multi-layer shadows for depth
- Test hover states
- Maintain generous padding

### DON'T ❌
- Hardcode Bento colors in components
- Use pure black borders
- Skip transition timing
- Forget Safari -webkit- prefixes
- Use tight spacing

## File Locations

- **Theme Definition**: `src/styles/themes.scss`
- **Theme Registry**: `src/themes/index.ts`
- **Theme Store**: `src/stores/theme.ts`
- **Theme Toggle UI**: `src/components/ThemeToggle.vue`
- **Documentation**: `BENTO_THEME.md`
- **CSS Reference**: `BENTO_CSS_REFERENCE.md`

## Support

For issues or questions about the Bento theme:
1. Check `BENTO_THEME.md` for comprehensive documentation
2. Review `BENTO_CSS_REFERENCE.md` for CSS implementation details
3. Inspect browser DevTools to verify CSS variables

## Version History

- **v1.0** - Initial Bento theme implementation
  - Gradient background
  - Glassmorphism tiles
  - Pastel color palette
  - Theme cycling support
