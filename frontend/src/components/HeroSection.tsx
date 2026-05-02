import { useEffect, useRef, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import Hls from "hls.js";
import useAuth from "../hooks/useAuth";

const MUX_HLS =
  "https://stream.mux.com/tLkHO1qZoaaQOUeVWo8hEBeGQfySP02EPS02BmnNFyXys.m3u8";

const vignetteClass =
  "pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_110%_80%_at_50%_28%,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.28)_50%,rgba(0,0,0,0.52)_100%)]";

const gradientLineStyle: CSSProperties = {
  background: "linear-gradient(90deg, #a1a1aa 0%, #f4f4f5 45%, #e4e4e7 55%, #a1a1aa 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  display: "block",
  lineHeight: 1.14,
  paddingBottom: "0.12em",
};

const textLegibilityShadow =
  "0 2px 28px rgba(0,0,0,0.65), 0 1px 2px rgba(0,0,0,0.85)";

function HlsBackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | undefined;

    if (Hls.isSupported()) {
      hls = new Hls({ autoStartLoad: true });
      hls.loadSource(MUX_HLS);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = MUX_HLS;
      const onMeta = () => {
        video.play().catch(() => {});
        video.removeEventListener("loadedmetadata", onMeta);
      };
      video.addEventListener("loadedmetadata", onMeta);
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 z-0 h-full min-h-[100dvh] w-full min-w-full object-cover"
      style={{ zIndex: 0 }}
      autoPlay
      loop
      muted
      playsInline
    />
  );
}

const ease = [0.22, 1, 0.36, 1] as const;

export default function HeroSection() {
  const reduce = useReducedMotion();
  const { token } = useAuth();

  return (
    <section
      className="relative flex min-h-[100dvh] min-h-screen w-full max-w-[100vw] flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-zinc-950"
      aria-label="Hero"
    >
      <HlsBackgroundVideo />
      <div className={vignetteClass} aria-hidden />

      <header className="absolute left-0 right-0 top-0 z-20 w-full border-b border-white/[0.06] bg-black/25 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <span
            className="font-sans text-sm font-semibold tracking-tight text-white/95 sm:text-base"
            style={{ textShadow: textLegibilityShadow }}
          >
            CampusConnect
          </span>
          <nav className="flex items-center gap-1 sm:gap-2">
            {token ? (
              <Link
                to="/dashboard"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 shadow-lg shadow-black/20 transition-all duration-200 ease-out hover:bg-zinc-100 hover:shadow-xl hover:shadow-black/25 active:scale-[0.98] sm:px-5 sm:py-2.5"
                style={{ textShadow: "none" }}
              >
                Open app
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full px-3 py-2 text-sm font-medium text-white/75 transition-colors duration-200 hover:text-white sm:px-4"
                  style={{ textShadow: textLegibilityShadow }}
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 shadow-lg shadow-black/20 transition-all duration-200 ease-out hover:bg-zinc-100 hover:shadow-xl hover:shadow-black/25 active:scale-[0.98] sm:px-5 sm:py-2.5"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-24 pt-20 text-center sm:px-6 sm:pb-28 sm:pt-24 lg:px-8"
        style={{ marginTop: "clamp(56px, 10vh, 160px)" }}
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease }}
      >
        <h1
          className="mx-auto max-w-[min(100%,42rem)] tracking-[-0.02em] sm:max-w-none"
          style={{
            fontFamily: "'YDYoonche L', 'YDYoonche M', ui-sans-serif, system-ui, sans-serif",
            fontSize: "clamp(2.25rem, 6.5vw, 5.75rem)",
            color: "#fafafa",
            fontWeight: 300,
            lineHeight: 1.12,
            textShadow: textLegibilityShadow,
          }}
        >
          <span className="block sm:inline sm:px-1" style={gradientLineStyle}>
            The vision
          </span>
          <span
            className="mt-0 block sm:mt-0 sm:inline sm:px-1"
            style={gradientLineStyle}
          >
            of engineering
          </span>
          <span className="mt-5 block font-sans text-[0.42em] font-semibold leading-normal tracking-tight text-white sm:mt-6 sm:text-[0.38em]">
            <span className="text-zinc-300">is </span>
            human
            <span className="text-zinc-400"> + </span>
            AI
          </span>
        </h1>

        <motion.div
          className="mt-10 w-full max-w-lg sm:mt-12 sm:max-w-xl"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease, delay: reduce ? 0 : 0.12 }}
        >
          <p className="mx-auto max-w-md font-sans text-pretty text-base leading-relaxed text-zinc-100/95 sm:max-w-lg sm:text-lg sm:leading-relaxed">
            We help you map the talent you need, track the talent you have, and
            close your gaps to thrive in a GenAI world.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:mt-9 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
            <Link
              to={token ? "/dashboard" : "/register"}
              className="group relative inline-flex min-h-[48px] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-7 py-3.5 text-center text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(16,185,129,0.4),0_8px_32px_-4px_rgba(16,185,129,0.45)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:from-emerald-300 hover:to-emerald-500 hover:shadow-[0_0_0_1px_rgba(52,211,153,0.5),0_16px_48px_-8px_rgba(16,185,129,0.55)] active:translate-y-0 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 sm:min-h-[52px] sm:rounded-2xl sm:px-8 sm:text-[0.9375rem]"
            >
              <span
                className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
              />
              <span className="relative">
                {token ? "Go to dashboard" : "Join the movement"}
              </span>
            </Link>

            <Link
              to={token ? "/bookings" : "/login"}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3.5 font-sans text-sm font-medium text-white/90 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.09] hover:text-white active:scale-[0.99] sm:min-h-[52px] sm:rounded-2xl"
            >
              {token ? "Room sessions" : "I already have an account"}
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
