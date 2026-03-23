'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 fixed top-0 right-0 left-64 h-16 flex items-center justify-between px-6">
      <div className="flex-1" />
      <div className="flex items-center space-x-4">
        <span className="text-gray-700">{user?.email}</span>
        <span className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
          {user?.role}
        </span>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
