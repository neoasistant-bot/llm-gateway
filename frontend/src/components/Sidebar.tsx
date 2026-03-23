'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { usePathname } from 'next/navigation';

interface NavLink {
  label: string;
  href: string;
  icon: string;
}

export function Sidebar() {
  const { isAdmin, isClient } = useAuth();
  const pathname = usePathname();

  const clientLinks: NavLink[] = [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Methods', href: '/methods', icon: '⚙️' },
    { label: 'Executions', href: '/executions', icon: '▶️' },
    { label: 'Usage', href: '/usage', icon: '📈' },
  ];

  const adminLinks: NavLink[] = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { label: 'Methods', href: '/admin/methods', icon: '⚙️' },
    { label: 'Clients', href: '/admin/clients', icon: '👥' },
    { label: 'Executions', href: '/admin/executions', icon: '▶️' },
    { label: 'Audit Logs', href: '/admin/audit', icon: '📝' },
  ];

  const links = isAdmin ? adminLinks : clientLinks;

  return (
    <div className="w-64 bg-gray-900 text-white h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-bold">LLM Gateway</h1>
      </div>
      <nav className="flex-1 overflow-y-auto">
        <ul className="space-y-2 p-4">
          {links.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
