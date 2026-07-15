import "./Skeleton.scss";

export default function Skeleton({ width, height, borderRadius, className = "", style = {} }) {
  return (
    <div
      className={`vtl-skeleton ${className}`}
      style={{
        width: width || "100%",
        height: height || "1rem",
        borderRadius: borderRadius || "4px",
        ...style,
      }}
    />
  );
}

export function SkeletonList({ count = 3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} width={`${85 - (i % 3) * 10}%`} height="1.25rem" />
      ))}
    </div>
  );
}
