"use client";

import { useCallback, useEffect, useState } from "react";

export interface ToastMessage {
  id: number;
  type: "success" | "error";
  text: string;
}

let nextId = 0;

/**
 * Lightweight toast hook — no external dependencies.
 * Returns [toasts, addToast, ToastContainer].
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (type: ToastMessage["type"], text: string, durationMs = 4000) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, type, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    },
    [],
  );

  return { toasts, addToast };
}

/** Renders a stack of toasts fixed to the top-right corner. */
export function ToastContainer({ toasts }: { toasts: ToastMessage[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} message={t} />
      ))}
    </div>
  );
}

function Toast({ message }: { message: ToastMessage }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // trigger enter animation on next frame
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const isSuccess = message.type === "success";

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg transition-all duration-300 ${
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
      } ${
        isSuccess
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
      role="alert"
    >
      {/* icon */}
      <svg
        className={`h-5 w-5 shrink-0 ${isSuccess ? "text-green-500" : "text-red-500"}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        {isSuccess ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        )}
      </svg>
      <span className="text-sm font-medium">{message.text}</span>
    </div>
  );
}
