'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp, Booking, Asset } from '@/context/AppContext';
import { Badge } from '@/components/Badge';

function ResourceBookingContent() {
  const searchParams = useSearchParams();
  const { assets, employees, bookings, addBooking, cancelBooking } = useApp();

  // Selected resource and date
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [bookingDate, setBookingDate] = useState('2026-07-12');

  // Form states
  const [startTime, setStartTime] = useState('11:00');
  const [endTime, setEndTime] = useState('12:00');
  const [requesterId, setRequesterId] = useState('');

  // Conflict Indicator state
  const [overlapDetected, setOverlapDetected] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Seed default selections
  useEffect(() => {
    const bookable = assets.find(a => a.isBookable);
    if (bookable) {
      setSelectedAssetId(bookable.id);
    }
    const emp = employees.find(e => e.status === 'Active');
    if (emp) {
      setRequesterId(emp.id);
    }
  }, [assets, employees]);

  // Handle deep-linking from Dashboard
  useEffect(() => {
    if (searchParams.get('openBook') === 'true') {
      const bookable = assets.find(a => a.isBookable);
      if (bookable) {
        setSelectedAssetId(bookable.id);
      }
    }
  }, [searchParams, assets]);

  // Compute selected asset & active bookings on this date
  const activeAsset = assets.find(a => a.id === selectedAssetId);
  const activeDateBookings = bookings.filter(b => {
    if (b.assetId !== selectedAssetId || b.status === 'Cancelled') return false;
    return b.startTime.startsWith(bookingDate);
  });

  // Check overlap for current selection reactively
  useEffect(() => {
    if (!selectedAssetId || !bookingDate || !startTime || !endTime) {
      setOverlapDetected(false);
      return;
    }

    const startDateTime = new Date(`${bookingDate}T${startTime}:00`).getTime();
    const endDateTime = new Date(`${bookingDate}T${endTime}:00`).getTime();

    if (startDateTime >= endDateTime) {
      setOverlapDetected(false);
      return;
    }

    const overlap = activeDateBookings.some(b => {
      const bStart = new Date(b.startTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      return (startDateTime < bEnd && endDateTime > bStart);
    });

    setOverlapDetected(overlap);
  }, [selectedAssetId, bookingDate, startTime, endTime, activeDateBookings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !requesterId || !bookingDate || !startTime || !endTime) return;

    const startISO = `${bookingDate}T${startTime}:00`;
    const endISO = `${bookingDate}T${endTime}:00`;

    if (new Date(startISO).getTime() >= new Date(endISO).getTime()) {
      setErrorMessage('Start time must be before end time.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const result = await addBooking({
      assetId: selectedAssetId,
      startTime: startISO,
      endTime: endISO,
      requesterId
    });

    if (result.success) {
      setSuccessMessage('Booking confirmed successfully!');
      setStartTime('11:00');
      setEndTime('12:00');
      setTimeout(() => setSuccessMessage(''), 4000);
    } else {
      setErrorMessage(result.error || 'Conflict detected.');
      setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  const getEmployeeName = (id: string) => {
    return employees.find(e => e.id === id)?.name || 'Unknown';
  };

  // Generate hourly schedule rows for calendar timeline (9 AM to 5 PM)
  const hours = [
    { label: '9:00 AM', value: 9 },
    { label: '10:00 AM', value: 10 },
    { label: '11:00 AM', value: 11 },
    { label: '12:00 PM', value: 12 },
    { label: '1:00 PM', value: 13 },
    { label: '2:00 PM', value: 14 },
    { label: '3:00 PM', value: 15 },
    { label: '4:00 PM', value: 16 },
    { label: '5:00 PM', value: 17 }
  ];

  const getBookingForHour = (hourVal: number) => {
    return activeDateBookings.find(b => {
      const bStartHour = new Date(b.startTime).getHours();
      const bEndHour = new Date(b.endTime).getHours();
      return hourVal >= bStartHour && hourVal < bEndHour;
    });
  };

  const isInputOccupyingHour = (hourVal: number) => {
    const inputStartHour = parseInt(startTime.split(':')[0]);
    const inputEndHour = parseInt(endTime.split(':')[0]);
    return hourVal >= inputStartHour && hourVal < inputEndHour;
  };

  return (
    <div className="booking-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Resource Booking</h1>
          <p className="page-subtitle">Schedule time slots for shared resources and verify overlap conflicts.</p>
        </div>
      </div>

      {successMessage && (
        <div className="alert-box alert-success animate-fade">
          <div className="alert-icon-chip">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="alert-box alert-danger animate-fade">
          <div className="alert-icon-chip">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Selector Panels */}
      <div className="glass-panel selection-panel row-layout">
        <div className="form-group inline-group">
          <label className="form-label">Resource</label>
          <select 
            className="form-control" 
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
          >
            {assets.filter(a => a.isBookable).map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.location})</option>
            ))}
          </select>
        </div>

        <div className="form-group inline-group">
          <label className="form-label">Date</label>
          <input 
            type="date" 
            className="form-control"
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
          />
        </div>
      </div>

      {/* Main Grid: Schedule vs Request Form */}
      <div className="grid-2 calendar-workspace">
        {/* Left Side: Schedule Strip (Hourly rows) */}
        <div className="glass-panel schedule-strip">
          <h3 className="section-title">Schedule Strip ({bookingDate})</h3>
          
          <div className="hours-timeline" style={{ marginTop: '16px' }}>
            {hours.map((hr) => {
              const activeBooking = getBookingForHour(hr.value);
              const isRequestedHour = isInputOccupyingHour(hr.value);
              
              return (
                <div key={hr.value} className="hour-row">
                  <div className="hour-time-label">{hr.label}</div>
                  
                  <div className="hour-block-container">
                    {activeBooking ? (
                      /* BOOKED BLOCK (Solid info-colored block) */
                      <div className="booked-block">
                        <span className="booked-desc">
                          Booked: {getEmployeeName(activeBooking.requesterId)} ({activeBooking.startTime.split('T')[1].substring(0,5)} - {activeBooking.endTime.split('T')[1].substring(0,5)})
                        </span>
                      </div>
                    ) : isRequestedHour ? (
                      /* REQUESTED BLOCK / LIVE PREVIEW */
                      <div className={`requested-block ${overlapDetected ? 'conflict-block' : ''}`}>
                        {overlapDetected ? (
                          <span className="requested-desc text-danger font-bold">
                            ⚠️ Conflict: Slot Unavailable
                          </span>
                        ) : (
                          <span className="requested-desc">
                            Preview Slot: {startTime} to {endTime}
                          </span>
                        )}
                      </div>
                    ) : (
                      /* EMPTY SPACE */
                      <div className="empty-time-slot"></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Request Booking Form */}
        <div className="flex-column gap-1.5">
          <div className="glass-panel">
            <h3 className="section-title">Create Booking Request</h3>
            
            {overlapDetected && (
              <div className="alert-box alert-danger animate-fade" style={{ marginTop: '12px', marginBottom: '12px' }}>
                <div className="alert-icon-chip">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <strong className="alert-headline" style={{ fontWeight: 600 }}>Overlap Collision Detected</strong>
                  <div style={{ fontSize: '13px', marginTop: '2px' }}>
                    Requested {startTime} to {endTime} overlaps with an existing booking. Conflict blocks save.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ marginTop: '12px' }}>
              <div className="form-group">
                <label className="form-label">Requester Employee</label>
                <select 
                  className="form-control"
                  value={requesterId}
                  onChange={(e) => setRequesterId(e.target.value)}
                  required
                >
                  {employees.filter(emp => emp.status === 'Active').map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <select 
                    className="form-control"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  >
                    <option value="09:00">09:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="12:00">12:00 PM</option>
                    <option value="13:00">01:00 PM</option>
                    <option value="14:00">02:00 PM</option>
                    <option value="15:00">03:00 PM</option>
                    <option value="16:00">04:00 PM</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <select 
                    className="form-control"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  >
                    <option value="10:00">10:00 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="12:00">12:00 PM</option>
                    <option value="13:00">01:00 PM</option>
                    <option value="14:00">02:00 PM</option>
                    <option value="15:00">03:00 PM</option>
                    <option value="16:00">04:00 PM</option>
                    <option value="17:00">05:00 PM</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '12px' }}
                disabled={overlapDetected}
              >
                Book Time-Slot
              </button>
            </form>
          </div>

          {/* Bookings List */}
          <div className="glass-panel">
            <h3 className="section-title">Log of Bookings ({activeAsset?.name})</h3>
            <div className="bookings-list" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bookings.filter(b => b.assetId === selectedAssetId).length === 0 ? (
                <div className="empty-state-container" style={{ border: 'none', padding: '24px' }}>
                  <div className="empty-state-icon">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="empty-state-message">No bookings found for this resource.</span>
                </div>
              ) : (
                bookings
                  .filter(b => b.assetId === selectedAssetId)
                  .map((b) => (
                    <div key={b.id} className="booking-row glass-card">
                      <div className="booking-info-row">
                        <span className="booking-time" style={{ fontSize: '13px' }}>{b.startTime.split('T')[0]} ({b.startTime.split('T')[1].substring(0,5)} - {b.endTime.split('T')[1].substring(0,5)})</span>
                        <Badge status={b.status} />
                      </div>
                      <div className="booking-requester-row">
                        <span className="booking-req-name">Requested by: {getEmployeeName(b.requesterId)}</span>
                        {b.status === 'Upcoming' && (
                          <button 
                            className="btn-cancel-link"
                            onClick={() => cancelBooking(b.id)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .booking-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-top: 8px; /* Extra top margin/padding to resolve clipping under fixed Topbar */
        }

        .row-layout {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          padding: 16px 24px;
        }

        .inline-group {
          margin-bottom: 0;
          flex: 1;
          min-width: 200px;
        }

        .hours-timeline {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .hour-row {
          display: flex;
          height: 38px;
          align-items: center;
        }

        .hour-time-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--text-muted);
          width: 76px;
          flex-shrink: 0;
        }

        .hour-block-container {
          flex: 1;
          height: 100%;
          border-bottom: 1px dashed var(--border-subtle);
          display: flex;
          align-items: center;
        }

        .empty-time-slot {
          width: 100%;
          height: 100%;
        }

        .booked-block {
          background: var(--status-info);
          border-radius: 6px;
          width: 100%;
          height: 90%;
          display: flex;
          align-items: center;
          padding: 0 16px;
        }

        .booked-desc {
          font-size: 13px;
          color: #ffffff;
          font-weight: 500;
        }

        .requested-block {
          background: rgba(59, 130, 246, 0.05);
          border: 1.5px dashed var(--accent);
          border-radius: 6px;
          width: 100%;
          height: 90%;
          display: flex;
          align-items: center;
          padding: 0 16px;
          animation: borderPulse 1.5s infinite alternate;
        }

        .requested-desc {
          font-size: 13px;
          color: var(--accent);
          font-weight: 600;
        }

        .conflict-block {
          background: var(--status-danger-bg) !important;
          border-color: var(--status-danger) !important;
          animation: borderPulseRed 1.5s infinite alternate !important;
        }

        .booking-row {
          padding: 12px 16px;
        }

        .booking-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .booking-time {
          font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 600;
        }

        .booking-requester-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 6px;
          font-size: 12px;
        }

        .booking-req-name {
          color: var(--text-secondary);
        }

        .btn-cancel-link {
          background: none;
          border: none;
          color: var(--status-danger);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .btn-cancel-link:hover {
          color: #f87171;
          text-decoration: underline;
        }

        .flex-column {
          display: flex;
          flex-direction: column;
        }

        .gap-1.5 {
          gap: 24px;
        }

        .font-bold {
          font-weight: 700;
        }

        @keyframes borderPulse {
          from { border-color: rgba(59, 130, 246, 0.3); box-shadow: 0 0 5px rgba(59, 130, 246, 0.05); }
          to { border-color: var(--accent); box-shadow: 0 0 10px rgba(59, 130, 246, 0.15); }
        }

        @keyframes borderPulseRed {
          from { border-color: rgba(239, 68, 68, 0.3); box-shadow: 0 0 5px rgba(239, 68, 68, 0.05); }
          to { border-color: var(--status-danger); box-shadow: 0 0 10px rgba(239, 68, 68, 0.15); }
        }

        .animate-fade {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

export default function ResourceBookingPage() {
  return (
    <Suspense fallback={<div>Loading resource bookings...</div>}>
      <ResourceBookingContent />
    </Suspense>
  );
}
