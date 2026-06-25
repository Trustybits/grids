import { inject, provide } from "vue";
import {
  gridViewContextKey,
  type GridViewContext,
} from "@/grid-context/GridViewContext";
import { createLiveGridViewContext } from "@/grid-context/createLiveGridViewContext";

export type GridViewContextFactory = () => GridViewContext;

let defaultContext: GridViewContext | null = null;
let defaultContextFactory: GridViewContextFactory | null = null;

export function provideGridViewContext(ctx: GridViewContext): void {
  provide(gridViewContextKey, ctx);
}

export function setDefaultGridViewContextFactory(
  factory: GridViewContextFactory,
): void {
  defaultContextFactory = factory;
  defaultContext = null;
}

export function resetDefaultGridViewContext(): void {
  defaultContext = null;
  defaultContextFactory = null;
}

export function useGridViewContext(): GridViewContext {
  const ctx = inject(gridViewContextKey, null);
  if (ctx) return ctx;

  if (!defaultContext) {
    defaultContext = defaultContextFactory
      ? defaultContextFactory()
      : createLiveGridViewContext();
  }

  return defaultContext;
}
