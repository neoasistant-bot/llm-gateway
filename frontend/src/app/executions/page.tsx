'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { StatusBadge } from '@/components/StatusBadge';
import { Pagination } from '@/components/Pagination';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Execution {
  id: string;
  methodId: string;
  method?: { name: string };
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  tokensInput?: number;
  tokensOutput?: number;
  latencyMs?: number;
  createdAt: string;
}

interface PaginatedResponse {
  data: Execution[];
  total: number;
  page: number;
  limit: number;
}

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchExecutions = async () => {
      try {
        const data = await api.get<PaginatedResponse>(`/executions?page=${page}&limit=${limit}`);
        setExecutions(data.data || []);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load executions');
      } finally {
        setLoading(false);
      }
    };

    fetchExecutions();
  }, [page, limit]);

  return (
    <ProtectedRoute requiredRole="CLIENT">
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="ml-64 flex-1">
          <Header />
          <main className="pt-24 p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Execution History</h1>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">Loading executions...</p>
                </div>
              ) : (
                <>
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
                            Tokens
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                            Latency
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
                            <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                              No executions found
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
                                {execution.tokensInput && execution.tokensOutput
                                  ? `${execution.tokensInput} + ${execution.tokensOutput}`
                                  : '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {execution.latencyMs ? `${execution.latencyMs}ms` : '-'}
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
                  <div className="px-6 py-4 border-t border-gray-200">
                    <Pagination
                      page={page}
                      total={total}
                      limit={limit}
                      onPageChange={setPage}
                    />
                  </div>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
