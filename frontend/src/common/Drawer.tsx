import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * A panel anchored to the right edge, for reading a record rather than editing
 * one. Distinct from Modal so that opening the edit form from inside a detail
 * view reads as moving forward into a task, not as one centred box replacing
 * another.
 *
 * Radix supplies focus trapping, escape-to-close, scroll locking and the aria
 * wiring; this is only the visual shell.
 */
export default function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed right-0 top-0 z-40 flex h-dvh w-[calc(100vw-2rem)] max-w-md flex-col bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-lg font-semibold text-gray-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 truncate text-sm text-gray-500">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="rounded p-1 text-gray-400 hover:bg-gray-100"
            >
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-5">{children}</div>

          {footer && (
            <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
