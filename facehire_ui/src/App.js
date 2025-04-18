// src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import CandidateLogin from './components/CandidateLogin';
import CandidateDashboard from './components/CandidateDashboard';
import CandidateResumeChecker from './components/CandidateResumeChecker';
import InterviewPage from './components/InterviewPage';
import Layout from './components/Layout';
import useUserRole from './hooks/useUserRole';
import { auth } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const [user, loading] = useAuthState(auth);
  const role = useUserRole(user);

  if (loading) {
    return <div style={{ padding: "20px" }}>Loading...</div>;
  }

  // Determine if the user is an admin based on their role.
  const isAdmin = role === 'admin';

  return (
    <>
      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
        closeOnClick 
        pauseOnHover 
        draggable 
      />
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/candidate-login" element={!user ? <CandidateLogin /> : <Navigate to="/candidate-dashboard" />} />
          <Route path="/candidate-dashboard" element={<CandidateDashboard />} />
          
          {/* Protected Routes using Layout */}
          <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="admin" element={isAdmin ? <AdminPanel /> : <div>Access Denied</div>} />
            <Route path="interviews" element={<div>Interviews Page (Coming Soon)</div>} />
            <Route path="resume-checker" element={<CandidateResumeChecker />} />
            {/* New Interview Route */}
            <Route path="/interview/:interviewId" element={<InterviewPage />} />
            <Route index element={<Navigate to="dashboard" />} />
          </Route>
          
          {/* Fallback Route */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
