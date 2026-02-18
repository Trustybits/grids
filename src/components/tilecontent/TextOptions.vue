<template>
  <div class="text-options">
    <!-- Font Selection -->
    <select
      class="fontSelector"
      v-model="currentFontFamily"
      @change="changeFont"
    >
      <option value="Inter">Inter</option>
      <option value="Times New Roman">Times New</option>
      <option value="Geist Mono">Geist Mono</option>
      <option value="Lobster">Lobster</option>
    </select>

    <!-- Font Size Selection -->
    <select class="fontSize" v-model="currentFontSize" @change="changeFontSize">
      <option value="12px">Small</option>
      <option value="14px">Medium</option>
      <option value="20px">Large</option>
      <option value="26px">Larger</option>
    </select>

    <!-- Bold Toggle -->
    <button :class="{ active: editor?.isActive('bold') }" @click="toggleBold">
      <b><img src="/src/svgs/icons/boldToggle.svg" /></b>
    </button>

    <!-- Italic Toggle -->
    <button
      :class="{ active: editor?.isActive('italic') }"
      @click="toggleItalic"
    >
      <i><img src="/src/svgs/icons/italicToggle.svg" /></i>
    </button>

    <!-- <label for="vol">Volume (between 0 and 50):</label>
    <input type="range" id="vol" name="vol" min="0" max="50"> -->

    <div class="listDropdown">
      <button @click="toggleListTypeMenu" class="listButton">
        <img src="/src/svgs/icons/bulletList.svg" />
      </button>
      <div v-show="showListOptions" id="listOptions" class="listTypeOptions">
        <!-- Bullet Point Toggle -->
        <button
          :class="{ active: editor?.isActive('bulletList') }"
          @click="toggleBullet"
          ref="toggleButton"
        >
          <img src="/src/svgs/icons/bulletList.svg" />
        </button>

        <!-- Numbered List Toggle -->
        <button
          :class="{ active: editor?.isActive('orderedList') }"
          @click="toggleNumberList"
        >
          <img src="/src/svgs/icons/numberedList.svg" />
        </button>

        <!-- Checkmark Toggle -->
        <button
          :class="{ active: editor?.isActive('taskList') }"
          @click="toggleCheckmark"
        >
          <img src="/src/svgs/icons/checkList.svg" />
        </button>
      </div>
    </div>

    <!-- Text Color Selection -->
    <input
      class="colorSelector"
      type="color"
      @input="changeColor"
      :value="rgbToHex(editor.getAttributes('textStyle').color) || '#ffffff'"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watchEffect } from "vue";
import type { PropType } from "vue";

const showListOptions = ref(false);

/* When the user clicks on the button,
toggle between hiding and showing the dropdown content */
function toggleListTypeMenu() {
  showListOptions.value = !showListOptions.value;
  // console.log(showListOptions.value);
}

const toggleButton = ref(null);

onMounted(() => {
  document.addEventListener("click", (e) => {
    if (e.target == toggleButton.value) return;
    toggleListTypeMenu();
  });
});

export default defineComponent({
  props: {
    editor: {
      type: Object as PropType<any>,
      required: true,
    },
  },
  setup(props) {
    const currentFontFamily = ref("Arial");
    const currentFontSize = ref("14px");

    // Watch for editor updates
    watchEffect(() => {
      const fontAttributes = props.editor?.getAttributes("textStyle");
      currentFontFamily.value = fontAttributes?.fontFamily || "Arial";
      currentFontSize.value = fontAttributes?.fontSize || "14px";
    });

    // Commands
    const toggleBold = () => {
      props.editor.chain().focus().toggleBold().run();
    };

    const toggleItalic = () => {
      props.editor.chain().focus().toggleItalic().run();
    };

    const toggleBullet = () => {
      props.editor.chain().focus().toggleBulletList().run();
      toggleListTypeMenu();
    };

    const toggleNumberList = () => {
      props.editor.chain().focus().toggleOrderedList().run();
      toggleListTypeMenu();
    };

    const toggleCheckmark = () => {
      props.editor.chain().focus().toggleTaskList().run();
      toggleListTypeMenu();
    };

    const changeFont = (event: Event) => {
      const target = event.target as HTMLSelectElement;
      props.editor.chain().focus().setFontFamily(target.value).run();
    };

    const changeFontSize = (event: Event) => {
      const target = event.target as HTMLSelectElement;
      props.editor.chain().focus().setFontSize(target.value).run();
    };

    const changeColor = (event: Event) => {
      const target = event.target as HTMLInputElement;
      props.editor.chain().focus().setColor(target.value).run();
    };

    const rgbToHex = (rgbString: string) => {
      if (!rgbString) return "";

      const match = rgbString.match(/\d+/g);
      if (!match) return rgbString;

      const [r, g, b] = match.map(Number);
      return `#${((1 << 24) + (r << 16) + (g << 8) + b)
        .toString(16)
        .slice(1)
        .toUpperCase()}`;
    };

    return {
      currentFontFamily,
      currentFontSize,
      toggleBold,
      toggleItalic,
      toggleBullet,
      toggleNumberList,
      toggleCheckmark,
      changeFont,
      changeFontSize,
      changeColor,
      rgbToHex,
      showListOptions,
      toggleListTypeMenu,
      toggleButton,
    };
  },
});
</script>

<style scoped lang="scss">
.text-options {
  position: absolute;
  // left: 16px;
  top: -4px;
  left: 50%;
  transform: translate(-50%, -100%);
  display: flex;
  height: 52px;
  gap: 8px;
  padding: 0px 8px;
  border-radius: 34px;
  // font-size: 10px;
  width: fit-content;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.76);
  backdrop-filter: blur(50px);
  // flex-wrap: wrap;
}

select {
  border-radius: 20px;
  font-size: 16px;
  height: 40px;
  padding: 4px 8px;

  option {
    border-radius: 8px;
  }
}

button {
  padding: 0px;
  height: 44px;
  width: 44px;
  // border: 1px solid #ccc;
  background: none;
  cursor: pointer;
  border-radius: 22px;
  font-size: 10px;
}

button.active {
  background: #9747ff;
  font-weight: bold;
}

/* Dropdown Button */
.listButton {
  // background-color: #3498DB;
  color: white;
  // padding: 16px;
  // font-size: 16px;
  border: none;
  cursor: pointer;
}

/* Dropdown button on hover & focus */
.dropbtn:hover,
.dropbtn:focus {
  background-color: #2980b9;
}

/* The container <div> - needed to position the dropdown content */
.listDropdown {
  position: relative;
  display: inline-block;
}

/* Dropdown Content (Hidden by Default) */
.listTypeOptions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: absolute;
  top: -44px;
  background-color: #3c3c3c;

  box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.2);
  z-index: 11;
  border-radius: 20px;

  /* Buttons inside the dropdown */
  button {
    color: black;
    text-decoration: none;
    display: block;
  }
}

/* Change color of dropdown links on hover */
.listTypeOptions button:hover {
  background-color: rgba(221, 221, 221, 0.185);
}

/* Show the dropdown menu (use JS to add this class to the .dropdown-content container when the user clicks on the dropdown button) */
.show {
  display: block;
}

.colorSelector {
  // border-radius: 16px;
  -webkit-appearance: none;
  appearance: none;
  // -moz-appearance: none;
  // appearance: none;
  width: 32px;
  height: 32px;
  // background-color: transparent;
  border: none;
  border-radius: 16px;
  cursor: pointer;
}
.colorSelector::-webkit-color-swatch-wrapper {
  padding: 0;
}
.colorSelector::-webkit-color-swatch {
  border-radius: 16px;
  border: none;
}
// .colorSelector::-moz-color-swatch {
//   border-radius: 16px;
//   border: none;
// }
</style>
