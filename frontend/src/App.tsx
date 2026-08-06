import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { TimetablePage } from './pages/TimetablePage';
import { BatchesPage } from './pages/settings/BatchesPage';
import { SubjectsPage } from './pages/settings/SubjectsPage';
import { FacultyPage } from './pages/settings/FacultyPage';
import { TimeSlotsPage } from './pages/settings/TimeSlotsPage';
import { DaysPage } from './pages/settings/DaysPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('nitatime_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function SettingsLayout() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl">
      <div className="card p-6">
        <Routes>
          <Route index element={<Navigate to="batches" replace />} />
          <Route path="batches" element={<BatchesPage />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="faculty" element={<FacultyPage />} />
          <Route path="time-slots" element={<TimeSlotsPage />} />
          <Route path="days" element={<DaysPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/timetable" replace />} />
        <Route path="timetable" element={<TimetablePage />} />
        <Route path="settings/*" element={<SettingsLayout />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
