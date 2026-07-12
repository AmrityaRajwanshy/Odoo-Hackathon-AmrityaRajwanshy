'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';

export default function ProfilePage() {
  const { 
    currentUser, 
    setCurrentUser,
    currentRole, 
    assets, 
    bookings, 
    maintenanceRequests, 
    employees, 
    departments 
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Tabs state: 'View' or 'Edit'
  const [activeTab, setActiveTab] = useState<'View' | 'Edit'>('View');

  // Form states
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarHovered, setAvatarHovered] = useState(false);
  
  // Toast notification
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setName(currentUser.name);
    setEmail(currentUser.email);
    
    // Load phone and avatar from local storage
    if (typeof window !== 'undefined') {
      const savedPhone = localStorage.getItem(`af_phone_${currentUser.id}`) || (currentUser.id === 'e1' ? '+1 (555) 382-9021' : '+1 (555) 382-9022');
      setPhone(savedPhone);

      const savedAvatar = localStorage.getItem(`af_avatar_${currentUser.id}`);
      setAvatarUrl(savedAvatar);
    }
  }, [currentUser]);

  // Show Toast helper
  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Handle Photo selection
  const handlePhotoUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        localStorage.setItem(`af_avatar_${currentUser.id}`, base64String);
        setAvatarUrl(base64String);
        triggerToast('Profile photo updated successfully!');
        
        // Dispatch an event to notify Topbar
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('storage'));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    localStorage.removeItem(`af_avatar_${currentUser.id}`);
    setAvatarUrl(null);
    triggerToast('Profile photo removed.');
    
    // Dispatch an event to notify Topbar
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
    }
  };

  // Submit Profile update
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      triggerToast('Error: Name and Email cannot be empty.');
      return;
    }

    try {
      const token = localStorage.getItem('af_access_token');
      const res = await fetch('http://localhost:8000/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim()
        })
      });

      if (res.ok) {
        // Save globally
        const updatedUser = {
          ...currentUser,
          name: name.trim(),
          email: email.trim()
        };
        setCurrentUser(updatedUser);
        localStorage.setItem('af_currentUser', JSON.stringify(updatedUser));

        // Save phone to local storage
        localStorage.setItem(`af_phone_${currentUser.id}`, phone.trim());
        
        triggerToast('Profile details updated successfully!');
        setActiveTab('View');
      } else {
        const data = await res.json();
        triggerToast(`Error: ${data.detail || 'Failed to update profile.'}`);
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error updating profile.');
    }
  };

  // Get initials for Avatar if no image uploaded
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Derive activity statistics
  const myAssets = assets.filter(a => a.currentHolderId === currentUser.id);
  const myBookings = bookings.filter(b => b.requesterId === currentUser.id && (b.status === 'Upcoming' || b.status === 'Ongoing'));
  const myTickets = maintenanceRequests.filter(m => {
    const isAssetHeldByMe = assets.find(a => a.id === m.assetId)?.currentHolderId === currentUser.id;
    return isAssetHeldByMe && m.status !== 'Resolved';
  });

  const pendingMaintenance = maintenanceRequests.filter(m => m.status === 'Pending');
  const pendingTransfers = 3; 

  const getStatusColorClass = (status: string) => {
    if (status === 'Active') return 'badge-success';
    if (status === 'On Leave') return 'badge-warning';
    return 'badge-muted';
  };

  return (
    <div className="profile-page-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>My Account Profile</span>
          </h1>
          <p className="page-subtitle">View, edit, and update your account information and profile picture.</p>
        </div>
      </div>

      {/* 2. Content Row: Side-by-side (30% / 70% width) */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* Left Card (~30% width) - Identity & Photo Upload */}
        <div className="glass-card" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', textAlign: 'center', justifyContent: 'center' }}>
          
          {/* Avatar Container with Upload Hover Effect */}
          <div 
            onClick={handlePhotoUploadClick}
            style={{
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              background: 'var(--accent-muted-bg)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              fontWeight: 700,
              position: 'relative',
              cursor: 'pointer',
              overflow: 'hidden',
              border: '3px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={() => setAvatarHovered(true)}
            onMouseLeave={() => setAvatarHovered(false)}
            className="avatar-upload-overlay"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              getInitials(currentUser.name)
            )}
            
            {/* Camera icon hover overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: avatarHovered ? 1 : 0,
              color: '#ffffff',
              fontSize: '16px',
              transition: 'opacity 0.2s ease',
            }}
            className="hover-overlay-camera"
            >
              📷 Edit
            </div>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handlePhotoChange} 
            style={{ display: 'none' }} 
            accept="image/*" 
          />

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={handlePhotoUploadClick} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '6px' }}>
              Upload Photo
            </button>
            {avatarUrl && (
              <button onClick={handleRemovePhoto} className="btn btn-danger" style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '6px' }}>
                Remove
              </button>
            )}
          </div>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '20px', marginBottom: '6px' }}>
            {currentUser.name}
          </h2>
          
          <span className="badge badge-info" style={{ fontSize: '11px', padding: '4px 12px', fontWeight: 600 }}>
            {currentRole}
          </span>

          {/* Mini role-permission chips row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', width: '100%' }}>
            {currentRole === 'Admin' && (
              <>
                <span className="badge badge-muted" style={{ fontSize: '9px' }}>Full System Access</span>
                <span className="badge badge-muted" style={{ fontSize: '9px' }}>Manage Setup</span>
                <span className="badge badge-muted" style={{ fontSize: '9px' }}>Audit Roles</span>
              </>
            )}
            {currentRole === 'Asset Manager' && (
              <>
                <span className="badge badge-muted" style={{ fontSize: '9px' }}>Approve Maintenance</span>
                <span className="badge badge-muted" style={{ fontSize: '9px' }}>Approve Transfers</span>
                <span className="badge badge-muted" style={{ fontSize: '9px' }}>Manage Catalog</span>
              </>
            )}
            {currentRole === 'Employee' && (
              <>
                <span className="badge badge-muted" style={{ fontSize: '9px' }}>Request Assets</span>
                <span className="badge badge-muted" style={{ fontSize: '9px' }}>Book Rooms</span>
                <span className="badge badge-muted" style={{ fontSize: '9px' }}>Raise Tickets</span>
              </>
            )}
          </div>
        </div>

        {/* Right Card (~70% width) - View Details / Edit Tabbed View */}
        <div className="glass-card" style={{ flex: '2 1 500px', padding: '32px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          
          {/* Header tabs switcher */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '24px' }}>
            <div className="tabs-container" style={{ alignSelf: 'center' }}>
              <button 
                className={`tab-btn ${activeTab === 'View' ? 'active' : ''}`}
                onClick={() => setActiveTab('View')}
              >
                Profile Details
              </button>
              <button 
                className={`tab-btn ${activeTab === 'Edit' ? 'active' : ''}`}
                onClick={() => setActiveTab('Edit')}
              >
                Update Profile
              </button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Account Status:</span>
              <span className={`badge ${getStatusColorClass(currentUser.status)}`} style={{ fontSize: '11px', padding: '3px 10px' }}>
                {currentUser.status}
              </span>
            </div>
          </div>

          {/* TAB 1: VIEW DETAILS */}
          {activeTab === 'View' ? (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
              gap: '24px 32px' 
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="section-title" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Employee ID</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{currentUser.id}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="section-title" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Department</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{currentUser.department || 'Operations'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="section-title" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Job Title</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {currentRole === 'Admin' ? 'Lead Administrator' : currentRole === 'Asset Manager' ? 'Global Operations Manager' : 'Senior Systems Engineer'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="section-title" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Email Address</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{currentUser.email}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="section-title" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Phone Number</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{phone}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="section-title" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Reporting Manager</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {currentRole === 'Admin' ? 'CEO' : 'Sarah Connor (VP of Ops)'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="section-title" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Office Location</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>HQ - San Francisco, CA</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="section-title" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Date Joined</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>2024-03-15</span>
              </div>
            </div>
          ) : (
            // TAB 2: UPDATE FORM
            <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Enter full name" 
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="Enter email address" 
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="Enter phone number" 
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ borderRadius: '8px', padding: '10px 24px' }}>
                  Save Changes
                </button>
                <button type="button" onClick={() => setActiveTab('View')} className="btn btn-secondary" style={{ borderRadius: '8px', padding: '10px 24px' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

      </div>

      {/* 3. Bottom Row: Full-width Activity Summary Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 className="section-title" style={{ marginBottom: '20px', fontSize: '14px' }}>My Activity Summary</h3>
        
        <div className="grid-3 stats-row" style={{ marginBottom: 0 }}>
          {currentRole === 'Employee' && (
            <>
              <Link href="/assets" className="stat-pill-card" style={{ textDecoration: 'none' }}>
                <div className="stat-card-left">
                  <div className="stat-icon-circle blue">💻</div>
                  <div className="stat-details">
                    <span className="stat-label">Assets Allocated to Me</span>
                    <span className="stat-value">{myAssets.length}</span>
                  </div>
                </div>
                <span className="trend-badge positive" style={{ fontSize: '9px' }}>View Items</span>
              </Link>

              <Link href="/booking" className="stat-pill-card" style={{ textDecoration: 'none' }}>
                <div className="stat-card-left">
                  <div className="stat-icon-circle purple">📅</div>
                  <div className="stat-details">
                    <span className="stat-label">My Active Bookings</span>
                    <span className="stat-value">{myBookings.length}</span>
                  </div>
                </div>
                <span className="trend-badge positive" style={{ fontSize: '9px' }}>View Schedule</span>
              </Link>

              <Link href="/maintenance" className="stat-pill-card" style={{ textDecoration: 'none' }}>
                <div className="stat-card-left">
                  <div className="stat-icon-circle warning">🛠️</div>
                  <div className="stat-details">
                    <span className="stat-label">My Open Tickets</span>
                    <span className="stat-value">{myTickets.length}</span>
                  </div>
                </div>
                <span className="trend-badge positive" style={{ fontSize: '9px' }}>Track Progress</span>
              </Link>
            </>
          )}

          {currentRole === 'Asset Manager' && (
            <>
              <Link href="/assets" className="stat-pill-card" style={{ textDecoration: 'none' }}>
                <div className="stat-card-left">
                  <div className="stat-icon-circle blue">📦</div>
                  <div className="stat-details">
                    <span className="stat-label">Assets I Manage</span>
                    <span className="stat-value">{assets.length}</span>
                  </div>
                </div>
                <span className="trend-badge positive" style={{ fontSize: '9px' }}>Manage Catalog</span>
              </Link>

              <Link href="/maintenance" className="stat-pill-card" style={{ textDecoration: 'none' }}>
                <div className="stat-card-left">
                  <div className="stat-icon-circle warning">⚙️</div>
                  <div className="stat-details">
                    <span className="stat-label">Pending Maintenance Approvals</span>
                    <span className="stat-value">{pendingMaintenance.length}</span>
                  </div>
                </div>
                <span className="trend-badge positive" style={{ fontSize: '9px' }}>Open Tickets</span>
              </Link>

              <Link href="/allocation" className="stat-pill-card" style={{ textDecoration: 'none' }}>
                <div className="stat-card-left">
                  <div className="stat-icon-circle purple">🔄</div>
                  <div className="stat-details">
                    <span className="stat-label">Pending Transfer Approvals</span>
                    <span className="stat-value">{pendingTransfers}</span>
                  </div>
                </div>
                <span className="trend-badge positive" style={{ fontSize: '9px' }}>Approve Actions</span>
              </Link>
            </>
          )}

          {currentRole === 'Admin' && (
            <>
              <Link href="/setup" className="stat-pill-card" style={{ textDecoration: 'none' }}>
                <div className="stat-card-left">
                  <div className="stat-icon-circle blue">👥</div>
                  <div className="stat-details">
                    <span className="stat-label">Total Employees</span>
                    <span className="stat-value">{employees.length}</span>
                  </div>
                </div>
                <span className="trend-badge positive" style={{ fontSize: '9px' }}>User Setup</span>
              </Link>

              <Link href="/setup" className="stat-pill-card" style={{ textDecoration: 'none' }}>
                <div className="stat-card-left">
                  <div className="stat-icon-circle purple">🏢</div>
                  <div className="stat-details">
                    <span className="stat-label">Departments Managed</span>
                    <span className="stat-value">{departments.length}</span>
                  </div>
                </div>
                <span className="trend-badge positive" style={{ fontSize: '9px' }}>Org Chart</span>
              </Link>

              <Link href="/setup" className="stat-pill-card" style={{ textDecoration: 'none' }}>
                <div className="stat-card-left">
                  <div className="stat-icon-circle warning">🛡️</div>
                  <div className="stat-details">
                    <span className="stat-label">Pending Role Promotions</span>
                    <span className="stat-value">2</span>
                  </div>
                </div>
                <span className="trend-badge positive" style={{ fontSize: '9px' }}>Review Roles</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Toast Notification Box */}
      {toast && (
        <div className="toast-box">
          <span style={{ color: 'var(--status-success)', fontSize: '18px', fontWeight: 'bold' }}>✓</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{toast}</span>
        </div>
      )}
    </div>
  );
}
