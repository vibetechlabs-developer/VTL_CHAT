import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./Modal.scss";

export default function Modal({ open, onClose, title, children, wide = false, scrollable = false }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="vtl-modal" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`vtl-modal__panel ${wide ? "vtl-modal__panel--wide" : ""} ${
          scrollable ? "vtl-modal__panel--scrollable" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vtl-modal__header">
          <h3>{title}</h3>
          <button className="vtl-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
