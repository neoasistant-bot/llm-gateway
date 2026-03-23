'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Pagination } from '@/components/Pagination';

interface Method {
  id: string;
  name: string;
  provider: string;
  model: string;
  isPublic: boolean;
  isActive: boolean;
}

interface PaginatedResponse {
  data: Method[];
  total: number;
  page: number;
  limit: number;
}

export default function MethodsPage() {
  const [methods, setMethods] = useState<Method[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const data = await api.get<PaginatedResponse>(`/methods?page=${page}&limit=${limit}`);
        setMethods(data.data || []);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load methods');
      } finally {
        setLoading(false);
      }
    };

    fetchMethods();
  }, [page, limit]);

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      OPENAI: 'bg-green-100 text-green-800',
      ANTHROPIC: 'bg-orange-100 text-orange-800',
      GOOGLE: 'bg-blue-100 text-blue-800',
    };
    return colors[provider] || 'bg-gray-100 text-gray-800';
  };

  return (
    <main className="pt-24 p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Methods</h1>
        <Link
          href="/admin/methods/new"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Create Method
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading methods...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Model
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Public
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {methods.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        No methods found
                      </td>
                    </tr>
                  ) : (
                    methods.map((method) => (
                      <tr key={method.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {method.name}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getProviderColor(
                              method.provider
                            )}`}
                          >
                            {method.provider}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {method.model}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              method.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {method.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              method.isPublic
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {method.isPublic ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm space-x-2">
                          <Link
                            href={`/admin/methods/${method.id}`}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/admin/methods/${method.id}/test`}
                            className="text-green-600 hover:text-green-700"
                          >
                            Test
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
  );
}
