/**
 * Tests for TransferGridModal — the sender's "give this grid away" dialog.
 *
 * The GridTransferService is stubbed through the service-factory singleton, so
 * these tests isolate the modal's own logic: how the single recipient field is
 * classified as an email vs. a slug, how the keep/remove toggle maps to the
 * removeOrphanedFiles argument, the confirm-enabled rule, and the success vs.
 * error branches (emitted events, toast, inline error). BaseModal teleports its
 * content to <body>, so assertions read from document.body.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { registerServiceFactory } from "@/services/ServiceFactorySingleton";
import type { ServiceFactoryInterface } from "@/services/factory/ServiceFactoryInterface";
import { useToastStore } from "@/stores/toast";
import TransferGridModal from "../TransferGridModal.vue";

function registerService() {
  const createTransfer = vi.fn().mockResolvedValue({
    transferId: "t-1",
    status: "pending",
    estimatedBytes: 0,
  });
  registerServiceFactory({
    getGridTransferService: () => ({ createTransfer }) as never,
  } as unknown as ServiceFactoryInterface);
  return { createTransfer };
}

function mountModal(props: Partial<{ gridId: string; gridName: string }> = {}) {
  return mount(TransferGridModal, {
    props: {
      show: true,
      gridId: props.gridId ?? "grid-1",
      gridName: props.gridName ?? "My Grid",
    },
  });
}

function typeRecipient(value: string) {
  const input = document.body.querySelector<HTMLInputElement>(".tg__input");
  if (!input) throw new Error("recipient input not found");
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

function toggleRemoveFiles() {
  const toggle = document.body.querySelector<HTMLInputElement>(".toggle-input");
  if (!toggle) throw new Error("remove-files toggle not found");
  toggle.checked = !toggle.checked;
  toggle.dispatchEvent(new Event("change"));
}

function clickButton(label: string) {
  const button = Array.from(
    document.body.querySelectorAll<HTMLButtonElement>("button"),
  ).find((b) => b.textContent?.trim() === label);
  button?.click();
  return button;
}

/**
 * Fill the recipient (optionally flip the remove-files toggle) and click Send.
 * The flush after typing lets Vue re-render the Send button's `:disabled`
 * binding — a disabled button swallows the click, so without it nothing submits.
 */
async function fillAndSend(
  recipient: string,
  opts: { remove?: boolean } = {},
) {
  if (opts.remove) toggleRemoveFiles();
  typeRecipient(recipient);
  await flushPromises();
  clickButton("Send Transfer");
  await flushPromises();
}

beforeEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("rendering", () => {
  it("shows the grid name and the permanence warning", () => {
    registerService();
    mountModal({ gridName: "Portfolio Grid" });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Portfolio Grid");
    expect(text).toContain("Transferring is permanent");
  });

  it("disables Send Transfer until a recipient is entered", async () => {
    registerService();
    const wrapper = mountModal();

    const send = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.textContent?.trim() === "Send Transfer");
    expect(send?.disabled).toBe(true);

    typeRecipient("matt");
    await flushPromises();
    expect(send?.disabled).toBe(false);

    wrapper.unmount();
  });
});

describe("recipient classification", () => {
  it("treats input containing '@' as an email", async () => {
    const { createTransfer } = registerService();
    mountModal();

    await fillAndSend("friend@example.com");

    expect(createTransfer).toHaveBeenCalledWith(
      "grid-1",
      { email: "friend@example.com" },
      false,
    );
  });

  it("treats input without '@' as a slug", async () => {
    const { createTransfer } = registerService();
    mountModal();

    await fillAndSend("matt");

    expect(createTransfer).toHaveBeenCalledWith(
      "grid-1",
      { slug: "matt" },
      false,
    );
  });

  it("trims surrounding whitespace before classifying", async () => {
    const { createTransfer } = registerService();
    mountModal();

    await fillAndSend("  matt  ");

    expect(createTransfer).toHaveBeenCalledWith(
      "grid-1",
      { slug: "matt" },
      false,
    );
  });
});

describe("remove-files toggle", () => {
  it("passes removeOrphanedFiles=true when the toggle is on", async () => {
    const { createTransfer } = registerService();
    mountModal();

    await fillAndSend("matt", { remove: true });

    expect(createTransfer).toHaveBeenCalledWith(
      "grid-1",
      { slug: "matt" },
      true,
    );
  });

  it("defaults to keeping files (removeOrphanedFiles=false)", async () => {
    const { createTransfer } = registerService();
    mountModal();

    await fillAndSend("matt");

    expect(createTransfer.mock.calls[0][2]).toBe(false);
  });
});

describe("submission outcomes", () => {
  it("emits sent + close and toasts on success", async () => {
    const { createTransfer } = registerService();
    const wrapper = mountModal();

    await fillAndSend("friend@example.com");

    expect(wrapper.emitted("sent")).toHaveLength(1);
    expect(wrapper.emitted("close")).toHaveLength(1);
    expect(createTransfer).toHaveBeenCalledTimes(1);

    const toast = useToastStore();
    expect(
      toast.toasts.some(
        (t) =>
          t.type === "success" &&
          t.message.includes("friend@example.com"),
      ),
    ).toBe(true);

    wrapper.unmount();
  });

  it("surfaces the server error inline and does not emit sent/close", async () => {
    const { createTransfer } = registerService();
    createTransfer.mockRejectedValue(
      new Error("No Grids account was found for that email/slug."),
    );
    const wrapper = mountModal();

    await fillAndSend("ghost@example.com");

    expect(document.body.textContent).toContain(
      "No Grids account was found for that email/slug.",
    );
    expect(wrapper.emitted("sent")).toBeUndefined();
    expect(wrapper.emitted("close")).toBeUndefined();

    wrapper.unmount();
  });

  it("does not call the service when the recipient is empty", async () => {
    const { createTransfer } = registerService();
    const wrapper = mountModal();

    clickButton("Send Transfer");
    await flushPromises();

    expect(createTransfer).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
