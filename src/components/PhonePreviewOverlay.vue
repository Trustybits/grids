<template>
  <div class="preview-wrapper" :class="`preview-wrapper--${mode}`">
    <!--
      Single always-mounted content area.
      CSS classes drive the phone/tablet visual appearance.
      The phone image is an absolutely-positioned pointer-events:none overlay
      so the Grid inside the slot is never unmounted on mode change.
    -->
    <div class="content-outer" :class="`content-outer--${mode}`">
      <div class="content-inner" :class="`content-inner--${mode}`">
        <!-- In mobile mode, content-render applies the scale transform so the
             grid renders at a real phone width (390px) and is scaled down to
             fit the 300px visible phone screen — text, icons, and padding all
             shrink proportionally. -->
        <div class="content-render" :class="`content-render--${mode}`">
          <slot :container-width="effectiveContainerWidth" />
        </div>
      </div>
      <img
        v-if="mode === 'mobile' && !isRealDevice"
        class="phone-image-overlay"
        src="@/assets/images/mobile.png"
        alt=""
        aria-hidden="true"
      />
    </div>

    <!-- QR code below phone frame (desktop browsers only) -->
    <div v-if="mode === 'mobile' && !isRealDevice && qrDataUrl" class="qr-section">
      <img class="qr-code" :src="qrDataUrl" alt="QR code to preview on phone" />
      <p class="qr-label">Scan to preview on your phone</p>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch } from 'vue';
import QRCode from 'qrcode';
import { useDeviceType } from '@/composables/useDeviceType';

// Phone frame image is 320px wide. The visible screen area inside the bezel is ~300px.
// We render the grid at PHONE_RENDER_WIDTH (a real iPhone CSS width) then CSS-scale
// it down to PHONE_SCREEN_WIDTH so that text, icons, and padding all shrink together.
const PHONE_SCREEN_WIDTH = 300;  // visible screen area (px)
const PHONE_RENDER_WIDTH = 390;  // grid renders at this width  (standard iPhone)
const TABLET_SCREEN_WIDTH = 786;

export default defineComponent({
  name: 'PhonePreviewOverlay',
  props: {
    mode: {
      type: String as () => 'desktop' | 'tablet' | 'mobile',
      default: 'desktop',
    },
    url: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    const { isRealDevice } = useDeviceType();
    const qrDataUrl = ref('');

    const generateQr = async (url: string) => {
      if (!url) return;
      try {
        qrDataUrl.value = await QRCode.toDataURL(url, {
          width: 160,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#00000000',
          },
        });
      } catch (e) {
        console.error('QR generation failed', e);
      }
    };

    watch(() => props.url, (url) => generateQr(url), { immediate: true });
    watch(() => props.mode, (mode) => {
      if (mode === 'mobile') generateQr(props.url);
    });

    const effectiveContainerWidth = computed(() => {
      if (props.mode === 'mobile') return isRealDevice ? 0 : PHONE_RENDER_WIDTH;
      if (props.mode === 'tablet') return isRealDevice ? 0 : TABLET_SCREEN_WIDTH;
      return 0;
    });

    return { qrDataUrl, PHONE_SCREEN_WIDTH, TABLET_SCREEN_WIDTH, isRealDevice, effectiveContainerWidth };
  },
});
</script>

<style scoped lang="scss">
.preview-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Content outer wrapper ───────────────────────────────── */
.content-outer {
  &--mobile {
    /* Size matches the phone image natural dimensions (494×1070) at 320px wide */
    position: relative;
    width: 320px;
    aspect-ratio: 494 / 1070;
    flex-shrink: 0;
    overflow: hidden;
  }

  &--tablet {
    width: 810px;
    border: 12px solid color-mix(in srgb, var(--color-tile-stroke) 34%, transparent);
    border-radius: 48px;
    overflow: hidden;
    background: var(--color-content-background);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
  }

  /* Desktop / real device: no special chrome */
  &--desktop {
    width: 100%;
  }
}

/* ── Content inner — clip boundary ──────────────────────── */
.content-inner {
  &--mobile {
    /* Positioned to match the transparent screen area of mobile.png.
       The image is 494×1070px. Insets as percentages:
         top/bottom: 14/1070 ≈ 1.3%  → use 1.8% for bezel safety
         left/right: 14/494  ≈ 2.8%  → use 3.2% for bezel safety */
    position: absolute;
    top: 1.8%;
    left: 3.2%;
    right: 3.2%;
    bottom: 0.5%;
    border-radius: 45px;
    overflow: hidden;
    z-index: 1;
    background: var(--color-content-background);
  }

  &--tablet {
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    max-height: 1080px;
  }

}

/* ── Content render — scale transform ───────────────────── */
/* Renders at real phone width then scales down so everything
   (text, icons, padding) shrinks proportionally.            */
.content-render {
  &--mobile {
    // Render at iPhone width (390px), scale to phone screen width (300px)
    // scale = 300 / 390 ≈ 0.769
    width: 390px;
    transform: scale(0.769);
    transform-origin: top left;
  }

  &--tablet,
  &--desktop {
    width: 100%;
  }
}

/* ── Phone image overlay ─────────────────────────────────── */
/* Sits on top of the content (z-index 2) but passes all pointer events through */
.phone-image-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
  user-select: none;
  z-index: 2;
}

/* ── QR section ──────────────────────────────────────────── */
.qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-lg);
}

.qr-code {
  width: 120px;
  height: 120px;
  border-radius: var(--radius-sm);
  background: white;
  padding: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.qr-label {
  font-size: var(--font-size-xs, 11px);
  color: var(--color-content-low);
  margin: 0;
  text-align: center;
}
</style>
