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
  
  addAsset: (asset: Omit<Asset, 'id' | 'tag' | 'status' | 'currentHolderId' | 'expectedReturnDate'>) => string;
  updateAsset: (id: string, asset: Partial<Asset>) => void;
  allocateAsset: (assetId: string, employeeId: string, expectedReturnDate: string | null) => boolean;
  transferAsset: (assetId: string, targetEmployeeId: string, reason: string) => void;
  returnAsset: (assetId: string, conditionNotes: string, newCondition: 'New' | 'Good' | 'Fair' | 'Poor') => void;
  
  addBooking: (booking: Omit<Booking, 'id' | 'status'>) => { success: boolean; error?: string };
  cancelBooking: (id: string) => void;
  
  addMaintenanceRequest: (req: Omit<MaintenanceRequest, 'id' | 'status' | 'dateRaised'>) => void;
  updateMaintenanceStatus: (id: string, status: MaintenanceRequest['status'], notes?: string, technician?: string) => void;
  
  addAuditCycle: (cycle: Omit<AuditCycle, 'id' | 'status' | 'checklist'>) => void;
  updateAuditChecklist: (cycleId: string, assetId: string, status: AuditChecklistItem['verification']) => void;
  closeAuditCycle: (cycleId: string) => void;
  
  logActivity: (type: ActivityLog['type'], message: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

// SEED MOCK DATA
const initialDepartments: Department[] = [
  { id: 'd1', name: 'Engineering', head: 'Aditi Rao', parentDept: '', status: 'Active' },
  { id: 'd2', name: 'Facilities', head: 'Rohan Mehta', parentDept: '', status: 'Active' },
  { id: 'd3', name: 'Field Ops', head: 'Sana Iqbal', parentDept: 'Operations', status: 'Inactive' }
];

const initialCategories: Category[] = [
  { id: 'c1', name: 'Electronics', description: 'Laptops, tablets, monitors, servers' },
  { id: 'c2', name: 'Furniture', description: 'Desks, office chairs, conference tables' },
  { id: 'c3', name: 'Vehicles', description: 'Company cars, cargo vans, electric carts' }
];

const initialEmployees: Employee[] = [
  { id: 'e1', name: 'Sumit Sill', email: 'sumit@company.com', department: 'Engineering', role: 'Admin', status: 'Active' },
  { id: 'e2', name: 'Priya Shah', email: 'priya@company.com', department: 'Engineering', role: 'Employee', status: 'Active' },
  { id: 'e3', name: 'Rohan Mehta', email: 'rohan@company.com', department: 'Facilities', role: 'Asset Manager', status: 'Active' },
  { id: 'e4', name: 'Arjun Nair', email: 'arjun@company.com', department: 'Engineering', role: 'Employee', status: 'Active' },
  { id: 'e5', name: 'Sana Iqbal', email: 'sana@company.com', department: 'Field Ops', role: 'Employee', status: 'Active' }
];

const initialAssets: Asset[] = [
  {
    id: 'a1',
    tag: 'AF-0012',
    name: 'Dell XPS 15 Laptop',
    category: 'Electronics',
    serialNumber: 'SN-XPS98721',
    acquisitionDate: '2025-06-12',
    acquisitionCost: 1850,
    condition: 'Good',
    location: 'Bangalore Office',
    status: 'Allocated',
    isBookable: false,
    currentHolderId: 'e2', // Priya Shah
    expectedReturnDate: '2026-08-15',
    description: 'High-performance developer machine.'
  },
  {
    id: 'a2',
    tag: 'AF-0062',
    name: 'Epson 4K Projector',
    category: 'Electronics',
    serialNumber: 'SN-EPS10293',
    acquisitionDate: '2025-01-20',
    acquisitionCost: 1200,
    condition: 'Fair',
    location: 'HQ Floor 2 - Boardroom',
    status: 'Under Maintenance',
    isBookable: true,
    currentHolderId: null,
    expectedReturnDate: null,
    description: 'Conference room projector.'
  },
  {
    id: 'a3',
    tag: 'AF-0201',
    name: 'Ergonomic Mesh Chair',
    category: 'Furniture',
    serialNumber: 'SN-CH34981',
    acquisitionDate: '2024-11-05',
    acquisitionCost: 350,
    condition: 'Good',
    location: 'Warehouse A',
    status: 'Available',
    isBookable: false,
    currentHolderId: null,
    expectedReturnDate: null,
    description: 'Standard office ergonomic chair.'
  },
  {
    id: 'a4',
    tag: 'AF-0331',
    name: 'Ford Transit Cargo Van',
    category: 'Vehicles',
    serialNumber: 'SN-VAN88273',
    acquisitionDate: '2025-09-01',
    acquisitionCost: 45000,
    condition: 'New',
    location: 'HQ Garage',
    status: 'Available',
    isBookable: true,
    currentHolderId: null,
    expectedReturnDate: null,
    description: 'Delivery and field ops logistics vehicle.'
  },
  {
    id: 'a5',
    tag: 'AF-0099',
    name: 'Apple iPad Pro 11"',
    category: 'Electronics',
    serialNumber: 'SN-IPD77281',
    acquisitionDate: '2025-03-10',
    acquisitionCost: 999,
    condition: 'Poor',
    location: 'HQ Floor 1',
    status: 'Lost',
    isBookable: false,
    currentHolderId: null,
    expectedReturnDate: null,
    description: 'Design team tablet.'
  },
  {
    id: 'a6',
    tag: 'AF-0105',
    name: 'Conference Room 22',
    category: 'Electronics',
    serialNumber: 'SN-RM22',
    acquisitionDate: '2024-01-01',
    acquisitionCost: 0,
    condition: 'Good',
    location: 'HQ Floor 2',
    status: 'Available',
    isBookable: true,
    currentHolderId: null,
    expectedReturnDate: null,
    description: '10-person capacity meeting space.'
  },
  {
    id: 'a7',
    tag: 'AF-0021',
    name: 'Apple MacBook Pro 16"',
    category: 'Electronics',
    serialNumber: 'SN-MBP88301',
    acquisitionDate: '2024-05-15',
    acquisitionCost: 2499,
    condition: 'Good',
    location: 'Bangalore Office',
    status: 'Allocated',
    isBookable: false,
    currentHolderId: 'e4', // Arjun Nair
    expectedReturnDate: '2026-07-09', // Overdue relative to 2026-07-12
    description: 'Lead designer laptop.'
  }
];

const initialBookings: Booking[] = [
  {
    id: 'b1',
    assetId: 'a6',
    startTime: '2026-07-12T09:00:00',
    endTime: '2026-07-12T10:00:00',
    requesterId: 'e3',
    status: 'Completed'
  },
  {
    id: 'b2',
    assetId: 'a6',
    startTime: '2026-07-12T14:00:00',
    endTime: '2026-07-12T15:00:00',
    requesterId: 'e2',
    status: 'Upcoming'
  }
];

const initialMaintenance: MaintenanceRequest[] = [
  {
    id: 'm1',
    assetId: 'a2',
    issue: 'Projector bulb flickers and unit shuts down unexpectedly.',
    priority: 'High',
    status: 'Pending',
    dateRaised: '2026-07-11T16:00:00'
  },
  {
    id: 'm2',
    assetId: 'a5',
    issue: 'Cracked screen repair.',
    priority: 'Medium',
    status: 'In Progress',
    technician: 'Tech R. Verma',
    notes: 'Parts ordered, awaiting screen delivery.',
    dateRaised: '2026-07-08T10:30:00'
  }
];

const initialActivityLogs: ActivityLog[] = [
  {
    id: 'l1',
    type: 'success',
    message: 'Laptop AF-0012 allocated to Priya Shah (Engineering dept)',
    timestamp: '2m ago',
    dateCreated: new Date(Date.now() - 2 * 60 * 1000).toISOString()
  },
  {
    id: 'l2',
    type: 'info',
    message: 'Booking confirmed: Conference Room 22 for 2:00 to 3:00 PM',
    timestamp: '1h ago',
    dateCreated: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  },
  {
    id: 'l3',
    type: 'warning',
    message: 'Maintenance request AF-0062 raised for Epson 4K Projector',
    timestamp: '3h ago',
    dateCreated: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  }
];

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loaded, setLoaded] = useState(false);
  const [currentRole, setCurrentRole] = useState<'Admin' | 'Asset Manager' | 'Employee'>('Admin');
  const [currentUser, setCurrentUser] = useState<Employee>(initialEmployees[0]);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>(initialMaintenance);
  const [auditCycles, setAuditCycles] = useState<AuditCycle[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(initialActivityLogs);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('af_currentRole');
      const storedUser = localStorage.getItem('af_currentUser');
      const storedDepts = localStorage.getItem('af_departments');
      const storedCats = localStorage.getItem('af_categories');
      const storedEmps = localStorage.getItem('af_employees');
      const storedAssets = localStorage.getItem('af_assets');
      const storedBookings = localStorage.getItem('af_bookings');
      const storedMaintenance = localStorage.getItem('af_maintenance');
      const storedAudits = localStorage.getItem('af_audits');
      const storedLogs = localStorage.getItem('af_logs');

      if (storedRole) setCurrentRole(storedRole as any);
      if (storedUser) setCurrentUser(JSON.parse(storedUser));
      if (storedDepts) setDepartments(JSON.parse(storedDepts));
      if (storedCats) setCategories(JSON.parse(storedCats));
      if (storedEmps) setEmployees(JSON.parse(storedEmps));
      if (storedAssets) setAssets(JSON.parse(storedAssets));
      if (storedBookings) setBookings(JSON.parse(storedBookings));
      if (storedMaintenance) setMaintenanceRequests(JSON.parse(storedMaintenance));
      if (storedAudits) setAuditCycles(JSON.parse(storedAudits));
      if (storedLogs) setActivityLogs(JSON.parse(storedLogs));
      
      const storedTheme = localStorage.getItem('af_theme');
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
    if (loaded && typeof window !== 'undefined') {
      localStorage.setItem('af_currentRole', currentRole);
      localStorage.setItem('af_currentUser', JSON.stringify(currentUser));
      localStorage.setItem('af_departments', JSON.stringify(departments));
      localStorage.setItem('af_categories', JSON.stringify(categories));
      localStorage.setItem('af_employees', JSON.stringify(employees));
      localStorage.setItem('af_assets', JSON.stringify(assets));
      localStorage.setItem('af_bookings', JSON.stringify(bookings));
      localStorage.setItem('af_maintenance', JSON.stringify(maintenanceRequests));
      localStorage.setItem('af_audits', JSON.stringify(auditCycles));
      localStorage.setItem('af_logs', JSON.stringify(activityLogs));
      localStorage.setItem('af_theme', theme);
      document.body.className = theme;
    }
  }, [loaded, currentRole, currentUser, departments, categories, employees, assets, bookings, maintenanceRequests, auditCycles, activityLogs, theme]);

  const selectRoleAndSyncUser = (role: 'Admin' | 'Asset Manager' | 'Employee') => {
    setCurrentRole(role);
    const matchedUser = employees.find(e => e.role === role && e.status === 'Active');
    if (matchedUser) {
      setCurrentUser(matchedUser);
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

  useEffect(() => {
    const interval = setInterval(() => {
      setActivityLogs(prevLogs =>
        prevLogs.map(log => {
          const diffMs = Date.now() - new Date(log.dateCreated).getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHrs = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHrs / 24);

          let relative = 'Just now';
          if (diffDays > 0) relative = `${diffDays}d ago`;
          else if (diffHrs > 0) relative = `${diffHrs}h ago`;
          else if (diffMins > 0) relative = `${diffMins}m ago`;

          return { ...log, timestamp: relative };
        })
      );
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const addDepartment = (dept: Omit<Department, 'id'>) => {
    const newDept: Department = { ...dept, id: 'd-' + generateId() };
    setDepartments(prev => [...prev, newDept]);
    logActivity('info', `Department "${dept.name}" created by Admin.`);
  };

  const updateDepartment = (id: string, updatedFields: Partial<Department>) => {
    setDepartments(prev => prev.map(d => d.id === id ? { ...d, ...updatedFields } as Department : d));
    logActivity('info', `Department "${id}" settings updated.`);
  };

  const addCategory = (cat: Omit<Category, 'id'>) => {
    const newCat: Category = { ...cat, id: 'c-' + generateId() };
    setCategories(prev => [...prev, newCat]);
    logActivity('info', `Asset category "${cat.name}" added.`);
  };

  const updateEmployeeRole = (id: string, role: 'Admin' | 'Asset Manager' | 'Employee') => {
    setEmployees(prev =>
      prev.map(emp => (emp.id === id ? { ...emp, role } : emp))
    );
    const empName = employees.find(e => e.id === id)?.name || 'Employee';
    logActivity('warning', `Role for ${empName} updated to ${role}.`);
  };

  const addEmployee = (emp: Omit<Employee, 'id'>) => {
    const newEmp: Employee = { ...emp, id: 'e-' + generateId() };
    setEmployees(prev => [...prev, newEmp]);
    logActivity('info', `New employee registered: ${emp.name} (${emp.email}).`);
  };

  const addAsset = (asset: Omit<Asset, 'id' | 'tag' | 'status' | 'currentHolderId' | 'expectedReturnDate'>) => {
    const count = assets.length + 1;
    const tag = `AF-${String(count).padStart(4, '0')}`;
    const newAsset: Asset = {
      ...asset,
      id: 'a-' + generateId(),
      tag,
      status: 'Available',
      currentHolderId: null,
      expectedReturnDate: null
    };
    setAssets(prev => [...prev, newAsset]);
    logActivity('success', `Asset registered: ${asset.name} (${tag}).`);
    return tag;
  };

  const updateAsset = (id: string, updatedFields: Partial<Asset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updatedFields } as Asset : a));
  };

  const allocateAsset = (assetId: string, employeeId: string, expectedReturnDate: string | null) => {
    const targetAsset = assets.find(a => a.id === assetId);
    const targetEmployee = employees.find(e => e.id === employeeId);
    
    if (!targetAsset || !targetEmployee) return false;
    
    if (targetAsset.status === 'Allocated' && targetAsset.currentHolderId !== null) {
      return false;
    }

    setAssets(prev =>
      prev.map(a =>
        a.id === assetId
          ? {
              ...a,
              status: 'Allocated',
              currentHolderId: employeeId,
              expectedReturnDate
            }
          : a
      )
    );
    logActivity(
      'success',
      `Asset ${targetAsset.tag} (${targetAsset.name}) allocated to ${targetEmployee.name} (${targetEmployee.department})`
    );
    return true;
  };

  const transferAsset = (assetId: string, targetEmployeeId: string, reason: string) => {
    const targetAsset = assets.find(a => a.id === assetId);
    const targetEmployee = employees.find(e => e.id === targetEmployeeId);
    if (!targetAsset || !targetEmployee) return;

    const previousHolderName = employees.find(e => e.id === targetAsset.currentHolderId)?.name || 'Unknown';

    setAssets(prev =>
      prev.map(a =>
        a.id === assetId
          ? {
              ...a,
              status: 'Allocated',
              currentHolderId: targetEmployeeId,
              expectedReturnDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            }
          : a
      )
    );
    logActivity(
      'success',
      `Transfer completed: ${targetAsset.tag} moved from ${previousHolderName} to ${targetEmployee.name}. Reason: ${reason}`
    );
  };

  const returnAsset = (assetId: string, conditionNotes: string, newCondition: 'New' | 'Good' | 'Fair' | 'Poor') => {
    const targetAsset = assets.find(a => a.id === assetId);
    if (!targetAsset) return;

    const previousHolderName = employees.find(e => e.id === targetAsset.currentHolderId)?.name || 'Unknown';

    setAssets(prev =>
      prev.map(a =>
        a.id === assetId
          ? {
              ...a,
              status: 'Available',
              currentHolderId: null,
              expectedReturnDate: null,
              condition: newCondition,
              description: a.description ? `${a.description} | Check-in notes: ${conditionNotes}` : `Check-in notes: ${conditionNotes}`
            }
          : a
      )
    );
    logActivity(
      'info',
      `Asset ${targetAsset.tag} returned by ${previousHolderName}. Condition marked: ${newCondition}.`
    );
  };

  const addBooking = (booking: Omit<Booking, 'id' | 'status'>) => {
    const targetAsset = assets.find(a => a.id === booking.assetId);
    const requester = employees.find(e => e.id === booking.requesterId);
    if (!targetAsset || !requester) {
      return { success: false, error: 'Resource or Employee not found.' };
    }

    const start = new Date(booking.startTime).getTime();
    const end = new Date(booking.endTime).getTime();

    const hasOverlap = bookings.some(b => {
      if (b.assetId !== booking.assetId || b.status === 'Cancelled') return false;
      const bStart = new Date(b.startTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      return (start < bEnd && end > bStart);
    });

    if (hasOverlap) {
      return { success: false, error: 'Time slot conflict: resource is already booked.' };
    }

    const newBooking: Booking = {
      ...booking,
      id: 'b-' + generateId(),
      status: 'Upcoming'
    };

    setBookings(prev => [...prev, newBooking]);
    logActivity(
      'success',
      `Resource booked: ${targetAsset.name} confirmed for ${requester.name} from ${booking.startTime.split('T')[1]} to ${booking.endTime.split('T')[1]}`
    );
    return { success: true };
  };

  const cancelBooking = (id: string) => {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;

    setBookings(prev =>
      prev.map(b => (b.id === id ? { ...b, status: 'Cancelled' } : b))
    );

    const targetAsset = assets.find(a => a.id === booking.assetId);
    logActivity('warning', `Booking for resource "${targetAsset?.name || 'Asset'}" has been cancelled.`);
  };

  const addMaintenanceRequest = (req: Omit<MaintenanceRequest, 'id' | 'status' | 'dateRaised'>) => {
    const newReq: MaintenanceRequest = {
      ...req,
      id: 'm-' + generateId(),
      status: 'Pending',
      dateRaised: new Date().toISOString()
    };
    setMaintenanceRequests(prev => [...prev, newReq]);

    const targetAsset = assets.find(a => a.id === req.assetId);
    logActivity(
      'warning',
      `Maintenance requested for ${targetAsset?.tag || 'Asset'}: "${req.issue}"`
    );
  };

  const updateMaintenanceStatus = (
    id: string,
    status: MaintenanceRequest['status'],
    notes?: string,
    technician?: string
  ) => {
    setMaintenanceRequests(prev =>
      prev.map(m =>
        m.id === id
          ? {
              ...m,
              status,
              ...(notes ? { notes } : {}),
              ...(technician ? { technician } : {})
            }
          : m
      )
    );

    const req = maintenanceRequests.find(m => m.id === id);
    if (!req) return;

    const targetAsset = assets.find(a => a.id === req.assetId);
    if (!targetAsset) return;

    if (status === 'Approved' || status === 'Technician Assigned' || status === 'In Progress') {
      setAssets(prev =>
        prev.map(a => (a.id === req.assetId ? { ...a, status: 'Under Maintenance' } : a))
      );
      logActivity(
        'warning',
        `Asset ${targetAsset.tag} is now Under Maintenance (Request Status: ${status}).`
      );
    }

    if (status === 'Resolved') {
      setAssets(prev =>
        prev.map(a => (a.id === req.assetId ? { ...a, status: 'Available' } : a))
      );
      logActivity(
        'success',
        `Maintenance resolved for Asset ${targetAsset.tag}. Asset is now Available.`
      );
    }
  };

  const addAuditCycle = (cycle: Omit<AuditCycle, 'id' | 'status' | 'checklist'>) => {
    const scopeDept = cycle.scopeDepartment;
    const scopeLoc = cycle.scopeLocation;
    
    const matchingAssets = assets.filter(a => {
      const holder = employees.find(e => e.id === a.currentHolderId);
      const matchesDept = scopeDept === 'All' || (holder && holder.department === scopeDept);
      const matchesLoc = scopeLoc === 'All' || a.location.toLowerCase().includes(scopeLoc.toLowerCase());
      return matchesDept && matchesLoc;
    });

    const checklist: AuditChecklistItem[] = matchingAssets.map(a => ({
      assetId: a.id,
      expectedLocation: a.location,
      verification: 'Unchecked'
    }));

    const newCycle: AuditCycle = {
      ...cycle,
      id: 'aud-' + generateId(),
      status: 'Active',
      checklist
    };

    setAuditCycles(prev => [newCycle, ...prev]);
    logActivity('info', `New audit cycle created: "${cycle.name}" with ${checklist.length} assets.`);
  };

  const updateAuditChecklist = (cycleId: string, assetId: string, verification: AuditChecklistItem['verification']) => {
    setAuditCycles(prev =>
      prev.map(c =>
        c.id === cycleId
          ? {
              ...c,
              checklist: c.checklist.map(item =>
                item.assetId === assetId ? { ...item, verification } : item
              )
            }
          : c
      )
    );
  };

  const closeAuditCycle = (cycleId: string) => {
    const cycle = auditCycles.find(c => c.id === cycleId);
    if (!cycle) return;

    setAuditCycles(prev =>
      prev.map(c => (c.id === cycleId ? { ...c, status: 'Closed' } : c))
    );

    let lostCount = 0;
    let damagedCount = 0;

    cycle.checklist.forEach(item => {
      if (item.verification === 'Missing') {
        lostCount++;
        setAssets(prev =>
          prev.map(a => (a.id === item.assetId ? { ...a, status: 'Lost' } : a))
        );
      } else if (item.verification === 'Damaged') {
        damagedCount++;
        setAssets(prev =>
          prev.map(a => (a.id === item.assetId ? { ...a, condition: 'Poor' } : a))
        );
        addMaintenanceRequest({
          assetId: item.assetId,
          issue: `Flagged as Damaged during audit cycle: ${cycle.name}`,
          priority: 'High'
        });
      }
    });

    logActivity(
      'warning',
      `Audit cycle "${cycle.name}" closed. Results: ${lostCount} assets marked Lost, ${damagedCount} marked Damaged & sent to maintenance.`
    );
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
        
        logActivity
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
