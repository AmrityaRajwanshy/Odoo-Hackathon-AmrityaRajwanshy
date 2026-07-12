'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const LayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/';

  if (isAuthPage) {
    return <div className="auth-container">{children}</div>;
  }

  return (
    <div className="app-container">
      <div className="dashboard-frame">
        <Sidebar />
        <div className="main-viewport">
          <Topbar />
          <main className="main-content-scroll">
            {children}
          </main>
        </div>
      </div>

    </div>
  );
};
