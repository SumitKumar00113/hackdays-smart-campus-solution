import { motion, useReducedMotion } from "framer-motion";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import AnimatedOutlet from "../ui/AnimatedOutlet";

const ease = [0.22, 1, 0.36, 1];

const AppShell = () => {
  const reduce = useReducedMotion();

  return (
    <div className="app-frame">
      <div className="app-frame-aurora" aria-hidden />
      <div className="app-frame-grid" aria-hidden />
      {reduce ? (
        <div className="app-shell">
          <Sidebar />
          <div className="workspace">
            <Navbar />
            <AnimatedOutlet />
          </div>
        </div>
      ) : (
        <motion.div
          className="app-shell"
          initial={{ opacity: 0, y: 48, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, ease, delay: 0.06 }}
        >
          <Sidebar />
          <div className="workspace">
            <Navbar />
            <AnimatedOutlet />
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AppShell;
