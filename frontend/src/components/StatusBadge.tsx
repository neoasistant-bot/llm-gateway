interface StatusBadgeProps {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colors = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[status]}`}>
      {status}
    </span>
  );
}
