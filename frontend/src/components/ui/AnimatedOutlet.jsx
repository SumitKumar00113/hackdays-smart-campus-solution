import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";

const ease = [0.22, 1, 0.36, 1];

const AnimatedOutlet = () => {
  const location = useLocation();
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div className="outlet-motion">
        <Outlet />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        className="outlet-motion"
        initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -16, filter: "blur(6px)" }}
        transition={{ duration: 0.4, ease }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
};

export default AnimatedOutlet;
