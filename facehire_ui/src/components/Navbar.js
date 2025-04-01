// src/components/Navbar.js

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import useUserRole from '../hooks/useUserRole';

function Navbar() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const role = useUserRole(user);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <nav style={styles.navbar}>
      <div style={styles.logo}>
        <h2>FaceHire</h2>
      </div>
      <div style={styles.navLinks}>
        <Link to="/dashboard" style={styles.link}>Dashboard</Link>
        <Link to="/interviews" style={styles.link}>Interviews</Link>
        <Link to="/resume-checker" style={styles.link}>Resume Checker</Link>
        {role === 'admin' && (
          <Link to="/admin" style={styles.link}>Admin Panel</Link>
        )}
        {role && role !== 'admin' && (
          <Link to="/candidate-dashboard" style={styles.link}>Candidate Dashboard</Link>
        )}
      </div>
      <div>
        <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
      </div>
    </nav>
  );
}

const styles = {
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1976d2',
    padding: '10px 20px',
    color: '#fff'
  },
  logo: {
    fontSize: '1.5rem',
    fontWeight: 'bold'
  },
  navLinks: {
    display: 'flex',
    gap: '15px'
  },
  link: {
    color: '#fff',
    textDecoration: 'none',
    fontSize: '1rem'
  },
  logoutButton: {
    backgroundColor: '#fff',
    color: '#1976d2',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

export default Navbar;
