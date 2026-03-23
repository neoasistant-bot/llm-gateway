'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { StatsCard } from '@/components/StatsCard';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface UsageStats {
  totalRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalTokens: number;
  byMethod?: Array<{
    methodId: string;
    methodName: string;
    requests: number;
    tokens: number;
  }>;
  byDay?: Array<{
    date: string;
    requests: number;
    tokens: number;
  }>;
}

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        const from = dateFrom || thirtyDaysAgo.toISOString().split('T')[0];
        const to = dateTo || today.toISOString().split('T')[0];

        const data = await api.get<UsageStats>(
          `/tracking/usage?dateFrom=${from}&dateTo=${to}&groupBy=day`
        );
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load usage stats');
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [dateFrom, dateTo]);

  return (
    <ProtectedRoute requiredRole="CLIENT">
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="ml-64 flex-1">
          <Header />
          <main className="pt-24 p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Usage Statistics</h1>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            <div className="mb-6 flex gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading usage statistics...</p>
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <StatsCard
                    title="Total Requests"
                    value={stats.totalRequests}
                    icon="▶️"
                    color="blue"
                  />
                  <StatsCard
                    title="Input Tokens"
                    value={stats.totalTokensInput}
                    icon="📥"
                    color="green"
                  />
                  <StatsCard
                    title="Output Tokens"
                    value={stats.totalTokensOutput}
                    icon="📤"
                    color="purple"
                  />
                  <StatsCard
                    title="Total Tokens"
                    value={stats.totalTokens}
                    icon="🔤"
                    color="orange"
                  />
                </div>

                {stats.byMethod && stats.byMethod.length > 0 && (
                  <div className="bg-white rounded-lg shadow mb-8">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-xl font-bold text-gray-900">Usage by Method</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                              Method
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                              Requests
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                              Tokens
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {stats.byMethod.map((method) => (
                            <tr key={method.methodId} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                {method.methodName}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {method.requests}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {method.tokens}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {stats.byDay && stats.byDay.length > 0 && (
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-xl font-bold text-gray-900">Daily Usage</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                              Date
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                              Requests
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                              Tokens
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {stats.byDay.map((day) => (
                            <tr key={day.date} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                {new Date(day.date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {day.requests}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {day.tokens}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
