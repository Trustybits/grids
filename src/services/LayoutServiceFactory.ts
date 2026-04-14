import { LayoutService, type ILayoutService } from "./LayoutService";
import { MockLayoutService } from "./MockLayoutService";

const useMockData = false;

export const getLayoutService = (): ILayoutService => {
  if (useMockData) {
    return new MockLayoutService();
  }

  return new LayoutService();
};
