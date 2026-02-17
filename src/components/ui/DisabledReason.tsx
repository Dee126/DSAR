"use client";

import React from "react";
import { Tooltip } from "./Tooltip";

interface DisabledReasonProps {
  /** The button/element to wrap */
  children: React.ReactElement;
  /** Why the action is disabled */
  reason?: string;
  /** Whether the action is disabled */
  disabled?: boolean;
}

/**
 * Wraps a button/action with a tooltip explaining why it's disabled.
 * When not disabled, renders children normally.
 *
 * Usage:
 *   <DisabledReason disabled={!canTransition} reason="Identity verification must be completed first">
 *     <button onClick={handleTransition}>Advance to Triage</button>
 *   </DisabledReason>
 */
export function DisabledReason({
  children,
  reason,
  disabled = false,
}: DisabledReasonProps) {
  if (!disabled || !reason) {
    return children;
  }

  return (
    <Tooltip content={reason} position="top">
      {React.cloneElement(children, {
        disabled: true,
        "aria-disabled": true,
        className: `${children.props.className ?? ""} opacity-50 cursor-not-allowed`.trim(),
      })}
    </Tooltip>
  );
}

export default DisabledReason;
