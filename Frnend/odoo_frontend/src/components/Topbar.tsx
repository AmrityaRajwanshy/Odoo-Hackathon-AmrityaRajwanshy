'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export const Topbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { currentRole, setCurrentRole, currentUser, theme, setTheme } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const handleStorageChange = () => {
      if (typeof window !== 'undefined' && currentUser) {
        const saved = localStorage.getItem(`af_avatar_${currentUser.id}`);
        setAvatarUrl(saved);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    handleStorageChange();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [currentUser]);

  // If we are on the login page, don't show the topbar
  if (pathname === '/login' || pathname === '/') {
    return null;
  }

  // Determine page title based on path
  const getPageTitle = (path: string) => {
    switch (path) {
      case '/dashboard':
        return 'Dashboard';
      case '/setup':
        return 'Organization Setup';
      case '/assets':
        return 'Assets Directory';
      case '/allocation':
        return 'Allocation & Transfer';
      case '/booking':
        return 'Resource Booking';
      case '/maintenance':
        return 'Maintenance Management';
      case '/audit':
        return 'Asset Audit';
      case '/reports':
        return 'Reports & Analytics';
      case '/notifications':
        return 'Activity Logs';
      default:
        return 'AssetFlow';
    }
  };

  const handleRoleChange = (role: 'Admin' | 'Asset Manager' | 'Employee') => {
    setCurrentRole(role);
    setDropdownOpen(false);

    // If changing role requires redirection
    if (role === 'Employee' && (pathname === '/setup' || pathname === '/maintenance' || pathname === '/audit' || pathname === '/reports')) {
      router.push('/dashboard');
    } else if (role === 'Asset Manager' && pathname === '/setup') {
      router.push('/dashboard');
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="topbar">
      {/* 1. Left side title with icon */}
      <div className="title-section">
        <div className="title-icon-wrapper">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        <h1 className="topbar-title">{getPageTitle(pathname)}</h1>
      </div>

      {/* 2. Centered Pill Search Input */}
      <div className="search-section">
        <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" className="search-input" placeholder="Search assets, requests, files..." />
      </div>

      {/* 3. Right Section */}
      <div className="user-section">
        {/* Theme Switcher Toggle */}
        <button 
          className="theme-toggle-btn" 
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-11.314l.707.707m11.314 11.314l.707-.707M12 7a5 5 0 100 10 5 5 0 000-10z" />
            </svg>
          ) : (
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Notification Bell with Badge */}
        <div className="notification-bell-container">
          <button className="theme-toggle-btn">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="bell-badge"></span>
          </button>
        </div>

        <div className="divider"></div>

        {/* Role Selector Dropdown */}
        <div className="role-selector-container">
          <button className="role-switcher-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <div className="role-indicator">
              <span className="pulse-dot"></span>
              <span className="role-label">Role:</span>
              <span className="role-value">{currentRole}</span>
            </div>
            <svg className={`chevron-icon ${dropdownOpen ? 'open' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="role-dropdown glass-card">
              <div className="dropdown-header">Choose Role to Simulate</div>
              <button 
                className={`dropdown-item ${currentRole === 'Admin' ? 'active' : ''}`}
                onClick={() => handleRoleChange('Admin')}
              >
                <span>Admin</span>
                <span className="role-desc">Full org settings, directory rights, audit capabilities</span>
              </button>
              <button 
                className={`dropdown-item ${currentRole === 'Asset Manager' ? 'active' : ''}`}
                onClick={() => handleRoleChange('Asset Manager')}
              >
                <span>Asset Manager</span>
                <span className="role-desc">Manage allocations, bookings, maintenance, and audits</span>
              </button>
              <button 
                className={`dropdown-item ${currentRole === 'Employee' ? 'active' : ''}`}
                onClick={() => handleRoleChange('Employee')}
              >
                <span>Employee (Default)</span>
                <span className="role-desc">View own assets, request bookings/maintenance</span>
              </button>
            </div>
          )}
        </div>


        {/* User Profile Info (greetings badge) */}
        <Link href="/profile" className="user-profile" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="user-avatar-chip" style={{ overflow: 'hidden', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          <div className="user-details">
            <span className="greeting-text">Hi, {currentUser.name.split(' ')[0]}</span>
          </div>
        </Link>
      </div>

    </header>
  );
};
