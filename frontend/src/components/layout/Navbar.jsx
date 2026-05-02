import { Bell, LogOut, Search, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.name?.split(/\s+/)[0] || "Account";

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
  <header className="topbar">
    <label className="search-field">
      <Search size={18} />
      <input type="search" placeholder="Search courses, faculty, or rooms..." />
    </label>

    <div className="topbar-actions">
      <button className="icon-button" type="button" aria-label="Notifications">
        <Bell size={19} />
        <span className="notification-dot" />
      </button>
      <span className="topbar-divider" />
      <button
        className="icon-button"
        type="button"
        aria-label="Log out"
        onClick={handleLogout}
      >
        <LogOut size={18} />
      </button>
      <button
        className="profile-chip"
        type="button"
        onClick={() => navigate("/profile")}
        aria-label="Open profile"
      >
        <span>{firstName}</span>
        <span className="mini-avatar">
          <UserRound size={15} />
        </span>
      </button>
    </div>
  </header>
  );
};

export default Navbar;
