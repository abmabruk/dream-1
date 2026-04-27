"use client";

import { ALL_WIDGETS, type WidgetId } from "../shared";

export function AddWidgetDialog({
  visibleIds,
  onAdd,
  onClose,
}: {
  visibleIds: Set<WidgetId>;
  onAdd: (id: WidgetId) => void;
  onClose: () => void;
}) {
  const available = ALL_WIDGETS.filter((w) => !visibleIds.has(w.id));

  return (
    <div className="gc-dialog-overlay" onClick={onClose}>
      <div className="gc-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="gc-dialog-title">إضافة ويدجت</h3>
        {available.length === 0 && <p className="gc-empty">جميع الويدجتات مرئية.</p>}
        <div className="gc-dialog-list">
          {available.map((w) => (
            <button
              key={w.id}
              className="gc-dialog-item"
              onClick={() => { onAdd(w.id); onClose(); }}
              type="button"
            >
              <div className="gc-widget-accent-dot" style={{ background: w.accent }} />
              <span>{w.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
