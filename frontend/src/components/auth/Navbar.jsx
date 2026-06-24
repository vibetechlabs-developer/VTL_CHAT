const Navbar = () => {
  return (
    <nav className="navbar liquid-glass">
      <div className="logo">
        VTL CHAT
      </div>

      <div className="nav-links">
        <a href="#">Features</a>
        <a href="#">Teams</a>
        <a href="#">Meetings</a>
        <a href="#">Contact</a>
      </div>

      <button className="primary-btn">
        Get Started
      </button>
    </nav>
  );
};

export default Navbar;