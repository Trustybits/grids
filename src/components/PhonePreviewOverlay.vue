<template>
  <div class="preview-wrapper" :class="`preview-wrapper--${mode}`">
    <!-- Phone frame (mobile only, desktop browsers only) -->
    <div v-if="mode === 'mobile' && !isRealDevice" class="phone-frame">
      <div class="phone-screen">
        <div class="phone-screen-inner">
          <slot :container-width="PHONE_SCREEN_WIDTH" />
        </div>
      </div>
      <img class="phone-image" src="@/assets/images/mobile.png" alt="Phone frame" />
    </div>

    <!-- Pass-through on real mobile devices -->
    <template v-else-if="mode === 'mobile' && isRealDevice">
      <slot :container-width="0" />
    </template>

    <!-- Tablet frame (desktop browsers only) -->
    <div v-else-if="mode === 'tablet' && !isRealDevice" class="tablet-frame">
      <div class="tablet-screen">
        <slot :container-width="TABLET_SCREEN_WIDTH" />
      </div>
    </div>

    <!-- Pass-through on real tablet devices or desktop mode -->
    <template v-else>
      <slot :container-width="0" />
    </template>

    <!-- QR code below phone frame (desktop browsers only) -->
    <div v-if="mode === 'mobile' && !isRealDevice && qrDataUrl" class="qr-section">
      <img class="qr-code" :src="qrDataUrl" alt="QR code to preview on phone" />
      <p class="qr-label">Scan to preview on your phone</p>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue';
import QRCode from 'qrcode';
import { useDeviceType } from '@/composables/useDeviceType';

// Phone frame is 320px wide. The screen area (transparent region) is inset
// ~10px on each side from the frame edge.
const PHONE_FRAME_WIDTH = 320;
const PHONE_SCREEN_WIDTH = PHONE_FRAME_WIDTH - 20; // 300px usable
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

    return { qrDataUrl, PHONE_SCREEN_WIDTH, TABLET_SCREEN_WIDTH, isRealDevice };
  },
});
</script>

<style scoped lang="scss">
.preview-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Phone frame ─────────────────────────────────────────── */
.phone-frame {
  position: relative;
  width: 320px;
  flex-shrink: 0;
}

.phone-image {
  width: 100%;
  height: auto;
  display: block;
  pointer-events: none;
  user-select: none;
  /* Sits on top of the screen content */
  position: relative;
  z-index: 2;
}

.phone-screen {
  /* Positioned to match the transparent screen area of mobile.png.
     The image is 494×1070px. Screen starts ~14px from top, ~14px from sides,
     ~14px from bottom. As percentages of 494w × 1070h:
       top:    14/1070 ≈ 1.3%
       left:   14/494  ≈ 2.8%
       right:  14/494  ≈ 2.8%
       bottom: 14/1070 ≈ 1.3%
     We add a bit of extra padding to stay inside the bezel. */
  position: absolute;
  top: 1.8%;
  left: 3.2%;
  right: 3.2%;
  bottom: 1.8%;
  border-radius: 36px;
  overflow: hidden;
  z-index: 1;
  background: var(--color-content-background);
}

.phone-screen-inner {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  /* Thin scrollbar so it doesn't look out of place inside the phone */
  scrollbar-width: thin;
  scrollbar-color: var(--color-tile-stroke) transparent;
}

/* ── Tablet frame ────────────────────────────────────────── */
.tablet-frame {
  width: 810px;
  border: 12px solid color-mix(in srgb, var(--color-tile-stroke) 34%, transparent);
  border-radius: 48px;
  /* overflow:hidden clips tiles that would bleed outside the frame while scrolling */
  overflow: hidden;
  background: var(--color-content-background);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}

.tablet-screen {
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 1080px;
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
