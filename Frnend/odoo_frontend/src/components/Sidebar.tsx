'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import LineSidebar from './LineSidebar';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { currentRole } = useApp();

  // If we are on the login page, don't show the sidebar
  if (pathname === '/login' || pathname === '/') {
    return null;
  }

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', roles: ['Admin', 'Asset Manager', 'Employee'] },
    { name: 'Organization Setup', path: '/setup', roles: ['Admin'] },
    { name: 'Assets Directory', path: '/assets', roles: ['Admin', 'Asset Manager', 'Employee'] },
    { name: 'Allocation & Transfer', path: '/allocation', roles: ['Admin', 'Asset Manager', 'Employee'] },
    { name: 'Resource Booking', path: '/booking', roles: ['Admin', 'Asset Manager', 'Employee'] },
    { name: 'Maintenance', path: '/maintenance', roles: ['Admin', 'Asset Manager'] },
    { name: 'Asset Audit', path: '/audit', roles: ['Admin', 'Asset Manager'] },
    { name: 'Reports & Analytics', path: '/reports', roles: ['Admin', 'Asset Manager'] },
    { name: 'Activity Logs', path: '/notifications', roles: ['Admin', 'Asset Manager', 'Employee'] }
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(currentRole));
  const items = visibleNavItems.map(item => item.name);
  const activeIndex = visibleNavItems.findIndex(item => item.path === pathname);

  const handleItemClick = (index: number) => {
    const item = visibleNavItems[index];
    if (item) {
      router.push(item.path);
    }
  };

  const handleLogout = () => {
    router.push('/login');
  };

  return (
    <aside className="sidebar">
      {/* Monogram Brand Header */}
      <div className="logo-container">
        <div className="logo-icon">AF</div>
        <span className="logo-text">AssetFlow</span>
      </div>

      <div className="sidebar-scrollable-content">
        {/* Menu Section with React Bits LineSidebar */}
        <div className="sidebar-group">
          <div className="group-label" style={{ marginBottom: '16px' }}>Menu</div>
          <LineSidebar
            items={items}
            defaultActive={activeIndex !== -1 ? activeIndex : 0}
            onItemClick={handleItemClick}
            accentColor="var(--accent)"
            textColor="var(--text-secondary)"
            markerColor="var(--border-strong)"
            showIndex={true}
            showMarker={true}
            proximityRadius={50}
            maxShift={4}
            falloff="smooth"
            markerLength={16}
            markerGap={6}
            tickScale={0.5}
            scaleTick={true}
            itemGap={12}
            fontSize={0.82}
            smoothing={120}
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="sidebar-footer">
        <button onClick={handleLogout} className="logout-btn">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
