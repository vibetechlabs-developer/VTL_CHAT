import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import GlassCard from "./GlassCard";
import "./StatCard.scss";

export default function StatCard({ title, value, growth, isPositive = true, color, icon, sparkline, gradientId }) {
  return (
    <GlassCard hover className="stat-card">
      <div className="stat-card__header">
        <div className="stat-card__icon" style={{ color }}>
          {icon}
        </div>
        {growth && (
          <span className={`stat-card__growth ${isPositive ? "stat-card__growth--up" : "stat-card__growth--down"}`}>
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {growth}
          </span>
        )}
      </div>
      <div className="stat-card__body">
        <span className="stat-card__title">{title}</span>
        <h3 className="stat-card__value">{value}</h3>
      </div>
      {sparkline && (
        <div className="stat-card__chart">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              className="stat-card__sparkline"
              d={sparkline}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path d={`${sparkline} L100,30 L0,30 Z`} fill={`url(#${gradientId})`} />
          </svg>
        </div>
      )}
    </GlassCard>
  );
}
