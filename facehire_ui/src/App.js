// src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import CandidateLogin from './components/CandidateLogin';
import CandidateDashboard from './components/CandidateDashboard';
import CandidateResumeChecker from './components/CandidateResumeChecker';
import { auth } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import Layout from './components/Layout';
import useUserRole from './hooks/useUserRole';
import ToastNotifications from './components/ToastNotifications';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
function App() {
  const [user, loading] = useAuthState(auth);
  const role = useUserRole(user);

  if (loading) {
    return <div style={{ padding: "20px" }}>Loading...</div>;
  }

  // Determine if the user is an admin based on their Firestore "role" field.
  const isAdmin = role === 'admin';

  // console.log(role)
  // console.log(user)

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
    <Router>
      <ToastNotifications />
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
        {/* Candidate Login Route */}
        <Route path="/candidate-login" element={<CandidateLogin />} />
        {/* Candidate Dashboard Route */}
        <Route path="/candidate-dashboard" element={<CandidateDashboard />} />
        {/* Protected routes using the Layout */}
        <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="admin" element={isAdmin ? <AdminPanel /> : <div>Access Denied</div>} />
          <Route path="interviews" element={<div>Interviews Page (Coming Soon)</div>} />
          <Route path="resume-checker" element={<CandidateResumeChecker />} />
          <Route index element={<Navigate to="dashboard" />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
    </>

  );
}

export default App;
