import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import './index.css'
import { LandingPage } from './landing/LandingPage.tsx'
import { LoginPage } from './components/LoginPage.tsx'
import App from './app/App.tsx'
import { useAuthStore } from './store/useAuthStore'

function AppRoutes() {
  const { session, initialize, loading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (session && window.location.pathname === '/') {
      navigate('/app');
    }
  }, [session, navigate]);

  if (loading) {
    return <div className="h-screen w-screen bg-black" />; // Or a spinner
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          <LandingPage 
            onGetStarted={() => navigate(session ? '/app' : '/login')} 
            onSignIn={() => navigate('/login')} 
          />
        } 
      />
      <Route 
        path="/login" 
        element={
          session ? <Navigate to="/app" /> : <LoginPage onBack={() => navigate('/')} />
        } 
      />
      <Route 
        path="/app/*" 
        element={
          session ? <App /> : <Navigate to="/login" />
        } 
      />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
)
