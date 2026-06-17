import "./AuroraBackground.scss";

export default function AuroraBackground() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <div className="aurora-bg__orb aurora-bg__orb--purple" />
      <div className="aurora-bg__orb aurora-bg__orb--blue" />
      <div className="aurora-bg__orb aurora-bg__orb--violet" />
      <div className="aurora-bg__mesh" />
    </div>
  );
}
