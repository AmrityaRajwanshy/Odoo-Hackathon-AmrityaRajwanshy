'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp, Asset } from '@/context/AppContext';
import { Badge } from '@/components/Badge';

function AssetsDirectoryContent() {
  const searchParams = useSearchParams();
  const { 
    assets, 
    categories, 
    addAsset, 
    employees, 
    bookings, 
    maintenanceRequests,
    currentRole,
    departments
  } = useApp();

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [localAssets, setLocalAssets] = useState<Asset[]>([]);
  const [drawerHistory, setDrawerHistory] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Modals / Drawers state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Form State for new asset
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [serialNumber, setSerialNumber] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [acquisitionCost, setAcquisitionCost] = useState('');
  const [condition, setCondition] = useState<'New' | 'Good' | 'Fair' | 'Poor'>('Good');
  const [location, setLocation] = useState('');
  const [isBookable, setIsBookable] = useState(false);
  const [description, setDescription] = useState('');

  // Handle deep-linking from Dashboard
  useEffect(() => {
    if (searchParams.get('openRegister') === 'true') {
      setShowRegisterModal(true);
    }
  }, [searchParams]);

  // Fetch filtered assets from backend API dynamically
  useEffect(() => {
    const fetchFilteredAssets = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (search.trim()) queryParams.append('q', search.trim());
        
        if (categoryFilter !== 'All') {
          const cat = categories.find(c => c.name === categoryFilter);
          if (cat) queryParams.append('category_id', cat.id);
        }
        
        if (statusFilter !== 'All') {
          queryParams.append('status', statusFilter);
        }
        
        if (locationFilter !== 'All') {
          queryParams.append('location', locationFilter);
        }

        if (departmentFilter !== 'All') {
          const dept = departments.find(d => d.name === departmentFilter);
          if (dept) queryParams.append('department_id', dept.id);
        }

        const token = localStorage.getItem('af_access_token');
        const res = await fetch(`http://localhost:8000/api/assets?${queryParams.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });

        if (res.ok) {
          const data = await res.json();
          const mapped: Asset[] = data.map((a: any) => ({
            id: String(a.id),
            name: a.name,
            tag: a.asset_tag,
            category: a.category_name || '',
            serialNumber: a.serial_number,
            acquisitionDate: a.acquisition_date,
            acquisitionCost: a.acquisition_cost,
            condition: a.condition,
            location: a.location,
            isBookable: a.is_shared_bookable,
            status: a.status,
            currentHolderId: a.current_holder_id ? String(a.current_holder_id) : null,
            expectedReturnDate: null
          }));
          setLocalAssets(mapped);
        }
      } catch (err) {
        console.error('Error fetching filtered assets:', err);
      } finally {
        setLoading(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      fetchFilteredAssets();
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [search, categoryFilter, statusFilter, locationFilter, departmentFilter, categories, departments]);

  // Fetch dynamic asset history logs when selectedAsset changes
  useEffect(() => {
    if (!selectedAsset) {
      setDrawerHistory(null);
      return;
    }

    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('af_access_token');
        const res = await fetch(`http://localhost:8000/api/assets/${selectedAsset.id}/history`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const data = await res.json();
          setDrawerHistory(data);
        }
      } catch (err) {
        console.error('Error fetching asset history:', err);
      }
    };

    fetchHistory();
  }, [selectedAsset]);

  // Unique locations list for filters
  const locations = Array.from(new Set(assets.map(a => a.location)));

  // Filter assets
  const filteredAssets = localAssets.length > 0 || search || categoryFilter !== 'All' || statusFilter !== 'All' || locationFilter !== 'All' || departmentFilter !== 'All'
    ? localAssets
    : assets;

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !serialNumber || !acquisitionDate || !acquisitionCost || !location) return;

    addAsset({
      name,
      category,
      serialNumber,
      acquisitionDate,
      acquisitionCost: parseFloat(acquisitionCost),
      condition,
      location,
      isBookable,
      description
    });

    // Reset Form
    setName('');
    setCategory('Electronics');
    setSerialNumber('');
    setAcquisitionDate('');
    setAcquisitionCost('');
    setCondition('Good');
    setLocation('');
    setIsBookable(false);
    setDescription('');
    setShowRegisterModal(false);
  };

  const getHolderName = (holderId: string | null) => {
    if (!holderId) return 'N/A';
    return employees.find(e => e.id === holderId)?.name || 'Unknown';
  };

  // Get history logs for the active asset drawer
  const getAssetHistory = (asset: Asset) => {
    // If we have dynamic drawer history, construct the timeline from it!
    if (drawerHistory && (drawerHistory.allocations || drawerHistory.maintenance)) {
      const history: { date: string; action: string; detail: string; badge?: 'warning' | 'danger' }[] = [];
      
      // Add initial acquisition registration info
      history.push({
        date: asset.acquisitionDate,
        action: 'Asset Registered',
        detail: `Initial registration at location "${asset.location}". Condition: ${asset.condition}`
      });

      // Add allocations
      (drawerHistory.allocations || []).forEach((a: any) => {
        const allocDate = a.allocation_date ? a.allocation_date.split('T')[0] : '';
        history.push({
          date: allocDate,
          action: `Allocation: ${a.status}`,
          detail: `Assigned to employee ${a.employee_name || 'N/A'} (Expected return: ${a.expected_return_date ? a.expected_return_date.split('T')[0] : 'N/A'})`
        });
        if (a.returned_date) {
          history.push({
            date: a.returned_date.split('T')[0],
            action: 'Asset Returned',
            detail: `Returned by employee in condition: "${a.return_condition || 'N/A'}"`
          });
        }
      });

      // Add maintenance logs
      (drawerHistory.maintenance || []).forEach((m: any) => {
        const maintDate = m.created_at ? m.created_at.split('T')[0] : '';
        history.push({
          date: maintDate,
          action: `Maintenance: ${m.status}`,
          detail: `Issue: "${m.description}" | Priority: ${m.priority}`,
          badge: m.priority === 'High' || m.priority === 'Critical' ? 'danger' : 'warning'
        });
      });

      // Sort history by date descending
      return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    const history: { date: string; action: string; detail: string; badge?: 'warning' | 'danger' }[] = [];
    
    // Acquisition info
    history.push({
      date: asset.acquisitionDate,
      action: 'Asset Registered',
      detail: `Initial registration at location "${asset.location}". Condition: ${asset.condition}`
    });

    // Asset status-derived events
    if (asset.status === 'Allocated' && asset.currentHolderId) {
      history.push({
        date: '2026-07-10',
        action: 'Allocated Out',
        detail: `Assigned to employee ${getHolderName(asset.currentHolderId)} (Expected return: ${asset.expectedReturnDate})`
      });
    }

    if (asset.status === 'Lost') {
      history.push({
        date: '2026-07-12',
        action: 'Audit Reconcile: Flagged Lost',
        detail: 'Asset marked as unlocated during physical inventory cycle.',
        badge: 'danger'
      });
    }

    // Bookings related to this asset
    bookings.filter(b => b.assetId === asset.id).forEach(b => {
      history.push({
        date: b.startTime.split('T')[0],
        action: `Booking ${b.status}`,
        detail: `Reserved by employee ID ${b.requesterId} (Timeslots: ${b.startTime.split('T')[1]?.substring(0,5)} to ${b.endTime.split('T')[1]?.substring(0,5)})`
      });
    });

    // Maintenance logs related to this asset
    maintenanceRequests.filter(m => m.assetId === asset.id).forEach(m => {
      history.push({
        date: m.dateRaised.split('T')[0],
        action: `Maintenance: ${m.status}`,
        detail: `Issue: "${m.issue}" | Priority: ${m.priority}`,
        badge: m.priority === 'High' || m.priority === 'Critical' ? 'danger' : 'warning'
      });
    });

    // Sort history by date descending
    return history.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  return (
    <div className="assets-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Assets Directory</h1>
          <p className="page-subtitle">Search, register, track, and review organizational physical assets.</p>
        </div>
        {currentRole !== 'Employee' && (
          <button className="btn btn-primary" onClick={() => setShowRegisterModal(true)}>
            Register Asset
          </button>
        )}
      </div>

      {/* Search / Filters Panel */}
      <div className="glass-panel filter-row">
        <div className="search-bar-container">
          <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            className="form-control search-input" 
            placeholder="Search by tag, name, or serial number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filters-selectors">
          <div className="filter-select-group">
            <label className="filter-label">Category</label>
            <select 
              className="form-control filter-control"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div className="filter-select-group">
            <label className="filter-label">Status</label>
            <select 
              className="form-control filter-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Allocated">Allocated</option>
              <option value="Reserved">Reserved</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Lost">Lost</option>
              <option value="Retired">Retired</option>
            </select>
          </div>

          <div className="filter-select-group">
            <label className="filter-label">Location</label>
            <select 
              className="form-control filter-control"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="All">All Locations</option>
              {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>

          <div className="filter-select-group">
            <label className="filter-label">Department</label>
            <select 
              className="form-control filter-control"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="All">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="table-container glass-card">
        {filteredAssets.length === 0 ? (
          <div className="empty-state-container" style={{ border: 'none', padding: '64px 32px' }}>
            <div className="empty-state-icon">
              <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="empty-state-message">No assets found matching your criteria.</span>
          </div>
        ) : (
          <table className="table-glass">
            <thead>
              <tr>
                <th>Asset Tag</th>
                <th>Asset Name</th>
                <th>Category</th>
                <th>Serial Number</th>
                <th>Location</th>
                <th>Status</th>
                <th>Current Holder</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.id} className="interactive-row" onClick={() => setSelectedAsset(asset)}>
                  <td className="tag-column" style={{ color: 'var(--accent)' }}>{asset.tag}</td>
                  <td style={{ fontWeight: 600 }}>{asset.name}</td>
                  <td>{asset.category}</td>
                  <td className="mono-text">{asset.serialNumber}</td>
                  <td>{asset.location}</td>
                  <td>
                    <Badge status={asset.status} />
                  </td>
                  <td>
                    {asset.status === 'Allocated' ? (
                      <span className="holder-badge">{getHolderName(asset.currentHolderId)}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* REGISTRATION MODAL */}
      {showRegisterModal && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Register New Asset</h2>
            <form onSubmit={handleRegister} style={{ marginTop: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="asset-name">Asset Name</label>
                <input 
                  id="asset-name"
                  type="text" 
                  className="form-control" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dell UltraSharp 32 Monitor"
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="asset-category">Category</label>
                  <select 
                    id="asset-category"
                    className="form-control"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="asset-serial">Serial Number</label>
                  <input 
                    id="asset-serial"
                    type="text" 
                    className="form-control" 
                    value={serialNumber} 
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="SN-XXXXX"
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="asset-acq-date">Acquisition Date</label>
                  <input 
                    id="asset-acq-date"
                    type="date" 
                    className="form-control" 
                    value={acquisitionDate} 
                    onChange={(e) => setAcquisitionDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="asset-acq-cost">Cost ($ USD)</label>
                  <input 
                    id="asset-acq-cost"
                    type="number" 
                    className="form-control" 
                    value={acquisitionCost} 
                    onChange={(e) => setAcquisitionCost(e.target.value)}
                    placeholder="1200"
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="asset-condition">Condition</label>
                  <select 
                    id="asset-condition"
                    className="form-control"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as any)}
                  >
                    <option value="New">New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="asset-location">Storage Location</label>
                  <input 
                    id="asset-location"
                    type="text" 
                    className="form-control" 
                    value={location} 
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Warehouse A, HQ Floor 1"
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', gap: '0.75rem', alignItems: 'center', margin: '1rem 0' }}>
                <input 
                  id="asset-bookable"
                  type="checkbox" 
                  checked={isBookable} 
                  onChange={(e) => setIsBookable(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label className="form-label" htmlFor="asset-bookable" style={{ cursor: 'pointer', marginBottom: 0 }}>Shared Resource (Eligible for Time-slot Booking)</label>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="asset-description">Description / Notes</label>
                <textarea 
                  id="asset-description"
                  className="form-control" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional specs or registration notes..."
                  rows={2}
                />
              </div>

              {/* Photo Upload Placeholder (UI only) */}
              <div className="form-group">
                <label className="form-label">Attach Invoice / Image (Mock Fields)</label>
                <div className="mock-upload-box">
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Drag & Drop files or click to browse</span>
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRegisterModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL VIEW / DRAWER */}
      {selectedAsset && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedAsset(null)}></div>
          <div className="drawer-content">
            <div className="drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div className="drawer-meta-title">
                <span className="drawer-tag">{selectedAsset.tag}</span>
                <h2 className="drawer-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', marginTop: '0.25rem' }}>{selectedAsset.name}</h2>
              </div>
              <button className="close-drawer-btn" onClick={() => setSelectedAsset(null)}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="drawer-sections" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Core Information */}
              <div className="drawer-section glass-panel">
                <h3 className="drawer-section-title">Core Specifications</h3>
                <div className="drawer-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', fontSize: '0.85rem' }}>
                  <div>
                    <span className="grid-label">Status</span>
                    <div style={{ marginTop: '0.25rem' }}><Badge status={selectedAsset.status} /></div>
                  </div>
                  <div>
                    <span className="grid-label">Condition</span>
                    <div style={{ marginTop: '0.25rem' }}><Badge status={selectedAsset.condition} /></div>
                  </div>
                  <div>
                    <span className="grid-label">Category</span>
                    <span className="grid-val">{selectedAsset.category}</span>
                  </div>
                  <div>
                    <span className="grid-label">Serial Number</span>
                    <span className="grid-val mono-text">{selectedAsset.serialNumber}</span>
                  </div>
                  <div>
                    <span className="grid-label">Acquisition Cost</span>
                    <span className="grid-val">${selectedAsset.acquisitionCost.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="grid-label">Acquisition Date</span>
                    <span className="grid-val">{selectedAsset.acquisitionDate}</span>
                  </div>
                  <div>
                    <span className="grid-label">Storage Location</span>
                    <span className="grid-val">{selectedAsset.location}</span>
                  </div>
                  <div>
                    <span className="grid-label">Bookable Resource</span>
                    <span className="grid-val">{selectedAsset.isBookable ? 'Yes (Shared)' : 'No (Private)'}</span>
                  </div>
                </div>
                {selectedAsset.description && (
                  <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                    <span className="grid-label">Specs & Description</span>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.4' }}>{selectedAsset.description}</p>
                  </div>
                )}
              </div>

              {/* Current Holder details if allocated */}
              {selectedAsset.status === 'Allocated' && (
                <div className="drawer-section glass-panel" style={{ borderLeft: '3px solid var(--accent)' }}>
                  <h3 className="drawer-section-title">Current Holder Allocation</h3>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div>
                      <span className="grid-label">Employee Name:</span>{' '}
                      <span style={{ fontWeight: 600 }}>{getHolderName(selectedAsset.currentHolderId)}</span>
                    </div>
                    <div>
                      <span className="grid-label">Expected Return:</span>{' '}
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selectedAsset.expectedReturnDate || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Lifecycle & Actions History */}
              <div className="drawer-section glass-panel">
                <h3 className="drawer-section-title" style={{ marginBottom: '1rem' }}>Asset Lifecycle & History</h3>
                
                {getAssetHistory(selectedAsset).length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>No history records for this asset.</div>
                ) : (
                  <div className="timeline">
                    {getAssetHistory(selectedAsset).map((hist, index) => (
                      <div key={index} className={`timeline-item ${hist.badge === 'danger' ? 'danger' : hist.badge === 'warning' ? 'warning' : ''}`}>
                        <div className="timeline-date">{hist.date}</div>
                        <div className="timeline-title">{hist.action}</div>
                        <div className="timeline-desc">{hist.detail}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .assets-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .filter-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }

        .search-bar-container {
          position: relative;
          flex: 1;
          min-width: 280px;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          color: var(--text-muted);
        }

        .search-input {
          padding-left: 38px;
          width: 100%;
        }

        .filters-selectors {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .filter-select-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .filter-label {
          font-size: 11px;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 600;
          letter-spacing: 0.04em;
        }

        .filter-control {
          padding: 8px 12px;
          font-size: 13px;
          background: var(--bg-elevated);
          border-color: var(--border-subtle);
          width: 160px;
        }

        .interactive-row {
          cursor: pointer;
        }

        .tag-column {
          font-family: 'JetBrains Mono', monospace;
          font-weight: 500;
        }

        .mono-text {
          font-family: 'JetBrains Mono', monospace;
        }

        .holder-badge {
          background: var(--bg-elevated);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 13px;
          border: 1px solid var(--border-subtle);
        }

        .modal-title {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .mock-upload-box {
          border: 1px dashed var(--border-subtle);
          padding: 24px;
          text-align: center;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-muted);
          cursor: pointer;
          background: var(--bg-elevated);
          transition: border-color 0.15s ease;
        }

        .mock-upload-box:hover {
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
          background: var(--accent-muted-bg);
          color: var(--accent);
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
          border: 1px solid rgba(59, 130, 246, 0.2);
          display: inline-block;
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
          letter-spacing: 0.02em;
        }

        .grid-val {
          font-weight: 500;
          color: var(--text-primary);
          display: block;
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}

export default function AssetsDirectoryPage() {
  return (
    <Suspense fallback={<div>Loading assets...</div>}>
      <AssetsDirectoryContent />
    </Suspense>
  );
}
