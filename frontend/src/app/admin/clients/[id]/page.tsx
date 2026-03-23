'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  email: string;
  isActive: boolean;
  rateLimitRpm?: number;
  rateLimitTpd?: number;
}

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
  status: string;
  createdAt: string;
}

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<User | null>(null);
  const [assignedMethods, setAssignedMethods] = useState<Method[]>([]);
  const [availableMethods, setAvailableMethods] = useState<Method[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientData, methodsData, executionsData] = await Promise.all([
          api.get<User>(`/users/${clientId}`),
          api.get<{ data: Method[] }>('/methods'),
          api.get<{ data: Execution[] }>(`/executions?limit=10&userId=${clientId}`),
        ]);

        setClient(clientData);
        setAvailableMethods(methodsData.data || []);
        setExecutions(executionsData.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load client');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clientId]);

  const handleAssignMethod = async (methodId: string) => {
    try {
      await api.post(`/methods/${clientId}/methods`, { methodId });
      const method = availableMethods.find((m) => m.id === methodId);
      if (method) {
        setAssignedMethods((prev) => [...prev, method]);
        setAvailableMethods((prev) => prev.filter((m) => m.id !== methodId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign method');
    }
  };

  const handleUnassignMethod = async (methodId: string) => {
    try {
      await api.delete(`/methods/${clientId}/methods/${methodId}`);
      const method = assignedMethods.find((m) => m.id === methodId);
      if (method) {
        setAvailableMethods((prev) => [...prev, method]);
        setAssignedMethods((prev) => prev.filter((m) => m.id !== methodId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unassign method');
    }
  };

  if (loading) {
    return (
      <main className="pt-24 p-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main className="pt-24 p-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Client not found</p>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-24 p-8">
      <Link
        href="/admin/clients"
        className="text-blue-600 hover:text-blue-700 text-sm mb-6 inline-block"
      >
        ← Back to Clients
      </Link>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{client.email}</h1>
          <div className="space-y-2">
            <p>
              <span className="font-medium text-gray-700">Status:</span>{' '}
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  client.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {client.isActive ? 'Active' : 'Inactive'}
              </span>
            </p>
            {client.rateLimitRpm && (
              <p>
                <span className="font-medium text-gray-700">Rate Limit (RPM):</span> {client.rateLimitRpm}
              </p>
            )}
            {client.rateLimitTpd && (
              <p>
                <span className="font-medium text-gray-700">Rate Limit (TPD):</span> {client.rateLimitTpd}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Assigned Methods</h2>
          <div className="space-y-2">
            {assignedMethods.length === 0 ? (
              <p className="text-gray-500">No methods assigned</p>
            ) : (
              assignedMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{method.name}</p>
                    <p className="text-sm text-gray-600">
                      {method.provider} / {method.model}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnassignMethod(method.id)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Available Methods</h2>
          <div className="space-y-2">
            {availableMethods.length === 0 ? (
              <p className="text-gray-500">All methods assigned</p>
            ) : (
              availableMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{method.name}</p>
                    <p className="text-sm text-gray-600">
                      {method.provider} / {method.model}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAssignMethod(method.id)}
                    className="text-green-600 hover:text-green-700 text-sm font-medium"
                  >
                    Assign
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {executions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Executions</h2>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {executions.map((execution) => (
                  <tr key={execution.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {execution.method?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          execution.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : execution.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {execution.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(execution.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
