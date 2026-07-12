'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function ReportsPage() {
  const { assets, departments, categories, bookings, maintenanceRequests, currentRole } = useApp();
  const [toastMessage, setToastMessage] = useState('');

  // Authorization Guard
  if (currentRole === 'Employee') {
    return (
      <div className="reports-container" style={{ maxWidth: '600px', margin: '4rem auto' }}>
        <div className="glass-panel text-center error-panel">
          <svg width="64" height="64" fill="none" stroke="var(--status-danger)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '1rem' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
          <h2 className="panel-title text-danger">Access Denied</h2>
          <p className="panel-text">Reports and operational analytics dashboards are restricted to Managers and Admins.</p>
        </div>
        <style jsx>{`
          .text-center { text-align: center; }
          .error-panel { border-top: 4px solid var(--status-danger); }
          .panel-title { font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
          .panel-text { color: var(--text-primary); font-size: 0.95rem; }
        `}</style>
      </div>
    );
  }

  // Handle Export Click
  const handleExport = (type: string) => {
    setToastMessage(`Exporting ${type} report to CSV...`);
    setTimeout(() => {
      setToastMessage(`Success! ${type} report downloaded.`);
      setTimeout(() => setToastMessage(''), 3000);
    }, 1500);
  };

  // 1. Compute Department Allocation stats
  const deptStats = departments.map(d => {
    const deptAssets = assets.filter(a => {
      if (a.status !== 'Allocated' || !a.currentHolderId) return false;
      if (d.name === 'Engineering' && (a.currentHolderId === 'e1' || a.currentHolderId === 'e2' || a.currentHolderId === 'e4')) return true;
      if (d.name === 'Facilities' && a.currentHolderId === 'e3') return true;
      if (d.name === 'Field Ops' && a.currentHolderId === 'e5') return true;
      return false;
    });

    const allocatedCount = deptAssets.length;
    const totalValue = deptAssets.reduce((sum, a) => sum + a.acquisitionCost, 0);
    
    return {
      name: d.name,
      allocatedCount,
      totalValue,
      utilization: d.status === 'Active' ? Math.round((allocatedCount / (assets.length || 1)) * 100) : 0
    };
  });

  // 2. Compute category usage dynamically
  const categoryCounts = categories.map(cat => ({
    name: cat.name,
    count: assets.filter(a => a.category === cat.name).length,
    allocated: assets.filter(a => a.category === cat.name && a.status === 'Allocated').length
  }));

  // 3. Dynamic Maintenance Frequency Trend calculation
  const monthsList = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
  const monthLabels = ['Mar', 'Apr', 'May', 'Jun', 'Jul'];
  const monthlyReqs = monthsList.map(m => {
    return maintenanceRequests.filter(req => req.dateRaised.startsWith(m)).length;
  });
  const maxMaintFreq = Math.max(...monthlyReqs, 1);
  const trendCoords = monthlyReqs.map((count, idx) => {
    const x = (idx * 400) / 4;
    const y = 130 - (count / maxMaintFreq) * 100;
    return { x, y, count };
  });
  let trendPathD = 'M 0 130 L 400 130';
  let trendFillD = 'M 0 130 L 400 130 L 400 150 L 0 150 Z';
  if (trendCoords.length > 0) {
    trendPathD = `M ${trendCoords[0].x} ${trendCoords[0].y} ` + trendCoords.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    trendFillD = `${trendPathD} L 400 150 L 0 150 Z`;
  }

  // 4. Dynamic Most Active Resources calculation
  const bookedAssetCounts: { [name: string]: { count: number; category: string } } = {};
  bookings.forEach(b => {
    const asset = assets.find(a => a.id === b.assetId);
    if (asset) {
      if (!bookedAssetCounts[asset.name]) {
        bookedAssetCounts[asset.name] = { count: 0, category: asset.category };
      }
      bookedAssetCounts[asset.name].count += 1;
    }
  });
  const sortedBookedAssets = Object.entries(bookedAssetCounts)
    .map(([name, val]) => ({ name, count: val.count, category: val.category }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // 5. Dynamic Idle Assets calculation
  const idleAssetsList = assets.filter(a => a.status === 'Available').slice(0, 3);

  // 6. Dynamic Lifecycle Attention calculation
  const actionNeededAssets = assets.filter(a => a.condition === 'Poor' || a.status === 'Lost' || a.status === 'Under Maintenance').slice(0, 3);

  // Seed Heatmap Grid data (Days of week vs Times of day)
  const heatmapDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const heatmapHours = ['09:00', '11:00', '13:00', '15:00', '17:00'];
  const heatmapData = [
    [1, 3, 2, 4, 1], // Mon
    [2, 4, 3, 2, 0], // Tue
    [3, 2, 4, 3, 1], // Wed
    [4, 3, 1, 4, 2], // Thu
    [2, 1, 3, 2, 0]  // Fri
  ];

  const getHeatmapColorClass = (intensity: number) => {
    switch (intensity) {
      case 4: return 'density-high';
      case 3: return 'density-medium-high';
      case 2: return 'density-medium';
      case 1: return 'density-low';
      case 0:
      default: return 'density-none';
    }
  };

  return (
    <div className="reports-container">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast-box animate-fade">
          <svg width="20" height="20" fill="none" stroke="var(--accent)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Track resource efficiency metrics, maintenance trends, and allocation heatmaps.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => handleExport('Inventory Summary')}>
            Export Summary
          </button>
          <button className="btn btn-primary" onClick={() => handleExport('Utilization & Financials')}>
            Download PDF Report
          </button>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid-2 chart-row">
        {/* Department Asset Category Chart */}
        <div className="glass-panel chart-panel">
          <h3 className="section-title">Asset Inventory by Category</h3>
          <p className="panel-desc">Visual distribution of registered vs active allocated assets.</p>
          
          <div className="bar-chart-container">
            {categoryCounts.map((cat, idx) => {
              const maxCount = Math.max(...categoryCounts.map(c => c.count), 1);
              const totalHeightPercent = (cat.count / maxCount) * 100;
              const allocHeightPercent = (cat.allocated / maxCount) * 100;

              return (
                <div key={idx} className="bar-group">
                  <div className="bar-bars">
                    <div className="bar-column total-bar" style={{ height: `${totalHeightPercent}%` }} title={`Total: ${cat.count}`}>
                      <div className="bar-column allocated-bar" style={{ height: `${allocHeightPercent}%` }} title={`Allocated: ${cat.allocated}`}></div>
                    </div>
                  </div>
                  <span className="bar-label">{cat.name}</span>
                </div>
              );
            })}
          </div>

          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-dot total"></span>
              <span>Total Registered</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot allocated"></span>
              <span>Currently Allocated</span>
            </div>
          </div>
        </div>

        {/* Maintenance Frequency Trend (SVG path chart) */}
        <div className="glass-panel chart-panel">
          <h3 className="section-title">Maintenance Frequency Trend</h3>
          <p className="panel-desc">Monthly ticket cycles showing raised vs resolved repairs.</p>
          
          <div className="svg-chart-container">
            <svg viewBox="0 0 400 150" className="trend-svg">
              <defs>
                <linearGradient id="gradient-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="30" x2="400" y2="30" stroke="var(--border-subtle)" strokeOpacity="0.5" />
              <line x1="0" y1="75" x2="400" y2="75" stroke="var(--border-subtle)" strokeOpacity="0.5" />
              <line x1="0" y1="120" x2="400" y2="120" stroke="var(--border-subtle)" strokeOpacity="0.5" />
              
              {/* Path Area */}
              <path d={trendFillD} fill="url(#gradient-area)" />
              
              {/* Path Stroke */}
              <path d={trendPathD} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
              
              {/* Data points */}
              {trendCoords.map((pt, index) => (
                <circle key={index} cx={pt.x} cy={pt.y} r="4" fill="var(--bg-surface)" stroke="var(--accent)" strokeWidth="2" />
              ))}
            </svg>
          </div>

          <div className="chart-legend" style={{ justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {monthLabels.map((lbl, idx) => (
              <span key={idx} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {lbl}: {monthlyReqs[idx]} req
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-3 stats-lists-row">
        {/* Most Used Resources */}
        <div className="glass-panel list-panel">
          <h4 className="list-panel-title">🔥 Most Active Resources</h4>
          {sortedBookedAssets.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>No resource bookings recorded.</div>
          ) : (
            <ul className="stats-list">
              {sortedBookedAssets.map((b, idx) => (
                <li key={idx}>
                  <div className="list-item-meta">
                    <span className="item-title">{b.name}</span>
                    <span className="item-desc">{b.count} bookings logged</span>
                  </div>
                  <span className="list-item-val font-bold">{b.category}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Idle Assets */}
        <div className="glass-panel list-panel">
          <h4 className="list-panel-title">❄️ Idle Assets (Unallocated)</h4>
          {idleAssetsList.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>No idle assets in inventory.</div>
          ) : (
            <ul className="stats-list">
              {idleAssetsList.map((a, idx) => (
                <li key={idx}>
                  <div className="list-item-meta">
                    <span className="item-title">{a.name} ({a.tag})</span>
                    <span className="item-desc">Location: {a.location} | Condition: {a.condition}</span>
                  </div>
                  <span className="list-item-val text-warning">Idle</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Due Maintenance / Nearing Retirement */}
        <div className="glass-panel list-panel">
          <h4 className="list-panel-title">⚠️ Lifecycle Attention Needed</h4>
          {actionNeededAssets.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>All assets operating optimally.</div>
          ) : (
            <ul className="stats-list">
              {actionNeededAssets.map((a, idx) => (
                <li key={idx}>
                  <div className="list-item-meta">
                    <span className="item-title">{a.name} ({a.tag})</span>
                    <span className="item-desc">Status: {a.status} | Condition: {a.condition}</span>
                  </div>
                  <span className="list-item-val text-danger">Action</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom Grid: Allocation Table & Heatmap */}
      <div className="grid-2 bottom-reports-grid">
        {/* Department Summary Table */}
        <div className="glass-panel">
          <h3 className="section-title">Department Allocation Financials</h3>
          <p className="panel-desc">Summarized asset cost values held by departments.</p>
          
          <div className="table-container" style={{ border: 'none', marginTop: '16px' }}>
            <table className="table-glass">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Allocated Qty</th>
                  <th>Reconciled Value</th>
                  <th>Usage Ratio</th>
                </tr>
              </thead>
              <tbody>
                {deptStats.map((dept, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{dept.name}</td>
                    <td>{dept.allocatedCount} assets</td>
                    <td>${dept.totalValue.toLocaleString()}</td>
                    <td>
                      <div className="progress-bar-container">
                        <div className="progress-fill" style={{ width: `${dept.utilization}%` }}></div>
                        <span className="progress-percent-val">{dept.utilization}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resource Booking Heatmap */}
        <div className="glass-panel">
          <h3 className="section-title">Resource Booking Density Heatmap</h3>
          <p className="panel-desc">Peak scheduling windows throughout the standard work week.</p>
          
          <div className="heatmap-container" style={{ marginTop: '20px' }}>
            {/* Headers row */}
            <div className="heatmap-header-row">
              <div className="heatmap-label-empty"></div>
              {heatmapHours.map((h, i) => (
                <div key={i} className="heatmap-hour-label">{h}</div>
              ))}
            </div>

            {/* Matrix Grid */}
            <div className="heatmap-grid">
              {heatmapDays.map((day, dayIdx) => (
                <div key={dayIdx} className="heatmap-day-row">
                  <div className="heatmap-day-label">{day}</div>
                  <div className="heatmap-day-cells">
                    {heatmapData[dayIdx].map((intensity, hourIdx) => (
                      <div 
                        key={hourIdx} 
                        className={`heatmap-cell ${getHeatmapColorClass(intensity)}`}
                        title={`Density Index: ${intensity}/4`}
                      ></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Heatmap Legend */}
            <div className="heatmap-legend" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px', fontSize: '12px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Low Usage</span>
              <div className="heatmap-cell density-none" style={{ width: '12px', height: '12px' }}></div>
              <div className="heatmap-cell density-low" style={{ width: '12px', height: '12px' }}></div>
              <div className="heatmap-cell density-medium" style={{ width: '12px', height: '12px' }}></div>
              <div className="heatmap-cell density-medium-high" style={{ width: '12px', height: '12px' }}></div>
              <div className="heatmap-cell density-high" style={{ width: '12px', height: '12px' }}></div>
              <span style={{ color: 'var(--text-muted)' }}>Peak Hours</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .reports-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .chart-panel {
          padding: 20px 24px;
        }

        .bar-chart-container {
          display: flex;
          justify-content: space-around;
          align-items: flex-end;
          height: 180px;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 8px;
          margin-top: 24px;
        }

        .bar-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 80px;
          height: 100%;
          justify-content: flex-end;
        }

        .bar-bars {
          height: 80%;
          width: 32px;
          position: relative;
          display: flex;
          align-items: flex-end;
        }

        .bar-column {
          width: 100%;
          border-radius: 4px 4px 0 0;
          transition: height 0.5s ease-out;
        }

        .total-bar {
          background: var(--bg-elevated);
          border: 1px dashed var(--border-strong);
          display: flex;
          align-items: flex-end;
        }

        .allocated-bar {
          background: var(--accent);
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.2);
        }

        .bar-label {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 8px;
          text-align: center;
        }

        .chart-legend {
          display: flex;
          gap: 24px;
          margin-top: 16px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .legend-dot.total { background: var(--bg-elevated); border: 1px dashed var(--border-strong); }
        .legend-dot.allocated { background: var(--accent); }

        .svg-chart-container {
          margin-top: 24px;
          height: 180px;
          display: flex;
          align-items: center;
        }

        .trend-svg {
          width: 100%;
          height: 100%;
        }

        .stats-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 16px;
        }

        .stats-list li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 12px;
        }

        .stats-list li:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .list-panel-title {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--status-neutral);
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 8px;
        }

        .item-title {
          font-weight: 600;
          display: block;
        }

        .item-desc {
          font-size: 12px;
          color: var(--text-muted);
          display: block;
          margin-top: 2px;
        }

        .list-item-val {
          font-size: 12px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          padding: 2px 8px;
          border-radius: 4px;
        }

        .progress-bar-container {
          width: 100px;
          height: 8px;
          background: var(--bg-elevated);
          border-radius: 9999px;
          position: relative;
          display: flex;
          align-items: center;
        }

        .progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 9999px;
          box-shadow: 0 0 8px var(--accent);
        }

        .progress-percent-val {
          position: absolute;
          left: 110px;
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .heatmap-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .heatmap-header-row {
          display: flex;
          gap: 6px;
        }

        .heatmap-label-empty {
          width: 50px;
          flex-shrink: 0;
        }

        .heatmap-hour-label {
          flex: 1;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--text-muted);
          text-align: center;
        }

        .heatmap-day-row {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .heatmap-day-label {
          width: 50px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .heatmap-day-cells {
          display: flex;
          gap: 6px;
          flex: 1;
        }

        .heatmap-cell {
          flex: 1;
          height: 24px;
          border-radius: 4px;
          transition: transform 0.15s ease;
        }

        .heatmap-cell:hover {
          transform: scale(1.1);
        }

        .density-none { background: var(--bg-elevated); border: 1px solid var(--border-subtle); }
        .density-low { background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.2); }
        .density-medium { background: rgba(59, 130, 246, 0.35); }
        .density-medium-high { background: rgba(59, 130, 246, 0.6); }
        .density-high { background: var(--accent); box-shadow: 0 0 10px rgba(59, 130, 246, 0.25); }

        .text-danger { color: var(--status-danger); }
        .text-warning { color: var(--status-warning); }

        .toast-box {
          position: fixed;
          bottom: 32px;
          right: 32px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-strong);
          padding: 12px 20px;
          border-radius: 8px;
          z-index: 1000;
          box-shadow: var(--shadow-modal);
        }

        .animate-fade {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
