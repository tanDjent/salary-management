import { createContext } from "react";

export type ToastTone = "success" | "error";

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

/** Split from the provider so the module exports only a constant, which keeps
 *  React Fast Refresh working on the provider file. */
export const ToastContext = createContext<ToastContextValue | null>(null);
