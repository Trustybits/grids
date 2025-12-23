<template>
  <!-- <div class="w-fit p-3 d-flex gap-2 flex-column flex-wrap h-100 justify-content-start align-items-start"> -->
  <div class="linkTile">
    <div class="favicon">
      <img :src="content.faviconUrl" />
    </div>
    <!-- <p v-if="type === 'A'" class="mt-2">{{ content.domain }}</p> -->
    <p class="tileDomain">{{ content.domain }}</p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { type LinkContent } from "@/types/TileContent";

export default defineComponent({
  props: {
    content: {
      type: Object as () => LinkContent,
      required: true,
    },
  },
  setup(props) {
    const onShortClick = (data: { id: string; content: any }) => {
      const url = props.content.link.startsWith("http")
        ? props.content.link
        : `https://${props.content.link}`;
      window.open(url, "_blank");
    };

    return {
      onShortClick
    }
  },
});
</script>

<style scoped>
.favicon {
  overflow: hidden;
  border-radius: 10px;
  width: 40px;
  height: 40px;
  min-height: 40px;
  min-width: 40px;
  /* box-shadow: 0 0px 5px rgba(0, 0, 0, 0.2); */
}

.favicon img {
  width: 100%;
}

.linkTile {
  /* clip-path: content-box; */
  height: 100%;
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;
  row-gap: 12px;
  column-gap: 20px;
  justify-content: top;
  align-items: left;
  overflow: hidden;
  padding: 18px;
  font-family: 'Inter';
}

.tileDomain {
  margin: 0px;
  width: 100%;
  display: flex;
  justify-content: left;
}
</style>