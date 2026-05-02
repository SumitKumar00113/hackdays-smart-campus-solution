import { Routes, Route, Navigate } from "react-router-dom";
import HeroSection from "./components/HeroSection";
import AppShell from "./components/layout/AppShell";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import BookingPage from "./pages/booking/BookingPage";
import StudentDashboard from "./pages/dashboard/StudentDashboard";
import AttendancePage from "./pages/attendance/AttendancePage";
import LostFoundPage from "./pages/lostfound/LostFoundPage";
import NoticesPage from "./pages/notices/NoticesPage";
import CampusMapPage from "./pages/map/CampusMapPage";
import CampusAIPage from "./pages/ai/CampusAIPage";
import ProfilePage from "./pages/profile/ProfilePage";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HeroSection />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<StudentDashboard />} />
          <Route path="/bookings" element={<BookingPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/lostfound" element={<LostFoundPage />} />
          <Route path="/notices" element={<NoticesPage />} />
          <Route path="/map" element={<CampusMapPage />} />
          <Route path="/ai" element={<CampusAIPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default App;
