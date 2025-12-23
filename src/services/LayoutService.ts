import { type Layout } from '@/types/Layout';

export interface LayoutService {
  fetchLayout(id: string): Promise<Layout>;
  saveLayout(layout: Layout): Promise<void>;
  updateLayout(layout: Layout): Promise<void>;
  deleteLayout(id: string): Promise<void>;
}
