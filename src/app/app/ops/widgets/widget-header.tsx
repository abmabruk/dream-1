"use client";

import { useState } from "react";
import type { WidgetLayout } from "../shared";

export function WidgetHeader({
  widget,
  onToggleCollapse,
  onRemove,
  onResize,
  dragHandleProps,
}: {
  widget: WidgetLayout;
  onToggleCollapse: () => void;
  onRemove: () => void;
  onResize: (size: "small" | "medium" | "large" | "wide") => void;
  dragHandleProps?: Record<string, unknown>;
}) {
  const [showResize, setShowResize] = useState(false);

  return (
    <div
      className="gc-widget-header"
      style={{ borderTopColor: widget.accentColor }}
      {...dragHandleProps}
    >
      <div className="gc-widget-header-left">
        <div
          className="gc-widget-accent-dot"
          style={{ background: widget.accentColor }}
        />
        <span className="gc-widget-title">{widget.title}</span>
      </div>
      <div className="gc-widget-header-actions">
        <div style={{ position: "relative" }}>
          <button
            className="gc-widget-btn"
            onClick={() => setShowResize(!showResize)}
            title="تغيير الحجم"
            type="button"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
          {showResize && (
            <div className="gc-resize-menu">
              {(["small", "medium", "large", "wide"] as const).map((s) => (
                <button
                  key={s}
                  className="gc-resize-option"
                  onClick={() => { onResize(s); setShowResize(false); }}
                  type="button"
                >
                  {s === "small" ? "1x1" : s === "medium" ? "2x1" : s === "large" ? "2x2" : "3x1"}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="gc-widget-btn"
          onClick={onToggleCollapse}
          title={widget.collapsed ? "توسيع" : "طي"}
          type="button"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: widget.collapsed ? "rotate(180deg)" : "none", transition: "transform 200ms" }}
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button
          className="gc-widget-btn"
          onClick={onRemove}
          title="إزالة الويدجت"
          type="button"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
