import "./Modal.scss";

export default function Modal({ open, onClose, title, children, wide = false, scrollable = false }) {
  if (!open) return null;

  return (
    <div className="vtl-modal" onClick={onClose}>
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
    </div>
  );
}
