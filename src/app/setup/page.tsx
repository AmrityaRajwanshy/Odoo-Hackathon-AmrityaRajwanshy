'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Badge } from '@/components/Badge';

export default function SetupPage() {
  const { 
    currentRole, 
    departments, 
    categories, 
    employees, 
    addDepartment, 
    updateDepartment, 
    addCategory, 
    updateEmployeeRole,
    addEmployee
  } = useApp();

  const [activeTab, setActiveTab] = useState<'departments' | 'categories' | 'directory'>('departments');
  
  // Modals state
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showEmpModal, setShowEmpModal] = useState(false);

  // Form states
  const [deptName, setDeptName] = useState('');
  const [deptHead, setDeptHead] = useState('');
  const [deptParent, setDeptParent] = useState('');
  
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empDept, setEmpDept] = useState('Engineering');
  const [empRole, setEmpRole] = useState<'Admin' | 'Asset Manager' | 'Employee'>('Employee');

  // Authorization Guard
  if (currentRole !== 'Admin') {
    return (
      <div className="setup-container" style={{ maxWidth: '600px', margin: '4rem auto' }}>
        <div className="glass-panel text-center error-panel">
          <svg width="64" height="64" fill="none" stroke="var(--status-danger)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '1rem' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
          <h2 className="panel-title text-danger">Access Denied</h2>
          <p className="panel-text">The Organization Setup panel is restricted to system Administrators only.</p>
          <p className="panel-sub">Please switch your simulated role in the top bar to Admin to view this page.</p>
        </div>
        <style jsx>{`
          .text-center { text-align: center; }
          .error-panel { border-top: 4px solid var(--status-danger); }
          .panel-title { font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
          .panel-text { color: var(--text-primary); margin-bottom: 0.25rem; font-size: 0.95rem; }
          .panel-sub { color: var(--text-secondary); font-size: 0.85rem; }
        `}</style>
      </div>
    );
  }

  // Handle submissions
  const handleDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName || !deptHead) return;
    addDepartment({
      name: deptName,
      head: deptHead,
      parentDept: deptParent,
      status: 'Active'
    });
    setDeptName('');
    setDeptHead('');
    setDeptParent('');
    setShowDeptModal(false);
  };

  const handleCatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName) return;
    addCategory({
      name: catName,
      description: catDesc
    });
    setCatName('');
    setCatDesc('');
    setShowCatModal(false);
  };

  const handleEmpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName || !empEmail) return;
    addEmployee({
      name: empName,
      email: empEmail,
      department: empDept,
      role: empRole,
      status: 'Active'
    });
    setEmpName('');
    setEmpEmail('');
    setEmpDept('Engineering');
    setEmpRole('Employee');
    setShowEmpModal(false);
  };

  const toggleDeptStatus = (id: string, currentStatus: 'Active' | 'Inactive') => {
    updateDepartment(id, { status: currentStatus === 'Active' ? 'Inactive' : 'Active' });
  };

  return (
    <div className="setup-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Organization Setup</h1>
          <p className="page-subtitle">Configure company departments, directories, and category taxonomies.</p>
        </div>
        <div>
          {activeTab === 'departments' && (
            <button className="btn btn-primary" onClick={() => setShowDeptModal(true)}>+ Add Department</button>
          )}
          {activeTab === 'categories' && (
            <button className="btn btn-primary" onClick={() => setShowCatModal(true)}>+ Add Category</button>
          )}
          {activeTab === 'directory' && (
            <button className="btn btn-primary" onClick={() => setShowEmpModal(true)}>+ Add Employee</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button 
          className={`tab-btn ${activeTab === 'departments' ? 'active' : ''}`}
          onClick={() => setActiveTab('departments')}
        >
          Departments
        </button>
        <button 
          className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Asset Categories
        </button>
        <button 
          className={`tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => setActiveTab('directory')}
        >
          Employee Directory
        </button>
      </div>

      {/* Content Area */}
      <div className="setup-content-wrapper">
        {activeTab === 'departments' && (
          <div className="table-container glass-card">
            <table className="table-glass">
              <thead>
                <tr>
                  <th>Department Name</th>
                  <th>Department Head</th>
                  <th>Parent Dept</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id}>
                    <td style={{ fontWeight: 600 }}>{dept.name}</td>
                    <td>{dept.head}</td>
                    <td>{dept.parentDept || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>
                      <Badge status={dept.status} />
                    </td>
                    <td>
                      <button 
                        className={`toggle-action-btn ${dept.status === 'Active' ? 'text-danger' : 'text-success'}`}
                        onClick={() => toggleDeptStatus(dept.id, dept.status)}
                      >
                        {dept.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="table-container glass-card">
            <table className="table-glass">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Category Name</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td style={{ fontWeight: 600 }}>{cat.name}</td>
                    <td>{cat.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'directory' && (
          <div className="table-container glass-card">
            <table className="table-glass">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Work Email</th>
                  <th>Department</th>
                  <th>Simulated Role</th>
                  <th>System Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 600 }}>{emp.name}</td>
                    <td className="mono-text">{emp.email}</td>
                    <td>{emp.department}</td>
                    <td>
                      <select
                        className="form-control role-inline-select"
                        value={emp.role}
                        onChange={(e) => updateEmployeeRole(emp.id, e.target.value as any)}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem', width: '150px' }}
                      >
                        <option value="Employee">Employee</option>
                        <option value="Asset Manager">Asset Manager</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <Badge status={emp.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DEPARTMENT MODAL */}
      {showDeptModal && (
        <div className="modal-overlay" onClick={() => setShowDeptModal(false)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Create Department</h2>
            <form onSubmit={handleDeptSubmit} style={{ marginTop: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="dept-name">Department Name</label>
                <input 
                  id="dept-name"
                  type="text" 
                  className="form-control" 
                  value={deptName} 
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Field Operations"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="dept-head">Department Head</label>
                <input 
                  id="dept-head"
                  type="text" 
                  className="form-control" 
                  value={deptHead} 
                  onChange={(e) => setDeptHead(e.target.value)}
                  placeholder="e.g. Aditi Rao"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="dept-parent">Parent Department (Optional)</label>
                <input 
                  id="dept-parent"
                  type="text" 
                  className="form-control" 
                  value={deptParent} 
                  onChange={(e) => setDeptParent(e.target.value)}
                  placeholder="e.g. Operations"
                />
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeptModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {showCatModal && (
        <div className="modal-overlay" onClick={() => setShowCatModal(false)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Create Category</h2>
            <form onSubmit={handleCatSubmit} style={{ marginTop: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="cat-name">Category Name</label>
                <input 
                  id="cat-name"
                  type="text" 
                  className="form-control" 
                  value={catName} 
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Mobile Phones, Lab Equipment"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cat-desc">Description</label>
                <textarea 
                  id="cat-desc"
                  className="form-control" 
                  value={catDesc} 
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Provide scope/notes for this category..."
                  rows={3}
                />
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCatModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMPLOYEE MODAL */}
      {showEmpModal && (
        <div className="modal-overlay" onClick={() => setShowEmpModal(false)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Add Employee</h2>
            <form onSubmit={handleEmpSubmit} style={{ marginTop: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="emp-name">Full Name</label>
                <input 
                  id="emp-name"
                  type="text" 
                  className="form-control" 
                  value={empName} 
                  onChange={(e) => setEmpName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="emp-email">Work Email</label>
                <input 
                  id="emp-email"
                  type="email" 
                  className="form-control" 
                  value={empEmail} 
                  onChange={(e) => setEmpEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="emp-dept">Department</label>
                <select 
                  id="emp-dept"
                  className="form-control"
                  value={empDept}
                  onChange={(e) => setEmpDept(e.target.value)}
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="emp-role">Default Role</label>
                <select 
                  id="emp-role"
                  className="form-control"
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value as any)}
                >
                  <option value="Employee">Employee</option>
                  <option value="Asset Manager">Asset Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEmpModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .setup-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .toggle-action-btn {
          background: none;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .toggle-action-btn:hover {
          text-decoration: underline;
        }

        .text-danger {
          color: var(--status-danger);
        }

        .text-success {
          color: var(--status-success);
        }

        .role-inline-select {
          background: var(--bg-elevated);
          border-color: var(--border-subtle);
        }
      `}</style>
    </div>
  );
}
