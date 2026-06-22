import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, X, Check, UserCheck } from "lucide-react";
import { getInitials, getAvatarColor } from "../../utils/helpers";
import "./SearchableMultiSelect.scss";

export default function SearchableMultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = "Search and select...",
  emptyMessage = "No results found",
  disabled = false,
  loading = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const containerRef = useRef(null);
  const controlRef = useRef(null);
  const inputRef = useRef(null);

  const selectedSet = useMemo(() => new Set(value.map(Number)), [value]);

  const selectedOptions = useMemo(
    () => options.filter((o) => selectedSet.has(Number(o.id))),
    [options, selectedSet]
  );

  const dropdownOptions = useMemo(() => {
    const q = search.toLowerCase().trim();
    return options.filter((o) => {
      if (selectedSet.has(Number(o.id))) return false;
      if (!q) return true;
      return (
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q))
      );
    });
  }, [options, search, selectedSet]);

  const updateDropdownPosition = () => {
    if (!controlRef.current) return;
    const rect = controlRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(220, openUp ? spaceAbove : spaceBelow);

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(120, maxHeight),
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
      zIndex: 800,
    });
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        containerRef.current?.contains(e.target) ||
        e.target.closest(".sms__dropdown-portal")
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
    inputRef.current?.focus();

    const onReflow = () => updateDropdownPosition();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, selectedOptions.length]);

  const toggle = (id) => {
    const numId = Number(id);
    if (selectedSet.has(numId)) {
      onChange(value.filter((v) => Number(v) !== numId));
    } else {
      onChange([...value, numId]);
    }
  };

  const remove = (id, e) => {
    e.stopPropagation();
    onChange(value.filter((v) => Number(v) !== Number(id)));
  };

  const dropdown = open && !loading && (
    <div
      className="sms__dropdown sms__dropdown-portal"
      style={dropdownStyle}
      role="listbox"
      aria-multiselectable="true"
    >
      {dropdownOptions.length === 0 ? (
        <div className="sms__empty">
          <UserCheck size={20} />
          <p>{search.trim() ? emptyMessage : "All available users selected"}</p>
        </div>
      ) : (
        dropdownOptions.map((o) => (
          <button
            key={o.id}
            type="button"
            role="option"
            className="sms__option"
            onClick={() => toggle(o.id)}
          >
            <span className="sms__checkbox">
              <Check size={12} />
            </span>
            <span
              className="sms__avatar"
              style={{ background: getAvatarColor(o.label) }}
            >
              {getInitials(o.label)}
            </span>
            <span className="sms__option-text">
              <strong>{o.label}</strong>
              {o.sublabel && <span>{o.sublabel}</span>}
            </span>
          </button>
        ))
      )}
    </div>
  );

  return (
    <div
      className={`sms ${open ? "sms--open" : ""} ${disabled ? "sms--disabled" : ""}`}
      ref={containerRef}
    >
      <div
        ref={controlRef}
        className="sms__control"
        onClick={() => !disabled && !loading && setOpen(true)}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <div className="sms__control-inner">
          {selectedOptions.map((o) => (
            <span key={o.id} className="sms__chip">
              <span
                className="sms__chip-avatar"
                style={{ background: getAvatarColor(o.label) }}
              >
                {getInitials(o.label)}
              </span>
              <span className="sms__chip-label">{o.label}</span>
              <button
                type="button"
                className="sms__chip-remove"
                onClick={(e) => remove(o.id, e)}
                aria-label={`Remove ${o.label}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}

          <div className="sms__input-wrap">
            <Search size={16} className="sms__icon" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={
                loading
                  ? "Loading members..."
                  : selectedOptions.length > 0
                    ? "Search more..."
                    : placeholder
              }
              disabled={disabled || loading}
              autoComplete="off"
            />
          </div>
        </div>

        <button
          type="button"
          className="sms__toggle"
          onClick={(e) => {
            e.stopPropagation();
            if (!loading) setOpen(!open);
          }}
          aria-label={open ? "Close list" : "Open list"}
        >
          <ChevronDown size={16} className={open ? "sms__chevron--up" : ""} />
        </button>
      </div>

      {dropdown && createPortal(dropdown, document.body)}

      {selectedOptions.length > 0 && (
        <span className="sms__count">
          {selectedOptions.length} member{selectedOptions.length !== 1 ? "s" : ""} selected
        </span>
      )}
    </div>
  );
}
