import "./GlassCard.scss";

export default function GlassCard({ children, className = "", hover = false, padding = true }) {
  return (
    <div
      className={`glass-card ${hover ? "glass-card--hover" : ""} ${
        padding ? "glass-card--padded" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
