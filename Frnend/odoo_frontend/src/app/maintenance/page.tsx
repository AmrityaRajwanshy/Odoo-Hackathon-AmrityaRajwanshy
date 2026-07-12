'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp, MaintenanceRequest, Asset } from '@/context/AppContext';
import { Badge } from '@/components/Badge';

function MaintenanceContent() {
  const searchParams = useSearchParams();
  const { 
    assets, 
    maintenanceRequests, 
    addMaintenanceRequest, 
    updateMaintenanceStatus,
    currentRole
  } = useApp();

  // Modal / Drawers state
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);

  // Form states
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');

  // Technician Form states (for inline drawer action)
  const [techName, setTechName] = useState('');
  const [techNotes, setTechNotes] = useState('');

  // Handle deep-linking from Dashboard
  useEffect(() => {
    if (searchParams.get('openRaise') === 'true') {
      setShowRaiseModal(true);
    }
  }, [searchParams]);

  // Set default asset selector
  useEffect(() => {
    if (assets.length > 0 && !selectedAssetId) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !issueDesc) return;

    addMaintenanceRequest({
      assetId: selectedAssetId,
      issue: issueDesc,
      priority
    });

    setIssueDesc('');
    setPriority('Medium');
    setShowRaiseModal(false);
  };

  const handleAssignTechnician = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !techName) return;

    updateMaintenanceStatus(
      selectedRequest.id, 
      'Technician Assigned', 
      techNotes || undefined, 
      techName
    );

    setTechName('');
    setTechNotes('');
    setSelectedRequest(null);
  };

  // Helper to find Asset Info
  const getAssetInfo = (assetId: string) => {
    return assets.find(a => a.id === assetId);
  };

  // Kanban Columns
  const columns: Array<{ title: string; status: MaintenanceRequest['status'] }> = [
    { title: 'Pending Approval', status: 'Pending' },
    { title: 'Approved', status: 'Approved' },
    { title: 'Tech Assigned', status: 'Technician Assigned' },
    { title: 'In Progress', status: 'In Progress' },
    { title: 'Resolved', status: 'Resolved' }
  ];

  return (
    <div className="maintenance-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance Management</h1>
          <p className="page-subtitle">Oversee repairs, assign technicians, and track equipment health status.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowRaiseModal(true)}>
          + Raise Repair Request
        </button>
      </div>

      {/* Kanban Board Container */}
      <div className="kanban-board-scroll">
        <div className="kanban-board">
          {columns.map((col) => {
            const colRequests = maintenanceRequests.filter(m => m.status === col.status);
            
            return (
              <div key={col.status} className="kanban-column glass-panel">
                <div className="kanban-column-header">
                  <span className="column-title">{col.title}</span>
                  <span className="column-count">{colRequests.length}</span>
                </div>

                <div className="kanban-cards-list">
                  {colRequests.length === 0 ? (
                    <div className="empty-column-placeholder">No requests</div>
                  ) : (
                    colRequests.map((req) => {
                      const asset = getAssetInfo(req.assetId);
                      
                      return (
                        <div 
                          key={req.id} 
                          className={`kanban-card glass-card priority-${req.priority.toLowerCase()}`}
                          onClick={() => setSelectedRequest(req)}
                        >
                          <div className="card-top-row">
                            <span className="card-tag">{asset?.tag || 'Asset'}</span>
                            <span className={`priority-pill ${req.priority.toLowerCase()}`}>{req.priority}</span>
                          </div>
                          
                          <h4 className="card-asset-name">{asset?.name || 'Unknown Asset'}</h4>
                          <p className="card-issue">{req.issue}</p>

                          {req.technician && (
                            <div className="card-tech-row">
                              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>{req.technician}</span>
                            </div>
                          )}

                          {/* Quick stage transition button helper */}
                          <div className="card-action-bar" onClick={(e) => e.stopPropagation()}>
                            {req.status === 'Pending' && currentRole !== 'Employee' && (
                              <button 
                                className="btn btn-secondary card-btn success-hover"
                                onClick={() => updateMaintenanceStatus(req.id, 'Approved')}
                              >
                                Approve Request
                              </button>
                            )}

                            {req.status === 'Approved' && currentRole !== 'Employee' && (
                              <button 
                                className="btn btn-secondary card-btn"
                                onClick={() => setSelectedRequest(req)} // Opens drawer for tech assignment
                              >
                                Assign Tech
                              </button>
                            )}

                            {req.status === 'Technician Assigned' && currentRole !== 'Employee' && (
                              <button 
                                className="btn btn-secondary card-btn"
                                onClick={() => updateMaintenanceStatus(req.id, 'In Progress')}
                              >
                                Start Work
                              </button>
                            )}

                            {req.status === 'In Progress' && currentRole !== 'Employee' && (
                              <button 
                                className="btn btn-primary card-btn resolve-btn"
                                onClick={() => updateMaintenanceStatus(req.id, 'Resolved')}
                              >
                                Mark Resolved
                              </button>
                            )}

                            {req.status === 'Resolved' && (
                              <span className="card-resolved-notice">✓ Resolved & Available</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info notice about live link */}
      <div className="info-box alert-box alert-warning">
        <div className="alert-icon-chip">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span>
          <strong>Live Synced Status:</strong> Approving a pending card automatically locks the asset status to <strong>Under Maintenance</strong> in the Directory. Completing/Resolving the card releases the asset status back to <strong>Available</strong>.
        </span>
      </div>

      {/* RAISE REQUEST MODAL */}
      {showRaiseModal && (
        <div className="modal-overlay" onClick={() => setShowRaiseModal(false)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Raise Repair Request</h2>
            <form onSubmit={handleSubmitRequest} style={{ marginTop: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Select Faulty Asset</label>
                <select 
                  className="form-control"
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Asset --</option>
                  {assets.filter(a => a.status !== 'Retired').map(a => (
                    <option key={a.id} value={a.id}>{a.tag} — {a.name} ({a.status})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Priority Severity</label>
                <select 
                  className="form-control"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                >
                  <option value="Low">Low (General Check)</option>
                  <option value="Medium">Medium (Operational issue)</option>
                  <option value="High">High (Blocked workflow)</option>
                  <option value="Critical">Critical (Immediate danger/blocker)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Issue Description</label>
                <textarea 
                  className="form-control"
                  rows={4}
                  placeholder="Detail the issue: what error code is showing? is it physically damaged?"
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                  required
                />
              </div>

              {/* Photo Upload Placeholder (UI only) */}
              <div className="form-group">
                <label className="form-label">Attach Diagnostic Photo (Mock)</label>
                <div className="mock-file-upload">
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Select diagnostic logs or photo file</span>
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRaiseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL / DISPATCH DRAWER */}
      {selectedRequest && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedRequest(null)}></div>
          <div className="drawer-content">
            <div className="drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div className="drawer-meta-title">
                <span className="drawer-tag">TICKET #{selectedRequest.id}</span>
                <h2 className="drawer-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', marginTop: '0.25rem' }}>Repair Authorization</h2>
              </div>
              <button className="close-drawer-btn" onClick={() => setSelectedRequest(null)}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="drawer-sections" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Asset Info Summary */}
              <div className="drawer-section glass-panel">
                <h3 className="drawer-section-title">Equipment Scopes</h3>
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <span className="grid-label">Target Asset:</span>
                    <span style={{ fontWeight: 600 }}>{getAssetInfo(selectedRequest.assetId)?.name || 'Unknown'} ({getAssetInfo(selectedRequest.assetId)?.tag})</span>
                  </div>
                  <div>
                    <span className="grid-label">Issue Priority:</span>
                    <span style={{ fontWeight: 600 }}>{selectedRequest.priority}</span>
                  </div>
                  <div>
                    <span className="grid-label">Current Ticket Status:</span>
                    <span style={{ fontWeight: 600 }} className="text-warning">{selectedRequest.status}</span>
                  </div>
                  <div>
                    <span className="grid-label">Description of Fault:</span>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.4' }}>{selectedRequest.issue}</p>
                  </div>
                </div>
              </div>

              {/* Technician Dispatch Form / Status Tracker */}
              {selectedRequest.status === 'Approved' && currentRole !== 'Employee' ? (
                <div className="drawer-section glass-panel" style={{ borderLeft: '3px solid var(--accent)' }}>
                  <h3 className="drawer-section-title">Assign Technician Dispatch</h3>
                  <form onSubmit={handleAssignTechnician} style={{ marginTop: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Technician Full Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="e.g. Ramesh Verma" 
                        value={techName}
                        onChange={(e) => setTechName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Dispatch / Repair Instructions</label>
                      <textarea 
                        className="form-control" 
                        placeholder="e.g. Verify unit motherboard, replace parts..." 
                        value={techNotes}
                        onChange={(e) => setTechNotes(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                      Dispatch Technician
                    </button>
                  </form>
                </div>
              ) : (
                /* Ticket Log Information */
                <div className="drawer-section glass-panel">
                  <h3 className="drawer-section-title">Dispatch Details</h3>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div>
                      <span className="grid-label">Assigned Technician:</span>
                      <span style={{ fontWeight: 600 }}>{selectedRequest.technician || 'Awaiting assignment'}</span>
                    </div>
                    <div>
                      <span className="grid-label">Raised Date:</span>
                      <span>{new Date(selectedRequest.dateRaised).toLocaleString()}</span>
                    </div>
                    {selectedRequest.notes && (
                      <div>
                        <span className="grid-label">Technician Notes:</span>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.4' }}>{selectedRequest.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .maintenance-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .kanban-board-scroll {
          width: 100%;
          overflow-x: auto;
          padding-bottom: 8px;
        }

        .kanban-board {
          display: flex;
          gap: 16px;
          min-width: 1100px;
        }

        .kanban-column {
          flex: 1;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 480px;
        }

        .kanban-column-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 4px;
        }

        .column-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--status-neutral);
        }

        .column-count {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          background: var(--bg-elevated);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .kanban-cards-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
        }

        .empty-column-placeholder {
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
          padding: 24px 0;
          border: 1px dashed var(--border-subtle);
          border-radius: 8px;
        }

        .kanban-card {
          padding: 14px 16px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
        }

        .kanban-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent);
        }

        .priority-critical { border-left: 3px solid var(--status-danger); }
        .priority-high { border-left: 3px solid var(--status-warning); }
        .priority-medium { border-left: 3px solid var(--accent); }
        .priority-low { border-left: 3px solid var(--status-neutral); }

        .card-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .card-tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--accent);
          font-weight: 600;
        }

        .priority-pill {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 1px 6px;
          border-radius: 4px;
        }

        .priority-pill.critical { background: var(--status-danger-bg); color: var(--status-danger); }
        .priority-pill.high { background: var(--status-warning-bg); color: var(--status-warning); }
        .priority-pill.medium { background: var(--accent-muted-bg); color: var(--accent); }
        .priority-pill.low { background: var(--status-neutral-bg); color: var(--status-neutral); }

        .card-asset-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .card-issue {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .card-tech-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .card-action-bar {
          margin-top: 6px;
          border-top: 1px solid var(--border-subtle);
          padding-top: 8px;
        }

        .card-btn {
          width: 100%;
          padding: 6px;
          font-size: 12px;
          border-radius: 6px;
        }

        .success-hover:hover {
          background: var(--status-success-bg);
          border-color: var(--status-success);
          color: var(--status-success);
        }

        .resolve-btn {
          background: var(--accent);
          color: #ffffff;
          font-weight: 600;
        }

        .resolve-btn:hover {
          background: var(--accent-hover);
        }

        .card-resolved-notice {
          font-size: 12px;
          font-weight: 600;
          color: var(--status-success);
          display: block;
          text-align: center;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .mock-file-upload {
          border: 1px dashed var(--border-subtle);
          padding: 16px;
          text-align: center;
          border-radius: 8px;
          font-size: 13px;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          background: var(--bg-elevated);
          transition: border-color 0.15s ease;
        }

        .mock-file-upload:hover {
          border-color: var(--accent);
        }

        .close-drawer-btn {
          background: transparent;
          border: 1px solid var(--border-subtle);
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.15s ease;
        }

        .close-drawer-btn:hover {
          background: var(--bg-elevated);
          color: var(--text-primary);
          border-color: var(--border-strong);
        }

        .drawer-tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--accent);
          letter-spacing: 0.05em;
          font-weight: 600;
          background: var(--accent-muted-bg);
          padding: 2px 8px;
          border-radius: 4px;
        }

        .drawer-section-title {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--status-neutral);
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 8px;
        }

        .grid-label {
          color: var(--text-muted);
          font-size: 11px;
          display: block;
          text-transform: uppercase;
        }

        .grid-val {
          font-weight: 500;
          color: var(--text-primary);
          display: block;
          margin-top: 4px;
        }

        .flex-column {
          display: flex;
          flex-direction: column;
        }

        .gap-1.5 {
          gap: 24px;
        }

        .info-box {
          margin-top: 16px;
        }

        .text-warning {
          color: var(--status-warning);
        }
      `}</style>
    </div>
  );
}

export default function MaintenancePage() {
  return (
    <Suspense fallback={<div>Loading maintenance...</div>}>
      <MaintenanceContent />
    </Suspense>
  );
}
