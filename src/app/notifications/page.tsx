'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function NotificationsPage() {
  const { activityLogs } = useApp();
  const [filterTab, setFilterTab] = useState<'All' | 'Alerts' | 'Approvals' | 'Bookings'>('All');

  // Filter logs reactively based on content
  const getFilteredLogs = () => {
    switch (filterTab) {
      case 'Alerts':
        // Warning logs, overdue alerts, lost assets, discrepancies
        return activityLogs.filter(log => 
          log.type === 'warning' || 
          log.type === 'alert' || 
          log.message.toLowerCase().includes('overdue') || 
          log.message.toLowerCase().includes('lost') || 
          log.message.toLowerCase().includes('discrepancy')
        );
      case 'Approvals':
        // Maintenance approvals, transfers
        return activityLogs.filter(log => 
          log.message.toLowerCase().includes('approve') || 
          log.message.toLowerCase().includes('transfer') || 
          log.message.toLowerCase().includes('authorized')
        );
      case 'Bookings':
        // Resource bookings
        return activityLogs.filter(log => 
          log.message.toLowerCase().includes('booking') || 
          log.message.toLowerCase().includes('booked') || 
          log.message.toLowerCase().includes('cancelled')
        );
      case 'All':
      default:
        return activityLogs;
    }
  };

  // Helper to choose corresponding SVG icon for log type
  const getLogIcon = (msg: string) => {
    const text = msg.toLowerCase();
    
    if (text.includes('allocated') || text.includes('assigned')) {
      return (
        /* Asset Allocation Icon */
        <svg width="18" height="18" fill="none" stroke="var(--status-info)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    }
    
    if (text.includes('maintenance') || text.includes('repair')) {
      return (
        /* Maintenance Icon */
        <svg width="18" height="18" fill="none" stroke="var(--status-warning)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    }

    if (text.includes('booking') || text.includes('booked')) {
      return (
        /* Booking Icon */
        <svg width="18" height="18" fill="none" stroke="var(--status-success)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }

    if (text.includes('transfer')) {
      return (
        /* Transfer Icon */
        <svg width="18" height="18" fill="none" stroke="var(--accent)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    }

    if (text.includes('audit') || text.includes('discrepancy') || text.includes('lost') || text.includes('missing')) {
      return (
        /* Alert/Audit Warning Icon */
        <svg width="18" height="18" fill="none" stroke="var(--status-danger)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }

    return (
      /* Default Info Icon */
      <svg width="18" height="18" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  const getLogBorderClass = (msg: string) => {
    const text = msg.toLowerCase();
    if (text.includes('lost') || text.includes('overdue') || text.includes('discrepancy') || text.includes('cancelled')) {
      return 'border-left-danger';
    }
    if (text.includes('maintenance') || text.includes('warning') || text.includes('request')) {
      return 'border-left-warning';
    }
    if (text.includes('allocated') || text.includes('transfer') || text.includes('booking')) {
      return 'border-left-info';
    }
    return 'border-left-default';
  };

  const logs = getFilteredLogs();

  return (
    <div className="notifications-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity Logs & Notifications</h1>
          <p className="page-subtitle">Track operational event logs, transfer alerts, and cycle check histories.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button 
          className={`tab-btn ${filterTab === 'All' ? 'active' : ''}`}
          onClick={() => setFilterTab('All')}
        >
          All Activities
        </button>
        <button 
          className={`tab-btn ${filterTab === 'Alerts' ? 'active' : ''}`}
          onClick={() => setFilterTab('Alerts')}
        >
          Alerts & Overdues
        </button>
        <button 
          className={`tab-btn ${filterTab === 'Approvals' ? 'active' : ''}`}
          onClick={() => setFilterTab('Approvals')}
        >
          Approvals & Transfers
        </button>
        <button 
          className={`tab-btn ${filterTab === 'Bookings' ? 'active' : ''}`}
          onClick={() => setFilterTab('Bookings')}
        >
          Resource Bookings
        </button>
      </div>

      {/* Log Feed */}
      <div className="notifications-feed-wrapper">
        {logs.length === 0 ? (
          <div className="empty-state-container" style={{ padding: '64px 32px' }}>
            <div className="empty-state-icon">
              <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="section-title" style={{ marginTop: '12px' }}>No notifications</h3>
            <p className="empty-state-message">Event logs matching this filter category are empty.</p>
          </div>
        ) : (
          <div className="notifications-list">
            {logs.map((log) => (
              <div key={log.id} className={`notification-item glass-card ${getLogBorderClass(log.message)}`}>
                <div className="item-left">
                  <div className="item-icon-wrapper">
                    {getLogIcon(log.message)}
                  </div>
                  <div className="item-content">
                    <p className="notification-message">{log.message}</p>
                    <span className="notification-date-iso">{new Date(log.dateCreated).toLocaleString()}</span>
                  </div>
                </div>
                <div className="item-right-timestamp">
                  <span className="timestamp-badge">{log.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
