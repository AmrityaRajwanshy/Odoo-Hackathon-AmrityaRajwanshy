'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { Badge } from '@/components/Badge';

export default function DashboardPage() {
  const { assets, bookings, maintenanceRequests, activityLogs, currentRole, employees, departments } = useApp();

  const [selectedMonth, setSelectedMonth] = useState('2026-07');
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchKpis = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('af_access_token');
        const res = await fetch(`http://localhost:8000/api/reports/dashboard?month=${selectedMonth}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const data = await res.json();
          setKpis(data);
        }
      } catch (err) {
        console.error('Error fetching dashboard KPIs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchKpis();
  }, [selectedMonth, currentRole]);

  // Helper to find Employee name
  const getEmployeeName = (id: string | null) => {
    if (!id) return 'N/A';
    return employees.find(e => e.id === id)?.name || 'Unknown';
  };

  // Shared KPI calculations
  const totalAssetsCount = assets.length;
  const availableCount = kpis ? kpis.assets_available : assets.filter(a => a.status === 'Available').length;
  const allocatedCount = kpis ? kpis.assets_allocated : assets.filter(a => a.status === 'Allocated').length;
  const maintenanceCount = kpis ? kpis.maintenance_today : assets.filter(a => a.status === 'Under Maintenance').length;
  const pendingRequestsCount = kpis ? kpis.pending_transfers : maintenanceRequests.filter(m => m.status === 'Pending').length;
  const upcomingBookingsCount = kpis ? kpis.active_bookings : bookings.filter(b => b.status === 'Upcoming' || b.status === 'Ongoing').length;

  // Overdue assets calculation (Current Date seeded: July 12, 2026)
  const currentDate = new Date('2026-07-12');
  const overdueAssets = assets.filter(a => {
    if (a.status !== 'Allocated' || !a.expectedReturnDate) return false;
    return new Date(a.expectedReturnDate) < currentDate;
  });

  // State for line chart filter pill
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedMaintDay, setSelectedMaintDay] = useState<number | null>(null);

  // 1. ADMIN DASHBOARD VIEW
  const renderAdminDashboard = () => {
    return (
      <div className="dashboard-grid animate-fade">
        {/* Top 3 KPI Stats Row (matches Flex mockup) */}
        <div className="grid-3 stats-row">
          <div className="glass-card stat-pill-card">
            <div className="stat-card-left">
              <div className="stat-icon-circle blue">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="stat-details">
                <span className="stat-label">Active Departments</span>
                <span className="stat-value">{departments.length}</span>
              </div>
            </div>
            <span className="trend-badge positive">↑ 12.5%</span>
          </div>

          <div className="glass-card stat-pill-card">
            <div className="stat-card-left">
              <div className="stat-icon-circle purple">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20H2v-2a3 3 0 015.356-1.857" />
                </svg>
              </div>
              <div className="stat-details">
                <span className="stat-label">Total Employees</span>
                <span className="stat-value">{employees.length}</span>
              </div>
            </div>
            <span className="trend-badge positive">↑ 5.2%</span>
          </div>

          <div className="glass-card stat-pill-card">
            <div className="stat-card-left">
              <div className="stat-icon-circle violet">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                </svg>
              </div>
              <div className="stat-details">
                <span className="stat-label">Registered This Month</span>
                <span className="stat-value">{kpis?.registered_this_month ?? 0}</span>
              </div>
            </div>
            <span className="trend-badge neutral">─ Month</span>
          </div>
        </div>

        {/* Core Layout Split */}
        <div className="grid-2 dashboard-main-split">
          <div className="flex-column gap-1.5">
            {/* SVG Line Graph Card (Online Store Sessions style) */}
            <div className="glass-panel line-graph-card">
              {(() => {
                const points = kpis?.daily_registrations || [];
                const maxCount = Math.max(...points.map((p: any) => p.count), 1);
                const daysCount = points.length || 30;

                const coordPoints = points.map((p: any, i: number) => {
                  const x = (i * 400) / (daysCount - 1);
                  const y = 100 - (p.count / maxCount) * 80;
                  return { x, y, count: p.count, day: p.day };
                });

                let pathD = 'M 0 100 L 400 100';
                let fillD = 'M 0 100 L 400 100 L 400 120 L 0 120 Z';
                
                if (coordPoints.length > 0) {
                  pathD = `M ${coordPoints[0].x} ${coordPoints[0].y} ` + coordPoints.slice(1).map((p: any) => `L ${p.x} ${p.y}`).join(' ');
                  fillD = `${pathD} L 400 120 L 0 120 Z`;
                }

                const activeDays = coordPoints.filter((p: any) => p.count > 0).map((p: any) => p.day);
                const displayDays = activeDays.length > 0 ? activeDays : [1, 5, 10, 15, 20, 25, 30];

                return (
                  <>
                    <div className="card-header-flex">
                      <div>
                        <h3 className="widget-title">Asset Registrations over time</h3>
                        <div className="graph-sub-data">
                          <span className="main-metric">
                            {selectedDay !== null && points.some((p: any) => p.day === selectedDay)
                              ? `${points.find((p: any) => p.day === selectedDay)?.count ?? 0} registered on Day ${selectedDay}`
                              : `Total: ${kpis?.registered_this_month ?? 0} units`}
                          </span>
                          <span className={`trend-metric ${(kpis?.growth_rate ?? 0) > 0 ? 'positive' : (kpis?.growth_rate ?? 0) < 0 ? 'negative' : 'neutral'}`}>
                            {(kpis?.growth_rate ?? 0) > 0 
                              ? `↑ ${kpis.growth_rate}% MoM growth` 
                              : (kpis?.growth_rate ?? 0) < 0 
                                ? `↓ ${Math.abs(kpis.growth_rate)}% MoM decline` 
                                : `─ ${(kpis?.growth_rate ?? 0)}% change`}
                          </span>
                        </div>
                      </div>
                      <div className="period-pill">This Month</div>
                    </div>

                    {/* Line graph canvas */}
                    <div className="graph-canvas-wrapper">
                      <svg viewBox="0 0 400 120" className="dashboard-svg-line">
                        <defs>
                          <linearGradient id="glow-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25"/>
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d={fillD} fill="url(#glow-grad)" />
                        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="3" />
                        {coordPoints.filter((p: any) => p.count > 0).map((p: any, idx: number) => (
                          <circle key={idx} cx={p.x} cy={p.y} r="4" fill="var(--bg-elevated)" stroke="var(--accent)" strokeWidth="2" />
                        ))}
                      </svg>
                    </div>

                    {/* Day selection pills */}
                    <div className="day-picker-row">
                      {displayDays.map((d: number) => (
                        <button 
                          key={d} 
                          className={`day-pill ${selectedDay === d ? 'active' : ''}`}
                          onClick={() => setSelectedDay(selectedDay === d ? null : d)}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Overdue alert band */}
            {overdueAssets.length > 0 && (
              <div className="alert-box alert-danger">
                <div className="alert-icon-chip">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <strong className="alert-headline">Overdue Returns Active</strong>
                  <span>{overdueAssets.length} assets require collection audits.</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-column gap-1.5">
            {/* Linear Progress Card (Replacing Circle part!) */}
            <div className="linear-progress-card">
              <div className="progress-header-flex">
                <span className="progress-title-meta">Active Allocation Rate</span>
                <span className="progress-val-text">
                  {totalAssetsCount > 0 ? Math.round((allocatedCount / totalAssetsCount) * 100) : 0}%
                </span>
              </div>
              <div className="linear-progress-bar-wrapper">
                <div 
                  className="linear-progress-bar-fill" 
                  style={{ width: `${totalAssetsCount > 0 ? (allocatedCount / totalAssetsCount) * 100 : 0}%` }}
                ></div>
              </div>
              <div className="progress-grid-metrics">
                <div className="metric-item-block">
                  <span className="metric-item-label">Allocated Units</span>
                  <span className="metric-item-val">{allocatedCount}</span>
                </div>
                <div className="metric-item-block">
                  <span className="metric-item-label">Available Units</span>
                  <span className="metric-item-val">{availableCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 2. ASSET MANAGER DASHBOARD VIEW
  const renderManagerDashboard = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const resolvedTrend = last7Days.map(dateStr => {
      const count = maintenanceRequests.filter(m => 
        m.status === 'Resolved' && m.dateRaised.startsWith(dateStr)
      ).length;
      return { date: dateStr, day: parseInt(dateStr.split('-')[2]), count };
    });

    const maxMaintCount = Math.max(...resolvedTrend.map(d => d.count), 1);
    const maintCoords = resolvedTrend.map((d, i) => {
      const x = (i * 400) / 6;
      const y = 100 - (d.count / maxMaintCount) * 80;
      return { x, y, count: d.count, day: d.day };
    });

    let maintPathD = 'M 0 100 L 400 100';
    let maintFillD = 'M 0 100 L 400 100 L 400 120 L 0 120 Z';
    if (maintCoords.length > 0) {
      maintPathD = `M ${maintCoords[0].x} ${maintCoords[0].y} ` + maintCoords.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
      maintFillD = `${maintPathD} L 400 120 L 0 120 Z`;
    }

    const totalResolved = maintenanceRequests.filter(m => m.status === 'Resolved').length;
    const productivityTrend = totalResolved > 0 
      ? `↑ ${Math.round((totalResolved / (maintenanceRequests.length || 1)) * 100)}% resolution rate` 
      : '─ No tickets resolved';

    return (
      <div className="dashboard-grid animate-fade">
        {/* Top 3 KPI Stats Row (matches Flex mockup) */}
        <div className="grid-3 stats-row">
          <div className="glass-card stat-pill-card">
            <div className="stat-card-left">
              <div className="stat-icon-circle blue">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="stat-details">
                <span className="stat-label">Active Bookings</span>
                <span className="stat-value">{upcomingBookingsCount}</span>
              </div>
            </div>
            <span className="trend-badge positive">↑ 3.5%</span>
          </div>

          <div className="glass-card stat-pill-card">
            <div className="stat-card-left">
              <div className="stat-icon-circle warning">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="stat-details">
                <span className="stat-label">In Maintenance</span>
                <span className="stat-value">{maintenanceCount}</span>
              </div>
            </div>
            <span className="trend-badge positive">↑ 15.6%</span>
          </div>

          <div className="glass-card stat-pill-card">
            <div className="stat-card-left">
              <div className="stat-icon-circle purple">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="stat-details">
                <span className="stat-label">Awaiting Approval</span>
                <span className="stat-value">{pendingRequestsCount}</span>
              </div>
            </div>
            <span className="trend-badge negative">↓ 6.2%</span>
          </div>
        </div>

        {/* Core Layout Split */}
        <div className="grid-2 dashboard-main-split">
          <div className="flex-column gap-1.5">
            {/* SVG Line Graph Card (Online Store Sessions style) */}
            <div className="glass-panel line-graph-card">
              <div className="card-header-flex">
                <div>
                  <h3 className="widget-title">Maintenance Tickets Resolved</h3>
                  <div className="graph-sub-data">
                    <span className="main-metric">
                      {selectedMaintDay !== null && resolvedTrend.some((p: any) => p.day === selectedMaintDay)
                        ? `${resolvedTrend.find((p: any) => p.day === selectedMaintDay)?.count ?? 0} resolved on Day ${selectedMaintDay}`
                        : `Total: ${totalResolved} units`}
                    </span>
                    <span className={`trend-metric ${totalResolved > 0 ? 'positive' : 'neutral'}`}>
                      {productivityTrend}
                    </span>
                  </div>
                </div>
                <div className="period-pill">This Week</div>
              </div>

              {/* Line graph canvas */}
              <div className="graph-canvas-wrapper">
                <svg viewBox="0 0 400 120" className="dashboard-svg-line">
                  <path d={maintFillD} fill="url(#glow-grad)" />
                  <path d={maintPathD} fill="none" stroke="var(--accent)" strokeWidth="3" />
                  {maintCoords.filter((p: any) => p.count > 0).map((p: any, idx: number) => (
                    <circle key={idx} cx={p.x} cy={p.y} r="4" fill="var(--bg-elevated)" stroke="var(--accent)" strokeWidth="2" />
                  ))}
                </svg>
              </div>

              {/* Day selection pills */}
              <div className="day-picker-row">
                {resolvedTrend.map((d: any) => (
                  <button 
                    key={d.day} 
                    className={`day-pill ${selectedMaintDay === d.day ? 'active' : ''}`}
                    onClick={() => setSelectedMaintDay(selectedMaintDay === d.day ? null : d.day)}
                  >
                    {d.day}
                  </button>
                ))}
              </div>
            </div>

            {/* Overdue alert band */}
            {overdueAssets.length > 0 && (
              <div className="alert-box alert-warning">
                <div className="alert-icon-chip">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <strong className="alert-headline">Overdue Asset Allocations</strong>
                  <span>{overdueAssets.length} items require collection actions.</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-column gap-1.5">
            {/* Linear Progress Card (Replacing Circle part!) */}
            <div className="linear-progress-card">
              <div className="progress-header-flex">
                <span className="progress-title-meta">Equipment Allocation Ratio</span>
                <span className="progress-val-text">
                  {totalAssetsCount > 0 ? Math.round((allocatedCount / totalAssetsCount) * 100) : 0}%
                </span>
              </div>
              <div className="linear-progress-bar-wrapper">
                <div 
                  className="linear-progress-bar-fill" 
                  style={{ width: `${totalAssetsCount > 0 ? (allocatedCount / totalAssetsCount) * 100 : 0}%` }}
                ></div>
              </div>
              <div className="progress-grid-metrics">
                <div className="metric-item-block">
                  <span className="metric-item-label">Allocated Units</span>
                  <span className="metric-item-val">{allocatedCount}</span>
                </div>
                <div className="metric-item-block">
                  <span className="metric-item-label">Total Assets</span>
                  <span className="metric-item-val">{totalAssetsCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 3. EMPLOYEE DASHBOARD VIEW
  const renderEmployeeDashboard = () => {
    // Assets currently held by the logged-in employee (Rohan Mehta e2 or Sumit Verma e1)
    const RohanAssets = assets.filter(a => a.currentHolderId === 'e1' || a.currentHolderId === 'e2');
    const employeeBookings = bookings.filter(b => b.requesterId === 'e1' || b.requesterId === 'e2');

    return (
      <div className="dashboard-grid animate-fade">
        {/* Top 3 KPI Stats Row (matches Flex mockup) */}
        <div className="grid-3 stats-row">
          <div className="glass-card stat-pill-card">
            <div className="stat-card-left">
              <div className="stat-icon-circle blue">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="stat-details">
                <span className="stat-label">My Held Assets</span>
                <span className="stat-value">{RohanAssets.length}</span>
              </div>
            </div>
            <span className="trend-badge positive">↑ 3.5%</span>
          </div>

          <div className="glass-card stat-pill-card">
            <div className="stat-card-left">
              <div className="stat-icon-circle purple">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="stat-details">
                <span className="stat-label">My Scheduled Bookings</span>
                <span className="stat-value">{employeeBookings.length}</span>
              </div>
            </div>
            <span className="trend-badge positive">↑ 15.6%</span>
          </div>

          <div className="glass-card stat-pill-card">
            <div className="stat-card-left">
              <div className="stat-icon-circle warning">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="stat-details">
                <span className="stat-label">My Raised Tickets</span>
                <span className="stat-value">{maintenanceRequests.filter(m => m.status !== 'Resolved').length}</span>
              </div>
            </div>
            <span className="trend-badge negative">↓ 6.2%</span>
          </div>
        </div>

        {/* Core Layout Split - 3-column grid for perfect height and visual symmetry */}
        <div className="grid-3 dashboard-main-split">
          {/* Column 1: My Allocated Equipment */}
          <div className="glass-panel line-graph-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 className="widget-title" style={{ marginBottom: '16px' }}>My Allocated Equipment</h3>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {RohanAssets.length === 0 ? (
                <div className="empty-state-container">
                  <span className="empty-state-message">No active assets allocated to you.</span>
                </div>
              ) : (
                <div className="assets-held-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                  {RohanAssets.map((asset) => (
                    <div key={asset.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          background: 'var(--accent-muted-bg)',
                          color: 'var(--accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px'
                        }}>
                          {asset.category === 'Electronics' ? '💻' : asset.category === 'Furniture' ? '🪑' : '📦'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="mono-text" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '11px' }}>{asset.tag}</span>
                            <span className="badge badge-success" style={{ fontSize: '9px', padding: '1px 6px' }}>{asset.status}</span>
                          </div>
                          <h4 style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: 'var(--text-primary)' }}>{asset.name}</h4>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Due Return</span>
                        <span className="mono-text" style={{ fontSize: '12px', color: 'var(--status-warning)', fontWeight: 600 }}>{asset.expectedReturnDate || 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Column 2: My Allocation Limits */}
          <div className="linear-progress-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="progress-header-flex" style={{ marginBottom: '16px' }}>
                <span className="progress-title-meta" style={{ fontSize: '15px', fontWeight: 700 }}>My Allocation Limits</span>
                <span className="progress-val-text">{Math.round((RohanAssets.length / 4) * 100)}%</span>
              </div>
              <div className="linear-progress-bar-wrapper" style={{ marginBottom: '24px' }}>
                <div 
                  className="linear-progress-bar-fill" 
                  style={{ width: `${(RohanAssets.length / 4) * 100}%` }}
                ></div>
              </div>
            </div>
            <div className="progress-grid-metrics">
              <div className="metric-item-block">
                <span className="metric-item-label">Held Assets</span>
                <span className="metric-item-val" style={{ fontSize: '20px' }}>{RohanAssets.length}</span>
              </div>
              <div className="metric-item-block">
                <span className="metric-item-label">Max Limit</span>
                <span className="metric-item-val" style={{ fontSize: '20px' }}>4</span>
              </div>
            </div>
          </div>

          {/* Column 3: Promo Card Widget */}
          <div className="promo-banner-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="promo-content" style={{ maxWidth: '100%' }}>
              <h3 className="promo-headline" style={{ fontSize: '18px', marginBottom: '10px' }}>Need New Resources?</h3>
              <p className="promo-text" style={{ fontSize: '12px', opacity: 0.9, lineHeight: '1.4' }}>Book meeting spaces, reserve transport vans, or request device replacements.</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <Link href="/booking" className="btn btn-promo">Book Room</Link>
                <Link href="/maintenance" className="btn btn-promo-secondary">Raise ticket</Link>
              </div>
            </div>
            <div className="promo-bg-decoration"></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      {/* Page Header (Greeting + simulated role badge) */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>{currentRole} Workspace</span>
          </h1>
          <p className="page-subtitle">Simulating {currentRole} access layout views and custom dashboard logs.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="date-selector" style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '6px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="month-picker-select"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                fontFamily: 'inherit',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                outline: 'none',
                padding: '0',
                margin: '0',
                appearance: 'none',
                WebkitAppearance: 'none'
              }}
            >
              <option value="2026-07">July 2026</option>
              <option value="2026-06">June 2026</option>
              <option value="2026-05">May 2026</option>
              <option value="2026-04">April 2026</option>
              <option value="2026-03">March 2026</option>
              <option value="2026-02">February 2026</option>
              <option value="2026-01">January 2026</option>
            </select>
          </div>
          <Link href="/reports" className="btn btn-primary">View Reports</Link>
        </div>
      </div>

      {/* Render appropriate Dashboard View based on role state */}
      {currentRole === 'Admin' && renderAdminDashboard()}
      {currentRole === 'Asset Manager' && renderManagerDashboard()}
      {currentRole === 'Employee' && renderEmployeeDashboard()}

      {/* Recent activity timeline at bottom */}
      <div className="glass-panel activity-footer-panel" style={{ padding: '24px' }}>
        <h3 className="section-title" style={{ marginBottom: '20px' }}>Operational Feed Timeline</h3>
        <div className="timeline">
          {activityLogs.slice(0, 4).map((log) => (
            <div key={log.id} className="timeline-item">
              <div className="timeline-date">{log.timestamp}</div>
              <div className="timeline-title">{log.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
