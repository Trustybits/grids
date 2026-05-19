// src/types/tiptap.d.ts

import '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /**
       * Sets the font size of the selected text.
       */
      setFontSize: (fontSize: string) => ReturnType;

      /**
       * Removes the font size from the selected text.
       */
      unsetFontSize: () => ReturnType;
    };
  }
}
