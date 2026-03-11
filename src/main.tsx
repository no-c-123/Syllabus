import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import '@/index.css'
import { LoginPage } from '@/ui/components/LoginPage.tsx'
import App from '@/app/App.tsx'
import { useAuthStore } from '@/store/useAuthStore'

function AppRoutes() {
  const { session, initialize, loading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  if (loading) {
    return <div className="h-screen w-screen bg-black" />; // Or a spinner
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          session ? <App /> : <Navigate to="/login" />
        } 
      />
      <Route 
        path="/login" 
        element={
          session ? <Navigate to="/" /> : <LoginPage />
        } 
      />
      <Route 
        path="/app/*" 
        element={
          <Navigate to="/" replace />
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
