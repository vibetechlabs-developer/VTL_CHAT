import { createContext, useContext, useState, useRef } from "react";
import Modal from "../components/vtl/Modal";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    title: "Confirm Action",
    message: "Are you sure you want to proceed?",
    confirmText: "Confirm",
    cancelText: "Cancel",
    type: "primary",
  });

  const resolver = useRef(null);

  const confirm = (options = {}) => {
    setState({
      open: true,
      title: options.title ?? "Confirm Action",
      message: options.message ?? "Are you sure you want to proceed?",
      confirmText: options.confirmText ?? "Confirm",
      cancelText: options.cancelText === null ? null : (options.cancelText ?? "Cancel"),
      type: options.type ?? "primary",
    });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  };

  const handleConfirm = () => {
    setState((prev) => ({ ...prev, open: false }));
    if (resolver.current) resolver.current(true);
  };

  const handleCancel = () => {
    setState((prev) => ({ ...prev, open: false }));
    if (resolver.current) resolver.current(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={state.open} onClose={handleCancel} title={state.title}>
        <div style={{ marginBottom: "1.5rem", fontSize: "0.95rem", color: "#e2e8f0", lineHeight: "1.5" }}>
          {state.message}
        </div>
        <div className="vtl-modal__actions">
          {state.cancelText !== null && (
            <button type="button" className="vtl-btn vtl-btn--ghost" onClick={handleCancel}>
              {state.cancelText}
            </button>
          )}
          <button
            type="button"
            className={`vtl-btn ${state.type === "danger" ? "vtl-btn--danger" : "vtl-btn--primary"}`}
            onClick={handleConfirm}
            autoFocus
          >
            {state.confirmText}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}
