import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete",
  tone = "danger",
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <AlertDialog.Content className="dialog-sheet fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2">
          <AlertDialog.Title className="font-serif text-h3">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted">{body}</AlertDialog.Description>
          {children}
          <div className="mt-5 flex justify-end gap-4">
            <AlertDialog.Cancel className="h-11 px-3 text-sm text-muted" onClick={onClose}>
              Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
              className={`h-11 px-3 text-sm font-semibold ${tone === "danger" ? "text-danger" : "text-primary"}`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
