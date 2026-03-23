'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Method {
  id: string;
  name: string;
  provider: string;
  model: string;
}

interface Execution {
  id: string;
  methodId: string;
  method?: { name: string };
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

interface UsageData {
  totalRequests: number;
  totalTokens: number;
}

export default function Dashboard() {
  const [methods, setMethods] = useState<Method[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [methodsData, executionsData, usageData] = await Promise.all([
          api.get<{ data: Method[] }>('/me/methods'),
          api.get<{ data: Execution[] }>('/executions?limit=5'),
          api.get<UsageData>(`/tracking/usage?dateFrom=${today}&dateTo=${today}`),
        ]);

        setMethods(methodsData.data || []);
        setExecutions(executionsData.data || []);
        setUsage(usageData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <ProtectedRoute requiredRole="CLIENT">
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="ml-64 flex-1">
          <Header />
          <main className="pt-24 p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <StatsCard
                    title="Available Methods"
                    value={methods.length}
                    icon="⚙️"
                    color="blue"
                  />
                  <StatsCard
                    title="Total Executions"
                    value={usage?.totalRequests || 0}
                    icon="▶️"
                    color="green"
                  />
                  <StatsCard
                    title="Tokens Used Today"
                    value={usage?.totalTokens || 0}
                    icon="🔤"
                    color="purple"
                  />
                </div>

                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">Recent Executions</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                            Method
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                            Created
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {executions.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                              No executions yet
                            </td>
                          </tr>
                        ) : (
                          executions.map((execution) => (
                            <tr key={execution.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                {execution.method?.name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4">
                                <StatusBadge status={execution.status} />
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {new Date(execution.createdAt).toLocaleString()}
                              </td>
                              <td className="px-6 py-4">
                                <Link
                                  href={`/executions/${execution.id}`}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  View
                                </Link>
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
        </div>
      </div>
    </ProtectedRoute>
  );
}
