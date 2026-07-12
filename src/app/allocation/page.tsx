'use client';

import React, { useState } from 'react';
import { useApp, Asset, Employee } from '@/context/AppContext';
import { Badge } from '@/components/Badge';

export default function AllocationPage() {
  const { 
    assets, 
    employees, 
    allocateAsset, 
    transferAsset, 
    returnAsset,
    activityLogs
  } = useApp();

  // Target Asset State
  const [selectedAssetId, setSelectedAssetId] = useState('');
  
  // Return Form State
  const [returnNotes, setReturnNotes] = useState('');
  const [returnCondition, setReturnCondition] = useState<'New' | 'Good' | 'Fair' | 'Poor'>('Good');
  
  // Normal Allocation Form State
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');

  // Transfer Form State
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [showTransferForm, setShowTransferForm] = useState(false);

  // Status indicators for messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Selected Asset Details
  const activeAsset = assets.find(a => a.id === selectedAssetId);
  const currentHolder = activeAsset?.currentHolderId 
    ? employees.find(e => e.id === activeAsset.currentHolderId) 
    : null;

  // Handles standard asset allocation
  const handleAllocate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !targetEmployeeId) return;

    const success = allocateAsset(selectedAssetId, targetEmployeeId, expectedReturnDate || null);
    if (success) {
      setSuccessMsg('Asset allocated successfully!');
      setTargetEmployeeId('');
      setExpectedReturnDate('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg('Allocation failed. Asset may already be allocated.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // Handles asset transfer
  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !transferTargetId || !transferReason) return;

    transferAsset(selectedAssetId, transferTargetId, transferReason);
    setSuccessMsg('Transfer request completed successfully!');
    setTransferTargetId('');
    setTransferReason('');
    setShowTransferForm(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Handles checking back in (returning) an asset
  const handleReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) return;

    returnAsset(selectedAssetId, returnNotes, returnCondition);
    setSuccessMsg('Asset returned successfully. Status reset to Available.');
    setReturnNotes('');
    setReturnCondition('Good');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Computed allocation history list for the selected asset
  const getAllocationHistory = () => {
    if (!selectedAssetId) return [];
    
    // Sourced from activity logs containing this asset's tag
    return activityLogs.filter(log => 
      activeAsset && (
        log.message.includes(activeAsset.tag) || 
        log.message.toLowerCase().includes(activeAsset.name.toLowerCase())
      )
    );
  };

  return (
    <div className="allocation-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Allocation & Transfer</h1>
          <p className="page-subtitle">Assign asset holders, manage department transfers, and return resources.</p>
        </div>
      </div>

      {/* Success / Error Banners */}
      {successMsg && (
        <div className="alert-box alert-success animate-fade">
          <div className="alert-icon-chip">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="alert-box alert-danger animate-fade">
          <div className="alert-icon-chip">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Selector & Workspace Grid */}
      <div className="grid-2 allocation-workspace">
        {/* Left Side: Asset Selector & Interactive Flow */}
        <div className="flex-column gap-1.5">
          <div className="glass-panel">
            <h3 className="section-title">1. Select Target Asset</h3>
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label className="form-label">Asset to Allocate / Transfer</label>
              <select 
                className="form-control"
                value={selectedAssetId}
                onChange={(e) => {
                  setSelectedAssetId(e.target.value);
                  setShowTransferForm(false);
                }}
              >
                <option value="">-- Choose Asset from Directory --</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.tag} — {a.name} ({a.status})
                  </option>
                ))}
              </select>
            </div>

            {activeAsset && (
              <div className="selected-asset-details-box glass-card" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="asset-name-label" style={{ fontWeight: 600 }}>{activeAsset.name}</span>
                  <Badge status={activeAsset.status} />
                </div>
                <div className="asset-meta-row" style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Serial: <strong className="mono-text">{activeAsset.serialNumber}</strong></span>
                  <span>Location: <strong>{activeAsset.location}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Flow based on selected asset status */}
          {activeAsset && (
            <div className="glass-panel">
              {activeAsset.status === 'Allocated' ? (
                /* CONFLICT / TRANSFER / RETURN STATE */
                <div className="conflict-flow-container animate-scale">
                  {/* Core conflict warning from Wireframe */}
                  <div className="alert-box alert-danger conflict-box">
                    <div className="alert-icon-chip">
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <strong className="alert-headline" style={{ fontSize: '14px', fontWeight: 600 }}>Already Allocated</strong>
                      <span style={{ fontSize: '13px' }}>Direct re-allocation is blocked. Currently held by {currentHolder?.name} ({currentHolder?.department}).</span>
                    </div>
                  </div>

                  {!showTransferForm ? (
                    <div className="conflict-actions" style={{ marginTop: '16px' }}>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => setShowTransferForm(true)}
                        style={{ width: '100%', marginBottom: '12px' }}
                      >
                        Initiate Transfer Request
                      </button>
                      
                      <div className="divider-label">OR CHECK BACK IN</div>

                      {/* Check-in form */}
                      <form onSubmit={handleReturn} className="return-subform" style={{ marginTop: '12px' }}>
                        <div className="form-group">
                          <label className="form-label">Return Condition</label>
                          <select 
                            className="form-control"
                            value={returnCondition}
                            onChange={(e) => setReturnCondition(e.target.value as any)}
                          >
                            <option value="New">New (Unused)</option>
                            <option value="Good">Good (Working)</option>
                            <option value="Fair">Fair (Wear & Tear)</option>
                            <option value="Poor">Poor (Damaged)</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Check-in Notes</label>
                          <input 
                            type="text" 
                            className="form-control"
                            placeholder="e.g. Returned with original charger, minor scratches."
                            value={returnNotes}
                            onChange={(e) => setReturnNotes(e.target.value)}
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>
                          Mark Returned
                        </button>
                      </form>
                    </div>
                  ) : (
                    /* TRANSFER FORM */
                    <form onSubmit={handleTransfer} className="transfer-request-form animate-fade" style={{ marginTop: '16px' }}>
                      <h4 className="sub-section-title">Transfer Authorization Form</h4>
                      
                      <div className="form-group" style={{ marginTop: '12px' }}>
                        <label className="form-label">Transfer From (Current Holder)</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          value={currentHolder?.name || ''} 
                          disabled 
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Transfer To (New Holder)</label>
                        <select 
                          className="form-control"
                          value={transferTargetId}
                          onChange={(e) => setTransferTargetId(e.target.value)}
                          required
                        >
                          <option value="">-- Select Recipient Employee --</option>
                          {employees
                            .filter(e => e.id !== activeAsset.currentHolderId && e.status === 'Active')
                            .map(e => (
                              <option key={e.id} value={e.id}>{e.name} ({e.department})</option>
                            ))
                          }
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Reason for Transfer</label>
                        <textarea 
                          className="form-control" 
                          placeholder="e.g. Employee shifting to Field Operations department..."
                          value={transferReason}
                          onChange={(e) => setTransferReason(e.target.value)}
                          required
                          rows={2}
                        />
                      </div>

                      <div className="form-actions" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowTransferForm(false)} style={{ flex: 1 }}>
                          Back
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                          Request Transfer
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : activeAsset.status === 'Available' ? (
                /* NORMAL ALLOCATION FORM */
                <form onSubmit={handleAllocate} className="allocation-form animate-fade">
                  <h4 className="sub-section-title">Assign Asset Holder</h4>
                  
                  <div className="form-group" style={{ marginTop: '12px' }}>
                    <label className="form-label">Assign To (Employee)</label>
                    <select 
                      className="form-control"
                      value={targetEmployeeId}
                      onChange={(e) => setTargetEmployeeId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Employee --</option>
                      {employees.filter(e => e.status === 'Active').map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.department})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Expected Return Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                    Allocate Asset
                  </button>
                </form>
              ) : (
                /* INELIGIBLE STATUS BLOCKED */
                <div className="empty-state-container" style={{ border: 'none', padding: '16px 0' }}>
                  <div className="empty-state-icon">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <span className="empty-state-message">
                    This asset is currently <strong>{activeAsset.status}</strong>. Allocation is unavailable until status returns to Available.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Allocation Ledger & History */}
        <div className="glass-panel">
          <h3 className="section-title">2. Allocation Ledger</h3>
          <p className="panel-desc">Recent history tracking for the selected asset tag.</p>

          {!selectedAssetId ? (
            <div className="empty-history-box">
              <svg width="24" height="24" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>Please select an asset tag from the directory to review its logs.</span>
            </div>
          ) : getAllocationHistory().length === 0 ? (
            <div className="empty-history-box">
              <svg width="24" height="24" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>No logged activities found for this asset.</span>
            </div>
          ) : (
            <div className="timeline" style={{ marginTop: '16px' }}>
              {getAllocationHistory().map((log) => (
                <div key={log.id} className="timeline-item">
                  <div className="timeline-date">{log.timestamp}</div>
                  <div className="timeline-title" style={{ fontSize: '14px', fontWeight: 600 }}>
                    {log.message.includes('allocated') ? 'Asset Assigned' : log.message.includes('returned') ? 'Returned to Inventory' : 'Department/Holder Transfer'}
                  </div>
                  <div className="timeline-desc" style={{ fontSize: '13px', marginTop: '2px' }}>{log.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .allocation-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .selected-asset-details-box {
          margin-top: 16px;
          padding: 16px;
        }

        .asset-name-label {
          font-weight: 600;
          font-size: 15px;
          color: var(--text-primary);
        }

        .mono-text {
          font-family: 'JetBrains Mono', monospace;
        }

        .sub-section-title {
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--status-neutral);
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 8px;
        }

        .divider-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-align: center;
          margin: 20px 0 12px;
          position: relative;
        }

        .divider-label::before,
        .divider-label::after {
          content: '';
          position: absolute;
          top: 50%;
          width: 30%;
          height: 1px;
          background: var(--border-subtle);
        }

        .divider-label::before { left: 0; }
        .divider-label::after { right: 0; }

        .empty-history-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 32px;
          gap: 12px;
          color: var(--text-secondary);
          font-size: 14px;
          text-align: center;
        }

        .conflict-box {
          animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.96);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-scale {
          animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .animate-fade {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
