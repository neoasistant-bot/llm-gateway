'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { StatusBadge } from '@/components/StatusBadge';
import { JsonEditor } from '@/components/JsonEditor';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Execution {
  id: string;
  userId: string;
  methodId: string;
  method?: { id: string; name: string; provider: string; model: string };
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  input: any;
  output?: any;
  promptSent?: string;
  provider?: string;
  model?: string;
  tokensInput?: number;
  tokensOutput?: number;
  latencyMs?: number;
  error?: any;
  createdAt: string;
  completedAt?: string;
}

export default function ExecutionDetailPage() {
  const params = useParams();
  const executionId = params.id as string;

  const [execution, setExecution] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchExecution = async () => {
      try {
        const data = await api.get<Execution>(`/executions/${executionId}`);
        setExecution(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load execution');
      } finally {
        setLoading(false);
      }
    };

    fetchExecution();
  }, [executionId]);

  return (
    <ProtectedRoute requiredRole="CLIENT">
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="ml-64 flex-1">
          <Header />
          <main className="pt-24 p-8">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading...</p>
              </div>
            ) : !execution ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Execution not found</p>
              </div>
            ) : (
              <>
                <Link
                  href="/executions"
                  className="text-blue-600 hover:text-blue-700 text-sm mb-6 inline-block"
                >
                  ← Back to Executions
                </Link>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                    {error}
                  </div>
                )}

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {execution.method?.name || 'Unknown Method'}
                      </h1>
                      <p className="text-gray-600">Execution ID: {execution.id}</p>
                    </div>
                    <StatusBadge status={execution.status} />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Provider</p>
                      <p className="font-semibold text-gray-900">
                        {execution.method?.provider || execution.provider || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Model</p>
                      <p className="font-semibold text-gray-900">
                        {execution.method?.model || execution.model || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Created At</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(execution.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {execution.completedAt && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Completed At</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(execution.completedAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600 mb-2">Input Tokens</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {execution.tokensInput || '-'}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600 mb-2">Output Tokens</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {execution.tokensOutput || '-'}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600 mb-2">Latency</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {execution.latencyMs ? `${execution.latencyMs}ms` : '-'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Input</h2>
                    <JsonEditor value={execution.input} onChange={() => {}} readOnly={true} height="300px" />
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Output</h2>
                    {execution.output ? (
                      <JsonEditor value={execution.output} onChange={() => {}} readOnly={true} height="300px" />
                    ) : (
                      <div className="text-gray-500 py-12 text-center">No output yet</div>
                    )}
                  </div>
                </div>

                {execution.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 mt-6">
                    <h2 className="text-xl font-bold text-red-900 mb-4">Error</h2>
                    <JsonEditor value={execution.error} onChange={() => {}} readOnly={true} height="200px" />
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
