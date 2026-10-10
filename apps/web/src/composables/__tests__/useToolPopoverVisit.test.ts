import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, reactive, type PropType } from "vue";
import { ContentType, type Tile } from "@grids/contracts/types";
import { WRITERS } from "@/registries/tileToolbar/mobileTools";
import { MIXED } from "@/utils/richText/docTransforms";
import {
  provideToolPopoverVisit,
  useToolPopoverVisit,
  type ToolPopoverVisit,
} from "../useToolPopoverVisit";

const m = vi.hoisted(() => ({
  history: { isBatching: false },
  begin: vi.fn(),
  commit: vi.fn(),
  setTileBorder: vi.fn(),
  patchTileContent: vi.fn(),
  updateCaption: vi.fn(),
}));

vi.mock("@/stores/grid/gridHistory", () => ({
  useGridHistoryStore: () => m.history,
}));

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => ({
    beginHistoryBatch: m.begin,
    commitHistoryBatch: m.commit,
    setTileBorder: m.setTileBorder,
    patchTileContent: m.patchTileContent,
    updateCaption: m.updateCaption,
  }),
}));

/** Batches that actually opened. */
const opened = () =>
  m.begin.mock.results.filter((result) => result.value === true).length;

const tile = (i: string, borderEnabled: boolean): Tile =>
  ({
    i,
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    caption: "",
    borderEnabled,
    content: { type: ContentType.TEXT, text: "" },
  }) as Tile;

/** A body that hands its injected visit back to the test. */
const Body = defineComponent({
  props: {
    onVisit: {
      type: Function as PropType<(v: ToolPopoverVisit) => void>,
      required: true,
    },
  },
  setup(props) {
    props.onVisit(useToolPopoverVisit());
    return () => null;
  },
});

const mountVisit = (tiles: Tile[]) => {
  let visit!: ToolPopoverVisit;
  const Host = defineComponent({
    setup() {
      provideToolPopoverVisit(
        () => tiles,
        () => "Edit border",
      );
      return () => h(Body, { onVisit: (v: ToolPopoverVisit) => (visit = v) });
    },
  });
  const wrapper = mount(Host);
  return { wrapper, visit };
};

describe("useToolPopoverVisit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.history = reactive({ isBatching: false });
    // Like the controller: a batch that's already open isn't reopened.
    m.begin.mockImplementation(() => {
      if (m.history.isBatching) return false;
      m.history.isBatching = true;
      return true;
    });
    m.commit.mockImplementation(() => {
      m.history.isBatching = false;
    });
  });

  it("opens no undo step for a visit that changes nothing", () => {
    const { wrapper, visit } = mountVisit([tile("a", true)]);
    visit.write(WRITERS.border, true); // already on
    wrapper.unmount();
    expect(m.begin).not.toHaveBeenCalled();
    expect(m.commit).not.toHaveBeenCalled();
  });

  it("collects every change of a visit into one step, committed on close", () => {
    const { wrapper, visit } = mountVisit([tile("a", true)]);
    visit.write(WRITERS.border, false);
    visit.write(WRITERS.caption, "hi");
    expect(opened()).toBe(1);
    expect(m.begin).toHaveBeenCalledWith("Edit border");
    expect(m.setTileBorder).toHaveBeenCalledWith("a", false);
    expect(m.updateCaption).toHaveBeenCalledWith({ tileId: "a", caption: "hi" });
    expect(m.commit).not.toHaveBeenCalled();
    wrapper.unmount();
    expect(m.commit).toHaveBeenCalledTimes(1);
  });

  it("writes only the tiles a value changes and reads mixed values", () => {
    const { visit } = mountVisit([tile("a", true), tile("b", false)]);
    expect(visit.read(WRITERS.border)).toBe(MIXED);
    visit.write(WRITERS.border, true);
    expect(m.setTileBorder).toHaveBeenCalledTimes(1);
    expect(m.setTileBorder).toHaveBeenCalledWith("b", true);
  });

  it("starts a fresh step after Undo closed the open one", () => {
    const { wrapper, visit } = mountVisit([tile("a", true)]);
    visit.write(WRITERS.border, false);
    // Undo commits the batch itself.
    m.history.isBatching = false;
    visit.write(WRITERS.caption, "again");
    expect(opened()).toBe(2);
    wrapper.unmount();
    expect(m.commit).toHaveBeenCalledTimes(1);
  });

  it("commit() closes the step but keeps the visit going", () => {
    const { visit } = mountVisit([tile("a", true)]);
    visit.write(WRITERS.border, false);
    visit.commit();
    visit.commit();
    expect(m.commit).toHaveBeenCalledTimes(1);
    visit.write(WRITERS.caption, "next");
    expect(opened()).toBe(2);
  });

  it("needs a popover above it", () => {
    const Lonely = defineComponent({
      setup() {
        useToolPopoverVisit();
        return () => null;
      },
    });
    expect(() => mount(Lonely)).toThrow(/MobileToolPopover/);
  });
});
