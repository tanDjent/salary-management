import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
};

/**
 * Radix Dialog handles focus trapping, escape-to-close, scroll locking and the
 * aria wiring; this only supplies the visual shell.
 */
export default function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  widthClassName = "max-w-lg",
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] ${widthClassName} -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-xl`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-gray-500">
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
