import { motion, useReducedMotion } from "framer-motion";
import { NavLink } from "react-router-dom";
import {
  Bot,
  CalendarCheck,
  CircleUser,
  GraduationCap,
  LayoutDashboard,
  Map,
  MapPinned,
  Megaphone,
  PackageSearch,
  UserRound,
} from "lucide-react";
import useAuth from "../../hooks/useAuth";

const initialsFromName = (name) => {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Profile", to: "/profile", icon: CircleUser },
  { label: "Notices", to: "/notices", icon: Megaphone },
  { label: "Attendance", to: "/attendance", icon: CalendarCheck },
  { label: "Room Booking", to: "/bookings", icon: MapPinned },
  { label: "Lost & Found", to: "/lostfound", icon: PackageSearch },
  { label: "Campus Map", to: "/map", icon: Map },
  { label: "AI Assistant", to: "/ai", icon: Bot },
];

const ease = [0.22, 1, 0.36, 1];

const Sidebar = () => {
  const { user } = useAuth();
  const reduce = useReducedMotion();
  const displayName = user?.name || "Guest";
  const dept = user?.department || "—";
  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "Member";

  const asideProps = reduce
    ? {}
    : {
        initial: { opacity: 0, x: -24 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: 0.55, ease, delay: 0.12 },
      };

  return (
  <motion.aside
    className="sidebar"
    aria-label="Primary navigation"
    {...asideProps}
  >
    <div className="brand">
      <div className="brand-mark">
        <GraduationCap size={20} strokeWidth={2.4} />
      </div>
      <span>CampusConnect</span>
    </div>

    <section className="student-card">
      <div className="avatar photo-avatar" aria-hidden="true">
        {initialsFromName(displayName)}
      </div>
      <div>
        <strong>{displayName}</strong>
        <span>{dept}</span>
        <small>{roleLabel}</small>
      </div>
    </section>

    <nav className="side-nav">
      {navigation.map(({ label, to, icon: Icon }) => (
        <NavLink
          key={label}
          to={to}
          className={({ isActive }) =>
            isActive ? "side-link active" : "side-link"
          }
        >
          <Icon size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>

    <section className="gpa-card">
      <div className="gpa-title">
        <UserRound size={15} />
        <span>Dean's List Status</span>
      </div>
      <div className="gpa-meter">
        <span />
      </div>
      <small>3.8 / 4.0 GPA</small>
    </section>
  </motion.aside>
  );
};

export default Sidebar;
