// gif.js ships no TypeScript types. Minimal shim covering the subset used by
// `useOGExport` (see https://github.com/jnordberg/gif.js#usage).
declare module "gif.js" {
  export interface GIFOptions {
    workers?: number;
    quality?: number;
    workerScript?: string;
    background?: string;
    width?: number | null;
    height?: number | null;
    repeat?: number;
    transparent?: string | null;
    dither?: boolean | string;
    debug?: boolean;
  }

  export interface GIFAddFrameOptions {
    delay?: number;
    copy?: boolean;
  }

  export default class GIF {
    constructor(options?: GIFOptions);
    addFrame(
      image: CanvasImageSource | CanvasRenderingContext2D | ImageData,
      options?: GIFAddFrameOptions,
    ): void;
    on(event: "finished", listener: (blob: Blob) => void): void;
    on(event: "progress", listener: (fraction: number) => void): void;
    on(event: "abort", listener: () => void): void;
    render(): void;
    abort(): void;
  }
}
