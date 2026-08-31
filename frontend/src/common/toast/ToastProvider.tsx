import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

import { ToastContext, type ToastTone } from "./ToastContext";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

const DISMISS_AFTER_MS = 4000;

const TONE_STYLES: Record<ToastTone, { border: string; icon: ReactNode }> = {
  success: {
    border: "border-l-4 border-l-green-500",
    icon: <CheckCircle2 size={18} className="text-green-600" />,
  },
  error: {
    border: "border-l-4 border-l-red-500",
    icon: <XCircle size={18} className="text-red-600" />,
  },
};

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        // Polite so a save confirmation is announced without interrupting whatever
        // the user is doing.
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex min-w-[280px] max-w-sm items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-lg ${
              TONE_STYLES[toast.tone].border
            }`}
          >
            <span className="mt-0.5 shrink-0">{TONE_STYLES[toast.tone].icon}</span>
            <p className="flex-1 text-sm text-gray-700">{toast.message}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
