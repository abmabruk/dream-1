"use client";

import { useEffect, useState } from "react";

export function QuickNotesWidget({ factoryName }: { factoryName: string }) {
  const storageKey = `ops-notes-${factoryName}`;
  const [notes, setNotes] = useState("");

  useEffect(() => {
    // Hydrating local component state from localStorage — external system,
    // intentional setState in an effect.
    try {
      const saved = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setNotes(saved);
    } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem(storageKey, notes); } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [notes, storageKey]);

  return (
    <div className="gc-notes">
      <textarea
        className="gc-notes-textarea"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="اكتب ملاحظاتك هنا..."
      />
    </div>
  );
}
