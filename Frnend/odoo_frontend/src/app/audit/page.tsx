'use client';

import React, { useState } from 'react';
import { useApp, AuditCycle, Asset } from '@/context/AppContext';
import { Badge } from '@/components/Badge';

export default function AuditPage() {
  const { 
    assets, 
    departments, 
    auditCycles, 
    addAuditCycle, 
    updateAuditChecklist, 
    closeAuditCycle,
    currentRole
  } = useApp();

  // Create Cycle Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [cycleName, setCycleName] = useState('');
  const [scopeDept, setScopeDept] = useState('All');
  const [scopeLoc, setScopeLoc] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [auditors, setAuditors] = useState('');

  // Active Cycle (first active cycle in array)
  const activeCycle = auditCycles.find(c => c.status === 'Active');
  
  // Closed Cycles
  const closedCycles = auditCycles.filter(c => c.status === 'Closed');

  // Handle Create Submit
  const handleCreateCycle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleName || !startDate || !endDate || !auditors) return;

    addAuditCycle({
      name: cycleName,
      scopeDepartment: scopeDept,
      scopeLocation: scopeLoc,
      startDate,
      endDate,
      auditors
    });

    setCycleName('');
    setScopeDept('All');
    setScopeLoc('All');
    setStartDate('');
    setEndDate('');
    setAuditors('');
    setShowCreateModal(false);
  };

  // Helper to find Asset Info
  const getAssetInfo = (assetId: string) => {
    return assets.find(a => a.id === assetId);
  };

  // Compute summary stats for active cycle
  const getActiveCycleStats = (cycle: AuditCycle) => {
    const total = cycle.checklist.length;
    const verified = cycle.checklist.filter(i => i.verification === 'Verified').length;
    const missing = cycle.checklist.filter(i => i.verification === 'Missing').length;
    const damaged = cycle.checklist.filter(i => i.verification === 'Damaged').length;
    const unchecked = cycle.checklist.filter(i => i.verification === 'Unchecked').length;
    const flagged = missing + damaged;

    return { total, verified, missing, damaged, unchecked, flagged };
  };

  const activeStats = activeCycle ? getActiveCycleStats(activeCycle) : null;

  return (
    <div className="audit-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Audit</h1>
          <p className="page-subtitle">Schedule inventory verification cycles, audit field assets, and reconcile discrepancies.</p>
        </div>
        {currentRole !== 'Employee' && !activeCycle && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            Create Audit Cycle
          </button>
        )}
      </div>

      {/* 1. ACTIVE AUDIT CYCLE WORKSPACE */}
      {activeCycle && activeStats ? (
        <div className="active-cycle-workspace flex-column gap-1.5 animate-fade">
          {/* Active Cycle Info Card */}
          <div className="glass-panel active-header-card">
            <div className="header-top-row">
              <div>
                <span className="badge badge-warning" style={{ textTransform: 'uppercase' }}>Active Audit Cycle</span>
                <h2 className="cycle-title" style={{ fontWeight: 600, fontSize: '1.25rem', marginTop: '8px' }}>{activeCycle.name}</h2>
              </div>
              
              {currentRole !== 'Employee' && (
                <button 
                  className="btn btn-danger"
                  onClick={() => closeAuditCycle(activeCycle.id)}
                  disabled={activeStats.unchecked > 0}
                  title={activeStats.unchecked > 0 ? 'Please complete verification check for all checklist items first' : 'Lock audit & compile discrepancy records'}
                >
                  Close & Lock Audit Cycle
                </button>
              )}
            </div>

            <div className="cycle-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '20px', fontSize: '13px' }}>
              <div>
                <span className="meta-label">Schedule Scope:</span>
                <span className="meta-val">Dept: <strong>{activeCycle.scopeDepartment}</strong> | Loc: <strong>{activeCycle.scopeLocation}</strong></span>
              </div>
              <div>
                <span className="meta-label">Audit Range:</span>
                <span className="meta-val">{activeCycle.startDate} to {activeCycle.endDate}</span>
              </div>
              <div>
                <span className="meta-label">Assigned Auditor(s):</span>
                <span className="meta-val">{activeCycle.auditors}</span>
              </div>
              <div>
                <span className="meta-label">Progress Checklist:</span>
                <span className="meta-val"><strong>{activeStats.total - activeStats.unchecked}</strong> of <strong>{activeStats.total}</strong> checked</span>
              </div>
            </div>

            {activeStats.unchecked > 0 && (
              <p className="notice-lock-text text-warning font-bold" style={{ fontSize: '12px', marginTop: '12px' }}>
                * Action required: verify remaining {activeStats.unchecked} assets to enable Closing of Cycle.
              </p>
            )}
          </div>

          {/* Auto-Summary Banner (discrepancy alert band) */}
          {activeStats.flagged > 0 && (
            <div className="alert-box alert-warning animate-fade" style={{ margin: 0 }}>
              <div className="alert-icon-chip">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <strong className="alert-headline">Discrepancies Flagged</strong>
                <span>
                  <strong>{activeStats.flagged} assets flagged</strong> — discrepancy reconciliation records have been auto-generated. Closing the cycle will lock edits and invoke asset status updates.
                </span>
              </div>
            </div>
          )}

          {/* Verification checklist table */}
          <div className="table-container glass-card">
            <table className="table-glass">
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>Asset Name</th>
                  <th>Expected Location</th>
                  <th>Verification Check</th>
                  <th>Logged Status</th>
                </tr>
              </thead>
              <tbody>
                {activeCycle.checklist.map((item) => {
                  const asset = getAssetInfo(item.assetId);
                  if (!asset) return null;

                  return (
                    <tr key={item.assetId}>
                      <td className="tag-column" style={{ color: 'var(--accent)' }}>{asset.tag}</td>
                      <td style={{ fontWeight: 600 }}>{asset.name}</td>
                      <td>{item.expectedLocation}</td>
                      <td>
                        <select 
                          className="form-control check-select"
                          value={item.verification}
                          onChange={(e) => updateAuditChecklist(activeCycle.id, item.assetId, e.target.value as any)}
                        >
                          <option value="Unchecked">-- Choose status --</option>
                          <option value="Verified">Verified (Present & OK)</option>
                          <option value="Missing">Missing (Unlocated)</option>
                          <option value="Damaged">Damaged (Faulty/Unusable)</option>
                        </select>
                      </td>
                      <td>
                        <Badge status={item.verification} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* NO ACTIVE CYCLE */
        <div className="empty-state-container" style={{ padding: '64px 32px' }}>
          <div className="empty-state-icon">
            <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="section-title">No Active Audit Cycle</h3>
          <p className="empty-state-message" style={{ maxWidth: '400px', margin: '0 auto' }}>
            All systems reconciled. Start an active cycle block to trigger physical inventory checkups across departments.
          </p>
          {currentRole !== 'Employee' && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ marginTop: '12px' }}>
              Initialize Q3 Audit Cycle
            </button>
          )}
        </div>
      )}

      {/* 2. PAST AUDIT CYCLES HISTORY */}
      <div className="past-audits-section">
        <h3 className="section-title" style={{ marginBottom: '12px' }}>Past Closed Cycles</h3>
        
        {closedCycles.length === 0 ? (
          <div className="empty-state-container" style={{ border: 'none', padding: '24px' }}>
            <span className="empty-state-message">No past cycle records registered.</span>
          </div>
        ) : (
          <div className="closed-cycles-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {closedCycles.map((cycle) => {
              const stats = getActiveCycleStats(cycle);
              return (
                <div key={cycle.id} className="closed-cycle-row glass-card">
                  <div className="row-main">
                    <div>
                      <span className="closed-title">{cycle.name}</span>
                      <div className="closed-details">
                        <span>Range: <strong>{cycle.startDate} - {cycle.endDate}</strong></span>
                        <span>Audited: <strong>{cycle.auditors}</strong></span>
                        <span>Reconciled Scope: <strong>{cycle.scopeDepartment} / {cycle.scopeLocation}</strong></span>
                      </div>
                    </div>
                    <div className="closed-stats">
                      <span className="stat-pill text-success">{stats.verified} Verified</span>
                      <span className="stat-pill text-danger">{stats.missing} Lost</span>
                      <span className="stat-pill text-warning">{stats.damaged} Damaged</span>
                      <span className="status-label">Locked & Reconciled</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE CYCLE MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Create Audit Cycle</h2>
            <form onSubmit={handleCreateCycle} style={{ marginTop: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="audit-name">Cycle Title / Identifier</label>
                <input 
                  id="audit-name"
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Q3 Engineering Dept Audit"
                  value={cycleName}
                  onChange={(e) => setCycleName(e.target.value)}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="audit-dept">Department Scope</label>
                  <select 
                    id="audit-dept"
                    className="form-control"
                    value={scopeDept}
                    onChange={(e) => setScopeDept(e.target.value)}
                  >
                    <option value="All">All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="audit-loc">Location Scope</label>
                  <select 
                    id="audit-loc"
                    className="form-control"
                    value={scopeLoc}
                    onChange={(e) => setScopeLoc(e.target.value)}
                  >
                    <option value="All">All Locations</option>
                    <option value="Bangalore">Bangalore</option>
                    <option value="HQ">HQ Offices</option>
                    <option value="Warehouse">Warehouse Storage</option>
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="audit-start">Audit Start Date</label>
                  <input 
                    id="audit-start"
                    type="date" 
                    className="form-control" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="audit-end">Audit End Date</label>
                  <input 
                    id="audit-end"
                    type="date" 
                    className="form-control" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="audit-auditors">Assigned Auditor(s)</label>
                <input 
                  id="audit-auditors"
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Aditi Rao, Rohan Mehta"
                  value={auditors}
                  onChange={(e) => setAuditors(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Initialize Cycle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .audit-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .active-header-card {
          padding: 20px 24px;
        }

        .header-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 16px;
        }

        .meta-label {
          color: var(--text-muted);
          font-size: 11px;
          display: block;
          text-transform: uppercase;
        }

        .meta-val {
          color: var(--text-primary);
          display: block;
          margin-top: 4px;
        }

        .check-select {
          padding: 6px 8px;
          font-size: 13px;
          background: var(--bg-elevated);
          border-color: var(--border-subtle);
          width: 200px;
        }

        .row-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .closed-title {
          font-weight: 600;
          font-size: 15px;
          color: var(--text-primary);
        }

        .closed-details {
          display: flex;
          gap: 20px;
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .closed-stats {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
        }

        .stat-pill {
          font-weight: 600;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          padding: 2px 8px;
          border-radius: 4px;
        }

        .status-label {
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
          border-left: 1px solid var(--border-subtle);
          padding-left: 12px;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .text-danger { color: var(--status-danger); }
        .text-success { color: var(--status-success); }
        .text-warning { color: var(--status-warning); }
        .font-bold { font-weight: 700; }

        .animate-fade {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
