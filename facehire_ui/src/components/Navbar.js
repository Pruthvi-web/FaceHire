// src/components/Navbar.js

import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import useUserRole from '../hooks/useUserRole';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth.currentUser;
  const role = useUserRole(user);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Determine if the current route is the "dashboard" page (for admin or candidate).
  const dashboardPaths = ['/dashboard', '/candidate/dashboard'];
  // If on a dashboard page, expand navbar by default; otherwise, collapse.
  const [isCollapsed, setIsCollapsed] = useState(!dashboardPaths.includes(location.pathname));

  // When location changes, update collapsed state accordingly.
  useEffect(() => {
    if (dashboardPaths.includes(location.pathname)) {
      setIsCollapsed(false);
    } else {
      setIsCollapsed(true);
    }
  }, [location.pathname]);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setDropdownOpen(prev => !prev);
  };

  const toggleNavbar = (e) => {
    e.stopPropagation();
    setIsCollapsed(prev => !prev);
  };

  const handleProfile = (e) => {
    e.stopPropagation();
    setDropdownOpen(false);
    // Navigate to profile page based on role.
    if (role === 'admin') {
      navigate('/dashboard/profile');
    } else {
      navigate('/candidate/profile');
    }
  };

  const handleLogout = (e) => {
    e.stopPropagation();
    auth.signOut()
      .then(() => {
        navigate('/login');
      })
      .catch((error) => {
        console.error('Logout error:', error);
      });
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
          {role === 'admin' ? (
            <>
              <NavLink to="/dashboard" style={styles.link}>
                Dashboard
              </NavLink>
              <NavLink to="/interviews" style={styles.link}>
                Interviews
              </NavLink>
              <NavLink to="/resume-checker" style={styles.link}>
                Resume Checker
              </NavLink>
              <NavLink to="/admin" style={styles.link}>
                Admin Panel
              </NavLink>
            </>
          ) : (
            <>
              {/* For candidates, include a link to their dashboard */}
              <NavLink to="/candidate-dashboard" style={styles.link}>
                Dashboard
              </NavLink>
              <NavLink to="/interview" style={styles.link}>
                Interview
              </NavLink>
              <NavLink to="/resume-checker" style={styles.link}>
                Resume Checker
              </NavLink>
              {/* <NavLink to="/past-interviews" style={styles.link}>
                Past Interviews
              </NavLink> */}
            </>
          )}
        </div>
      )}
      <div style={styles.profileContainer} onClick={toggleDropdown}>
        <span role="img" aria-label="profile" style={styles.profileIcon}>
          👤
        </span>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1976d2',
    padding: '10px 20px',
    color: '#fff',
    position: 'relative'
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center'
  },
  logo: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#fff',
    textDecoration: 'none',
    marginRight: '10px'
  },
  toggleButton: {
    fontSize: '1.5rem',
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer'
  },
  navLinks: {
    display: 'flex',
    gap: '15px'
  },
  link: {
    color: '#fff',
    textDecoration: 'none'
  },
  profileContainer: {
    position: 'relative',
    cursor: 'pointer'
  },
  profileIcon: {
    fontSize: '1.5rem'
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: '40px',
    backgroundColor: '#fff',
    color: '#1976d2',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  dropdownItem: {
    padding: '10px 20px',
    cursor: 'pointer',
    borderBottom: '1px solid #eee'
  }
};

export default Navbar;
