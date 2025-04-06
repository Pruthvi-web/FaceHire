// src/components/Layout.js

import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

function Layout() {
  return (
    <>
      <Navbar />
      <div style={{ marginTop: '60px' }}>
        <Outlet />
      </div>
    </>
  );
}

export default Layout;
