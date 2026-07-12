import React from 'react';

interface BadgeProps {
  status: string;
}

export const Badge: React.FC<BadgeProps> = ({ status }) => {
  const getBadgeClass = (s: string) => {
    const cleanStatus = s.trim().toLowerCase();
    switch (cleanStatus) {
      case 'available':
      case 'approved':
      case 'verified':
      case 'new':
      case 'resolved':
      case 'active':
        return 'badge-success';
      case 'pending':
      case 'ongoing':
      case 'technician assigned':
      case 'in progress':
      case 'requested':
        return 'badge-warning';
      case 'allocated':
      case 'reserved':
      case 'upcoming':
      case 'good':
        return 'badge-info';
      case 'lost':
      case 'retired':
      case 'damaged':
      case 'cancelled':
      case 'missing':
      case 'poor':
      case 'fair':
        return 'badge-danger';
      case 'inactive':
      case 'closed':
      case 'disposed':
      default:
        return 'badge-muted';
    }
  };

  return (
    <span className={`badge ${getBadgeClass(status)}`}>
      {status}
    </span>
  );
};
