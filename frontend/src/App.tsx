import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import AppShell from "./components/layout/AppShell";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import HomePage from "./pages/HomePage";
import ItemDetailPage from "./pages/ItemDetailPage";
import ProfilePage from "./pages/ProfilePage";

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="loading-screen"><span className="loading-spinner" /></div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen"><span className="loading-spinner" /></div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={currentUser ? <Navigate to="/feed" replace /> : <LoginPage />}
        />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/feed" element={<HomePage />} />
          <Route path="/feed/:itemId" element={<ItemDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="/" element={<Navigate to={currentUser ? "/feed" : "/login"} replace />} />
        <Route path="*" element={<Navigate to={currentUser ? "/feed" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
