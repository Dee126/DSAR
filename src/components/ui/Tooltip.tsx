"use client";

import React, { useState, useRef, useCallback } from "react";

interface TooltipProps {
  /** Tooltip content */
  content: React.ReactNode;
  /** Element that triggers the tooltip */
  children: React.ReactElement;
  /** Tooltip placement */
  position?: "top" | "bottom" | "left" | "right";
  /** Additional CSS classes for the tooltip container */
  className?: string;
}

/**
 * Lightweight tooltip component.
 * Pure CSS positioning, no external dependencies.
 * Accessible via aria-describedby.
 */
export function Tooltip({
  content,
  children,
  position = "top",
  className = "",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).slice(2, 8)}`);

  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);

  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {React.cloneElement(children, {
        "aria-describedby": visible ? tooltipId.current : undefined,
      })}
      {visible && (
        <span
          id={tooltipId.current}
          role="tooltip"
          className={`absolute z-50 max-w-xs whitespace-normal rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg pointer-events-none ${positionClasses[position]}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export default Tooltip;
