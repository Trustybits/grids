import { LayoutService, type ILayoutService } from "./LayoutService";
import { MockLayoutService } from "./MockLayoutService";

const useMockData = false;

let instance: ILayoutService | null = null;

export const getLayoutService = (): ILayoutService => {
  if (!instance) {
    instance = useMockData ? new MockLayoutService() : new LayoutService();
  }
  return instance;
};
