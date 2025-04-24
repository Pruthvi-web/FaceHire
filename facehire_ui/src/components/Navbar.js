// src/components/Navbar.js

import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import useUserRole from '../hooks/useUserRole';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth.currentUser;
  const role = useUserRole(user);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dashboardPaths = ['/dashboard', '/candidate/dashboard'];
  const [isCollapsed, setIsCollapsed] = useState(!dashboardPaths.includes(location.pathname));

  useEffect(() => {
    setIsCollapsed(!dashboardPaths.includes(location.pathname));
  }, [location.pathname]);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setDropdownOpen((o) => !o);
  };
  const toggleNavbar = (e) => {
    e.stopPropagation();
    setIsCollapsed((c) => !c);
  };
  const handleProfile = (e) => {
    e.stopPropagation();
    setDropdownOpen(false);
    navigate(role === 'admin' ? '/dashboard/profile' : '/candidate/profile');
  };
  const handleLogout = (e) => {
    e.stopPropagation();
    auth.signOut().then(() => navigate('/login')).catch(console.error);
  };

  return (
    <nav style={styles.navbar} onClick={() => setDropdownOpen(false)}>
      <div style={styles.leftSection}>
        <Link
          to={role === 'admin' ? '/dashboard' : '/candidate/dashboard'}
          style={styles.logo}
        >
          FaceHire
        </Link>
        <button onClick={toggleNavbar} style={styles.toggleButton}>
          {isCollapsed ? '☰' : '✕'}
        </button>
      </div>

      {!isCollapsed && (
        <div style={styles.navLinks}>
          {(role === 'admin' ? [
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/interviews', label: 'Interviews' },
            { to: '/resume-checker', label: 'Resume Checker' },
            { to: '/admin', label: 'Admin Panel' },
          ] : [
            { to: '/candidate-dashboard', label: 'Dashboard' },
            // { to: '/interview', label: 'Interview' },
            { to: '/resume-checker', label: 'Resume Checker' },
          ]).map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                ...styles.link,
                borderBottomColor: isActive ? '#0070f3' : 'transparent'
              })}
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}

      <div style={styles.profileContainer} onClick={toggleDropdown}>
        <div style={styles.profileIcon}>👤</div>
        {dropdownOpen && (
          <div style={styles.dropdown}>
            <div style={styles.dropdownItem} onClick={handleProfile}>
              Profile
            </div>
            <div style={styles.dropdownItem} onClick={handleLogout}>
              Logout
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

const styles = {
  navbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
    backgroundColor: '#fff',
    padding: '0 20px',
    height: 60,
    borderBottom: '1px solid #e1e1e4',
    color: '#1d1d1f',
    position: 'relative',
    zIndex: 100,
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
  },
  logo: {
    fontSize: 20,
    fontWeight: 600,
    color: '#1d1d1f',
    textDecoration: 'none',
    marginRight: 24,
  },
  toggleButton: {
    fontSize: 24,
    background: 'none',
    border: 'none',
    color: '#1d1d1f',
    cursor: 'pointer',
    padding: '8px',
  },
  navLinks: {
    display: 'flex',
    gap: 32,
  },
  link: {
    fontSize: 16,
    fontWeight: 500,
    color: '#1d1d1f',
    textDecoration: 'none',
    padding: '8px 0',
    borderBottom: '2px solid transparent',
    transition: 'border-bottom-color 0.2s',
  },
  profileContainer: {
    position: 'relative',
    cursor: 'pointer',
  },
  profileIcon: {
    fontSize: 24,
    lineHeight: 1,
    padding: 6,
    borderRadius: '50%',
    backgroundColor: '#f5f5f7',
  },
  dropdown: {
    position: 'absolute',
    top: 50,
    right: 0,
    backgroundColor: '#fff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 140,
  },
  dropdownItem: {
    padding: '12px 16px',
    fontSize: 14,
    color: '#1d1d1f',
    cursor: 'pointer',
    borderBottom: '1px solid #e1e1e4',
    transition: 'background-color 0.2s',
  },
};

// Optional: simple hover effect
Object.assign(styles.dropdownItem, {
  ':hover': { backgroundColor: '#f2f2f7' }
});