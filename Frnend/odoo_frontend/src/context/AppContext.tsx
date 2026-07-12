'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// Interfaces for our state elements
export interface Department {
  id: string;
  name: string;
  head: string;
  parentDept: string;
  status: 'Active' | 'Inactive';
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'Admin' | 'Asset Manager' | 'Employee';
  status: 'Active' | 'Inactive';
}

export interface Asset {
  id: string;
  tag: string; // AF-XXXX
  name: string;
  category: string;
  serialNumber: string;
  acquisitionDate: string;
  acquisitionCost: number;
  condition: 'New' | 'Good' | 'Fair' | 'Poor';
  location: string;
  status: 'Available' | 'Allocated' | 'Reserved' | 'Under Maintenance' | 'Lost' | 'Retired';
  isBookable: boolean;
  currentHolderId: string | null;
  expectedReturnDate: string | null;
  photoUrl?: string;
  description?: string;
}

export interface Booking {
  id: string;
  assetId: string;
  startTime: string; // ISO or date-time string
  endTime: string; // ISO or date-time string
  requesterId: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
}

export interface MaintenanceRequest {
  id: string;
  assetId: string;
  issue: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'Approved' | 'Technician Assigned' | 'In Progress' | 'Resolved';
  technician?: string;
  notes?: string;
  dateRaised: string;
}

export interface AuditChecklistItem {
  assetId: string;
  expectedLocation: string;
  verification: 'Verified' | 'Missing' | 'Damaged' | 'Unchecked';
}

export interface AuditCycle {
  id: string;
  name: string;
  scopeDepartment: string;
  scopeLocation: string;
  startDate: string;
  endDate: string;
  auditors: string;
  status: 'Active' | 'Closed';
  checklist: AuditChecklistItem[];
}

export interface ActivityLog {
  id: string;
  type: 'info' | 'alert' | 'success' | 'warning';
  message: string;
  timestamp: string; // E.g., "2m ago", "1h ago"
  dateCreated: string; // ISO string for sorting
}

interface AppContextType {
  // Current user / role simulation
  currentRole: 'Admin' | 'Asset Manager' | 'Employee';
  setCurrentRole: (role: 'Admin' | 'Asset Manager' | 'Employee') => void;
  currentUser: Employee;
  setCurrentUser: (employee: Employee) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  
  // Data State
  departments: Department[];
  categories: Category[];
  employees: Employee[];
  assets: Asset[];
  bookings: Booking[];
  maintenanceRequests: MaintenanceRequest[];
  auditCycles: AuditCycle[];
  activityLogs: ActivityLog[];

  // Mutators
  addDepartment: (dept: Omit<Department, 'id'>) => void;
  updateDepartment: (id: string, dept: Partial<Department>) => void;
  addCategory: (cat: Omit<Category, 'id'>) => void;
  updateEmployeeRole: (id: string, role: 'Admin' | 'Asset Manager' | 'Employee') => void;
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  
  addAsset: (asset: Omit<Asset, 'id' | 'tag' | 'status' | 'currentHolderId' | 'expectedReturnDate'>) => Promise<string>;
  updateAsset: (id: string, asset: Partial<Asset>) => void;
  allocateAsset: (assetId: string, employeeId: string, expectedReturnDate: string | null) => Promise<boolean>;
  transferAsset: (assetId: string, targetEmployeeId: string, reason: string) => void;
  returnAsset: (assetId: string, conditionNotes: string, newCondition: 'New' | 'Good' | 'Fair' | 'Poor') => void;
  
  addBooking: (booking: Omit<Booking, 'id' | 'status'>) => Promise<{ success: boolean; error?: string }>;
  cancelBooking: (id: string) => void;
  
  addMaintenanceRequest: (req: Omit<MaintenanceRequest, 'id' | 'status' | 'dateRaised'>) => void;
  updateMaintenanceStatus: (id: string, status: MaintenanceRequest['status'], notes?: string, technician?: string) => void;
  
  addAuditCycle: (cycle: Omit<AuditCycle, 'id' | 'status' | 'checklist'>) => void;
  updateAuditChecklist: (cycleId: string, assetId: string, status: AuditChecklistItem['verification']) => void;
  closeAuditCycle: (cycleId: string) => void;
  
  logActivity: (type: ActivityLog['type'], message: string) => void;

  // Dynamic Authentication actions
  loginUser: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signupUser: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loaded, setLoaded] = useState(false);
  const [currentRole, setCurrentRole] = useState<'Admin' | 'Asset Manager' | 'Employee'>('Admin');
  const [currentUser, setCurrentUser] = useState<Employee>({
    id: '1',
    name: 'Amit Admin',
    email: 'amit.admin@af.com',
    department: '',
    role: 'Admin',
    status: 'Active'
  });
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [auditCycles, setAuditCycles] = useState<AuditCycle[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Seed user credentials matching the backend seed values
  const loginRole = async (role: 'Admin' | 'Asset Manager' | 'Employee') => {
    let email = 'amit.admin@af.com';
    let password = 'admin123';
    if (role === 'Asset Manager') {
      email = 'priya.mgr@af.com';
      password = 'manager123';
    } else if (role === 'Employee') {
      email = 'sana.emp@af.com';
      password = 'emp123';
    }
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('af_access_token', data.access_token);
        const mappedUser: Employee = {
          id: String(data.user.id),
          name: data.user.name,
          email: data.user.email,
          role: data.user.role === 'Asset Manager' ? 'Asset Manager' : data.user.role === 'Admin' ? 'Admin' : 'Employee',
          status: data.user.status === 'Active' ? 'Active' : 'Inactive',
          department: String(data.user.department_id || '')
        };
        setCurrentUser(mappedUser);
        localStorage.setItem('af_currentUser', JSON.stringify(mappedUser));
        return data.access_token;
      }
    } catch (err) {
      console.error('Error logging in role:', err);
    }
    return null;
  };

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    let activeToken = localStorage.getItem('af_access_token');
    if (!activeToken) {
      activeToken = await loginRole(currentRole);
    }
    
    const headers = {
      'Content-Type': 'application/json',
      ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}),
      ...options.headers
    };
    
    let res = await fetch(`http://localhost:8000${path}`, {
      ...options,
      headers
    });
    
    if (res.status === 401) {
      // Re-auth
      activeToken = await loginRole(currentRole);
      if (activeToken) {
        res = await fetch(`http://localhost:8000${path}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${activeToken}`,
            ...options.headers
          }
        });
      }
    }
    return res;
  };

  const refreshData = async () => {
    try {
      // Fetch departments
      const deptsRes = await apiFetch('/api/org/departments');
      if (deptsRes.ok) {
        const deptsData = await deptsRes.json();
        setDepartments(deptsData.map((d: any) => ({
          id: String(d.id),
          name: d.name,
          head: d.head_name || 'N/A',
          parentDept: d.parent_name || '',
          status: d.status === 'Active' ? 'Active' : 'Inactive'
        })));
      }

      // Fetch categories
      const catsRes = await apiFetch('/api/org/categories');
      if (catsRes.ok) {
        const catsData = await catsRes.json();
        setCategories(catsData.map((c: any) => ({
          id: String(c.id),
          name: c.name,
          description: c.description || ''
        })));
      }

      // Fetch employees
      const empsRes = await apiFetch('/api/org/employees');
      if (empsRes.ok) {
        const empsData = await empsRes.json();
        setEmployees(empsData.map((e: any) => ({
          id: String(e.id),
          name: e.name,
          email: e.email,
          department: String(e.department_id || ''),
          role: e.role === 'Admin' ? 'Admin' : e.role === 'Asset Manager' ? 'Asset Manager' : 'Employee',
          status: e.status === 'Active' ? 'Active' : 'Inactive'
        })));
      }

      // Fetch assets
      const assetsRes = await apiFetch('/api/assets');
      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        setAssets(assetsData.map((a: any) => ({
          id: String(a.id),
          tag: a.asset_tag,
          name: a.name,
          category: a.category_name || String(a.category_id),
          serialNumber: a.serial_number,
          acquisitionDate: String(a.acquisition_date),
          acquisitionCost: a.acquisition_cost,
          condition: a.condition as any,
          location: a.location,
          status: a.status as any,
          isBookable: a.is_shared_bookable,
          photoUrl: a.photo_url || undefined,
          currentHolderId: a.current_holder_id ? String(a.current_holder_id) : null,
          expectedReturnDate: null
        })));
      }

      // Fetch bookings
      const bookingsRes = await apiFetch('/api/bookings');
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        setBookings(bookingsData.map((b: any) => ({
          id: String(b.id),
          assetId: String(b.asset_id),
          startTime: String(b.start_time),
          endTime: String(b.end_time),
          requesterId: String(b.booked_by_id),
          status: b.status as any
        })));
      }

      // Fetch maintenance requests
      const maintRes = await apiFetch('/api/maintenance');
      if (maintRes.ok) {
        const maintData = await maintRes.json();
        setMaintenanceRequests(maintData.map((m: any) => ({
          id: String(m.id),
          assetId: String(m.asset_id),
          issue: m.description,
          priority: m.priority as any,
          status: m.status as any,
          technician: m.assigned_technician || undefined,
          notes: m.resolved_notes || undefined,
          dateRaised: String(m.created_at)
        })));
      }

      // Fetch audit cycles
      const auditsRes = await apiFetch('/api/audits/cycles');
      if (auditsRes.ok) {
        const auditsData = await auditsRes.json();
        const cyclesWithChecklists = await Promise.all(auditsData.map(async (c: any) => {
          const assetsScopeRes = await apiFetch(`/api/audits/cycles/${c.id}/assets-in-scope`);
          let scopeAssets: any[] = [];
          if (assetsScopeRes.ok) {
            scopeAssets = await assetsScopeRes.json();
          }

          let discrepancies: any[] = [];
          const discrepRes = await apiFetch(`/api/audits/cycles/${c.id}/discrepancies`);
          if (discrepRes.ok) {
            discrepancies = await discrepRes.json();
          }

          const checklist = scopeAssets.map((sa: any) => {
            const disc = discrepancies.find((d: any) => d.asset_id === sa.id);
            return {
              assetId: String(sa.id),
              expectedLocation: sa.location,
              verification: disc ? (disc.status as any) : 'Unchecked'
            };
          });

          return {
            id: String(c.id),
            name: c.name,
            scopeDepartment: c.scope_type === 'Department' ? c.scope_value || 'All' : 'All',
            scopeLocation: c.scope_type === 'Location' ? c.scope_value || 'All' : 'All',
            startDate: c.start_date,
            endDate: c.end_date,
            auditors: c.auditors.map((aud: any) => aud.name).join(', '),
            status: c.status as any,
            checklist
          };
        }));
        setAuditCycles(cyclesWithChecklists);
      }

      // Fetch logs / notifications
      const activeRole = localStorage.getItem('af_currentRole') || currentRole;
      if (activeRole === 'Admin') {
        const logsRes = await apiFetch('/api/logs');
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setActivityLogs(logsData.map((l: any) => ({
            id: String(l.id),
            type: l.action.toLowerCase().includes('fail') || l.action.toLowerCase().includes('reject') ? 'warning' : 'info',
            message: l.details || `${l.action} on ${l.entity_type} ID ${l.entity_id}`,
            timestamp: 'Just now',
            dateCreated: String(l.created_at)
          })));
        }
      } else {
        const notifRes = await apiFetch('/api/notifications');
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          setActivityLogs(notifData.map((n: any) => ({
            id: String(n.id),
            type: n.message.toLowerCase().includes('alert') || n.message.toLowerCase().includes('overdue') ? 'warning' : 'info',
            message: n.message,
            timestamp: 'Just now',
            dateCreated: String(n.created_at)
          })));
        }
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('af_currentRole');
      const storedUser = localStorage.getItem('af_currentUser');
      const storedTheme = localStorage.getItem('af_theme');

      if (storedRole) setCurrentRole(storedRole as any);
      if (storedUser) setCurrentUser(JSON.parse(storedUser));
      if (storedTheme === 'light' || storedTheme === 'dark') {
        setTheme(storedTheme);
        document.body.className = storedTheme;
      } else {
        document.body.className = 'dark';
      }
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (loaded) {
      refreshData();
    }
  }, [loaded, currentRole]);

  useEffect(() => {
    if (loaded && typeof window !== 'undefined') {
      localStorage.setItem('af_theme', theme);
      document.body.className = theme;
    }
  }, [theme, loaded]);

  useEffect(() => {
    if (loaded && currentUser && typeof window !== 'undefined') {
      localStorage.setItem('af_currentUser', JSON.stringify(currentUser));
    }
  }, [currentUser, loaded]);

  const selectRoleAndSyncUser = async (role: 'Admin' | 'Asset Manager' | 'Employee') => {
    setCurrentRole(role);
    localStorage.setItem('af_currentRole', role);
    const newToken = await loginRole(role);
    if (newToken) {
      await refreshData();
    }
  };

  const loginUser = async (email: string, password: string) => {
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('af_access_token', data.access_token);
        const mappedUser: Employee = {
          id: String(data.user.id),
          name: data.user.name,
          email: data.user.email,
          role: data.user.role === 'Asset Manager' ? 'Asset Manager' : data.user.role === 'Admin' ? 'Admin' : 'Employee',
          status: data.user.status === 'Active' ? 'Active' : 'Inactive',
          department: String(data.user.department_id || '')
        };
        setCurrentUser(mappedUser);
        setCurrentRole(mappedUser.role);
        localStorage.setItem('af_currentUser', JSON.stringify(mappedUser));
        localStorage.setItem('af_currentRole', mappedUser.role);
        await refreshData();
        return { success: true };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.detail || 'Invalid email or password.' };
      }
    } catch (err) {
      return { success: false, error: 'Connection failed. Ensure backend is running.' };
    }
  };

  const signupUser = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch('http://localhost:8000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      if (res.ok) {
        return loginUser(email, password);
      } else {
        const errData = await res.json();
        return { success: false, error: errData.detail || 'Signup failed.' };
      }
    } catch (err) {
      return { success: false, error: 'Connection failed. Ensure backend is running.' };
    }
  };

  const logActivity = (type: ActivityLog['type'], message: string) => {
    const newLog: ActivityLog = {
      id: generateId(),
      type,
      message,
      timestamp: 'Just now',
      dateCreated: new Date().toISOString()
    };
    setActivityLogs(prev => [newLog, ...prev]);
  };

  const addDepartment = async (dept: Omit<Department, 'id'>) => {
    const headEmp = employees.find(e => e.name.toLowerCase() === dept.head.toLowerCase());
    const parentDeptObj = departments.find(d => d.name.toLowerCase() === dept.parentDept.toLowerCase());
    
    try {
      const res = await apiFetch('/api/org/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: dept.name,
          department_head_id: headEmp ? parseInt(headEmp.id) : null,
          parent_department_id: parentDeptObj ? parseInt(parentDeptObj.id) : null,
          status: dept.status
        })
      });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateDepartment = async (id: string, updatedFields: Partial<Department>) => {
    const headEmp = updatedFields.head ? employees.find(e => e.name.toLowerCase() === updatedFields.head!.toLowerCase()) : undefined;
    const parentDeptObj = updatedFields.parentDept ? departments.find(d => d.name.toLowerCase() === updatedFields.parentDept!.toLowerCase()) : undefined;

    try {
      const res = await apiFetch(`/api/org/departments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: updatedFields.name,
          department_head_id: headEmp ? parseInt(headEmp.id) : (updatedFields.head === '' ? 0 : undefined),
          parent_department_id: parentDeptObj ? parseInt(parentDeptObj.id) : (updatedFields.parentDept === '' ? 0 : undefined),
          status: updatedFields.status
        })
      });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addCategory = async (cat: Omit<Category, 'id'>) => {
    try {
      const res = await apiFetch('/api/org/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: cat.name,
          description: cat.description,
          fields_schema: null
        })
      });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateEmployeeRole = async (id: string, role: 'Admin' | 'Asset Manager' | 'Employee') => {
    try {
      const res = await apiFetch(`/api/org/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addEmployee = async (emp: Omit<Employee, 'id'>) => {
    try {
      const signupRes = await fetch('http://localhost:8000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: emp.name,
          email: emp.email,
          password: 'password123'
        })
      });
      if (signupRes.ok) {
        const newEmpData = await signupRes.json();
        const newEmpId = newEmpData.id;
        
        const deptObj = departments.find(d => d.name.toLowerCase() === emp.department.toLowerCase());
        await apiFetch(`/api/org/employees/${newEmpId}`, {
          method: 'PUT',
          body: JSON.stringify({
            role: emp.role,
            department_id: deptObj ? parseInt(deptObj.id) : null,
            status: emp.status
          })
        });
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addAsset = async (asset: Omit<Asset, 'id' | 'tag' | 'status' | 'currentHolderId' | 'expectedReturnDate'>): Promise<string> => {
    const catObj = categories.find(c => c.name.toLowerCase() === asset.category.toLowerCase());
    try {
      const res = await apiFetch('/api/assets', {
        method: 'POST',
        body: JSON.stringify({
          name: asset.name,
          category_id: catObj ? parseInt(catObj.id) : 1,
          serial_number: asset.serialNumber,
          acquisition_date: asset.acquisitionDate,
          acquisition_cost: asset.acquisitionCost,
          condition: asset.condition,
          location: asset.location,
          is_shared_bookable: asset.isBookable,
          photo_url: asset.photoUrl || null,
          custom_values: null
        })
      });
      if (res.ok) {
        const data = await res.json();
        await refreshData();
        return data.asset_tag;
      }
    } catch (err) {
      console.error(err);
    }
    return 'AF-' + String(assets.length + 1).padStart(4, '0');
  };

  const updateAsset = async (id: string, updatedFields: Partial<Asset>) => {
    const catObj = updatedFields.category ? categories.find(c => c.name.toLowerCase() === updatedFields.category!.toLowerCase()) : undefined;
    try {
      const res = await apiFetch(`/api/assets/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: updatedFields.name,
          category_id: catObj ? parseInt(catObj.id) : undefined,
          serial_number: updatedFields.serialNumber,
          acquisition_date: updatedFields.acquisitionDate,
          acquisition_cost: updatedFields.acquisitionCost,
          condition: updatedFields.condition,
          location: updatedFields.location,
          is_shared_bookable: updatedFields.isBookable,
          status: updatedFields.status
        })
      });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const allocateAsset = async (assetId: string, employeeId: string, expectedReturnDate: string | null): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/allocations', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: parseInt(assetId),
          employee_id: parseInt(employeeId),
          department_id: null,
          expected_return_date: expectedReturnDate ? new Date(expectedReturnDate).toISOString() : null
        })
      });
      if (res.ok) {
        await refreshData();
        return true;
      }
    } catch (err) {
      console.error(err);
    }
    return false;
  };

  const transferAsset = async (assetId: string, targetEmployeeId: string, reason: string) => {
    try {
      const res = await apiFetch('/api/allocations/transfers', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: parseInt(assetId),
          target_employee_id: parseInt(targetEmployeeId),
          target_department_id: null,
          notes: reason
        })
      });
      if (res.ok) {
        const data = await res.json();
        const transferId = data.id;
        const role = localStorage.getItem('af_currentRole') || currentRole;
        if (role === 'Admin' || role === 'Asset Manager') {
          await apiFetch(`/api/allocations/transfers/${transferId}/action?approve=true`, {
            method: 'POST'
          });
        }
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const returnAsset = async (assetId: string, conditionNotes: string, newCondition: 'New' | 'Good' | 'Fair' | 'Poor') => {
    try {
      const allocsRes = await apiFetch('/api/allocations');
      if (allocsRes.ok) {
        const allocs = await allocsRes.json();
        const activeAlloc = allocs.find((a: any) => a.asset_id === parseInt(assetId) && a.status === 'Active');
        if (activeAlloc) {
          const res = await apiFetch(`/api/allocations/${activeAlloc.id}/return`, {
            method: 'POST',
            body: JSON.stringify({
              return_condition: newCondition,
              return_notes: conditionNotes
            })
          });
          if (res.ok) {
            await refreshData();
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addBooking = async (booking: Omit<Booking, 'id' | 'status'>): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: parseInt(booking.assetId),
          start_time: booking.startTime,
          end_time: booking.endTime
        })
      });
      if (res.ok) {
        await refreshData();
        return { success: true };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.detail || 'Booking conflict.' };
      }
    } catch (err) {
      return { success: false, error: 'Network error.' };
    }
  };

  const cancelBooking = async (id: string) => {
    try {
      const res = await apiFetch(`/api/bookings/${id}/cancel`, {
        method: 'POST'
      });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addMaintenanceRequest = async (req: Omit<MaintenanceRequest, 'id' | 'status' | 'dateRaised'>) => {
    try {
      const res = await apiFetch('/api/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: parseInt(req.assetId),
          description: req.issue,
          priority: req.priority,
          photo_url: null
        })
      });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateMaintenanceStatus = async (id: string, status: MaintenanceRequest['status'], notes?: string, technician?: string) => {
    let backendStatus = status;
    if (status === 'Technician Assigned') {
      backendStatus = 'In Progress';
    }
    try {
      const res = await apiFetch(`/api/maintenance/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: backendStatus,
          assigned_technician: technician || undefined,
          resolved_notes: notes || undefined
        })
      });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addAuditCycle = async (cycle: Omit<AuditCycle, 'id' | 'status' | 'checklist'>) => {
    const auditorNames = cycle.auditors.split(',').map(s => s.trim().toLowerCase());
    const auditorIds = employees
      .filter(e => auditorNames.some(name => e.name.toLowerCase().includes(name) || e.email.toLowerCase().includes(name)))
      .map(e => parseInt(e.id));
    
    const payload = {
      name: cycle.name,
      scope_type: cycle.scopeDepartment !== 'All' ? 'Department' : (cycle.scopeLocation !== 'All' ? 'Location' : 'All'),
      scope_value: cycle.scopeDepartment !== 'All' ? cycle.scopeDepartment : (cycle.scopeLocation !== 'All' ? cycle.scopeLocation : null),
      start_date: cycle.startDate,
      end_date: cycle.endDate,
      auditor_ids: auditorIds.length > 0 ? auditorIds : [1]
    };

    try {
      const res = await apiFetch('/api/audits/cycles', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateAuditChecklist = async (cycleId: string, assetId: string, status: AuditChecklistItem['verification']) => {
    try {
      const res = await apiFetch(`/api/audits/cycles/${cycleId}/results/${assetId}`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          notes: 'Audited via frontend checklist'
        })
      });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const closeAuditCycle = async (cycleId: string) => {
    try {
      const res = await apiFetch(`/api/audits/cycles/${cycleId}/close`, {
        method: 'POST'
      });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentRole,
        setCurrentRole: selectRoleAndSyncUser,
        currentUser,
        setCurrentUser,
        
        departments,
        categories,
        employees,
        assets,
        bookings,
        maintenanceRequests,
        auditCycles,
        activityLogs,
        theme,
        setTheme,

        addDepartment,
        updateDepartment,
        addCategory,
        updateEmployeeRole,
        addEmployee,
        
        addAsset,
        updateAsset,
        allocateAsset,
        transferAsset,
        returnAsset,
        
        addBooking,
        cancelBooking,
        
        addMaintenanceRequest,
        updateMaintenanceStatus,
        
        addAuditCycle,
        updateAuditChecklist,
        closeAuditCycle,
        
        logActivity,

        loginUser,
        signupUser
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppContextProvider');
  }
  return context;
};
