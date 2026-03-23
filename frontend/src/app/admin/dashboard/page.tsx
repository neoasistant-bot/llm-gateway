'use client';

import { StatsCard } from '@/components/StatsCard';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface DashboardStats {
  activeClients?: number;
  totalMethods?: number;
  executionsToday?: number;
  totalTokensToday?: number;
}

interface RecentActivity {
  id: string;
  timestamp: string;
  action: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({});
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        const [auditData, usageData] = await Promise.all([
          api.get<{ data: any[] }>('/audit/logs?limit=5'),
          api.get<any>(`/tracking/usage?dateFrom=${today}&dateTo=${today}`),
        ]);

        setActivity(auditData.data || []);

        const clientsData = await api.get<{ total: number }>('/users?limit=1&role=CLIENT');
        const methodsData = await api.get<{ total: number }>('/methods?limit=1');

        setStats({
          activeClients: clientsData.total,
          totalMethods: methodsData.total,
          executionsToday: usageData.totalRequests || 0,
          totalTokensToday: usageData.totalTokens || 0,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <main className="pt-24 p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <StatsCard
              title="Active Clients"
              value={stats.activeClients || 0}
              icon="👥"
              color="blue"
            />
            <StatsCard
              title="Total Methods"
              value={stats.totalMethods || 0}
              icon="⚙️"
              color="green"
            />
            <StatsCard
              title="Executions Today"
              value={stats.executionsToday || 0}
              icon="▶️"
              color="purple"
            />
            <StatsCard
              title="Tokens Today"
              value={stats.totalTokensToday || 0}
              icon="🔤"
              color="orange"
            />
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {activity.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-4 text-center text-gray-500">
                        No recent activity
                      </td>
                    </tr>
                  ) : (
                    activity.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {item.action}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(item.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
