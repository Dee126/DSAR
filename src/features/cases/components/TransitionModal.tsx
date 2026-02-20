"use client";

import { STATUS_LABELS } from "../constants";

interface Props {
  currentStatus: string;
  targetStatus: string;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  transitioning: boolean;
}

export function TransitionModal({
  currentStatus, targetStatus, reason, onReasonChange,
  onConfirm, onCancel, transitioning,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          Transition to {STATUS_LABELS[targetStatus] ?? targetStatus}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          From: {STATUS_LABELS[currentStatus] ?? currentStatus}
        </p>
        <div className="mt-4">
          <label className="label">Reason <span className="text-red-500">*</span></label>
          <textarea
            name="reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={3}
            className="input-field resize-y"
            placeholder="Provide a reason..."
            autoFocus
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button
            data-testid="confirm-transition"
            onClick={onConfirm}
            disabled={!reason.trim() || transitioning}
            className="btn-primary"
          >
            {transitioning ? "Transitioning..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
