<template>
  <div class="clicker-container">
    <div class="clicker-content">
      <div class="count-display">{{ content.count }}</div>
      
      <button 
        class="click-button" 
        :class="{ 'on-fire': isOnFire }"
        @click="handleClick"
      >
        <FireIcon v-if="isOnFire" :size="24" />
        <ClickerIcon v-else :size="24" />
      </button>
      
      <div class="footer">
        <div class="high-score">
          Best: {{ content.highScore }}
        </div>
        
        <button v-if="content.count > 0" class="reset-button" @click="resetCount">
          Start Fresh
        </button>
      </div>
      
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onUnmounted } from "vue";
import { type ClickerContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";
import ClickerIcon from "@/components/icons/ClickerIcon.vue";
import FireIcon from "@/components/icons/FireIcon.vue";

export default defineComponent({
  components: {
    ClickerIcon,
    FireIcon,
  },
  props: {
    content: {
      type: Object as () => ClickerContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const isOnFire = ref(false);
    const lastClickTime = ref(0);
    const clickStreak = ref(0);
    let cooldownTimer: ReturnType<typeof setTimeout> | null = null;

    const handleClick = () => {
      props.content.count++;
      
      if (props.content.count > props.content.highScore) {
        props.content.highScore = props.content.count;
      }
      
      // Check click speed (clicks within 500ms = fast clicking)
      const now = Date.now();
      const timeSinceLastClick = now - lastClickTime.value;
      
      if (timeSinceLastClick < 500) {
        clickStreak.value++;
        
        // Activate fire mode after 3 fast clicks
        if (clickStreak.value >= 3) {
          isOnFire.value = true;
        }
      } else {
        clickStreak.value = 0;
        isOnFire.value = false;
      }
      
      lastClickTime.value = now;
      
      // Clear existing cooldown timer
      if (cooldownTimer) {
        clearTimeout(cooldownTimer);
      }
      
      // Set cooldown to turn off fire mode after 800ms of no clicks
      cooldownTimer = setTimeout(() => {
        isOnFire.value = false;
        clickStreak.value = 0;
      }, 800);
      
      layoutStore.saveLayout();
    };

    const resetCount = () => {
      props.content.count = 0;
      isOnFire.value = false;
      clickStreak.value = 0;
      layoutStore.saveLayout();
    };

    onUnmounted(() => {
      if (cooldownTimer) {
        clearTimeout(cooldownTimer);
      }
    });

    return {
      handleClick,
      resetCount,
      isOnFire,
    };
  },
});
</script>

<style scoped lang="scss">
.clicker-container {
  width: 100%;
  height: 100%;
  padding: var(--spacing-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.clicker-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  width: 100%;
}

.count-display {
  font-size: 48px;
  font-weight: 700;
  color: var(--color-text-primary);
  font-family: var(--font-family-base);
  line-height: 1;
  user-select: none;
}

.click-button {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-text-primary);
  color: var(--color-tile-background);
  border: none;
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s ease, background 0.3s ease, opacity 0.2s ease;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &.on-fire {
    background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
    animation: fireGlow 1.5s ease-in-out infinite;
  }
}

@keyframes fireGlow {
  0%, 100% {
    box-shadow: 0 0 10px rgba(255, 107, 53, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 107, 53, 0.8), 0 0 30px rgba(247, 147, 30, 0.4);
  }
}

.footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-md);
}

.high-score {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-content-default);
  text-align: center;
  user-select: none;
}

.reset-button {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: transparent;
  color: var(--color-content-low);
  border: 1px solid var(--color-content-low);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  
  &:hover {
    color: var(--color-text-primary);
    border-color: var(--color-text-primary);
  }
}
</style>
