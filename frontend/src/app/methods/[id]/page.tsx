'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { JsonEditor } from '@/components/JsonEditor';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Method {
  id: string;
  name: string;
  description?: string;
  inputType: 'TEXT' | 'JSON_SCHEMA';
  provider: string;
  model: string;
}

export default function MethodDetailPage() {
  const params = useParams();
  const methodId = params.id as string;

  const [method, setMethod] = useState<Method | null>(null);
  const [outputSchema, setOutputSchema] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchMethod = async () => {
      try {
        const data = await api.get<Method>(`/methods/${methodId}`);
        setMethod(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load method');
      } finally {
        setLoading(false);
      }
    };

    fetchMethod();
  }, [methodId]);

  const handleSaveSchema = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await api.patch(`/me/methods/${methodId}/schema`, { outputSchema });
      setSuccess('Schema saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schema');
    } finally {
      setSaving(false);
    }
  };

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
            ) : !method ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Method not found</p>
              </div>
            ) : (
              <>
                <Link
                  href="/methods"
                  className="text-blue-600 hover:text-blue-700 text-sm mb-6 inline-block"
                >
                  ← Back to Methods
                </Link>

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{method.name}</h1>
                  {method.description && (
                    <p className="text-gray-600 mb-4">{method.description}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Provider</p>
                      <p className="font-semibold text-gray-900">{method.provider}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Model</p>
                      <p className="font-semibold text-gray-900">{method.model}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Input Type</p>
                      <p className="font-semibold text-gray-900">{method.inputType}</p>
                    </div>
                  </div>

                  <Link
                    href={`/methods/${methodId}/playground`}
                    className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Open Playground
                  </Link>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Output Schema Configuration</h2>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                      {success}
                    </div>
                  )}

                  <JsonEditor value={outputSchema} onChange={setOutputSchema} height="300px" />

                  <button
                    onClick={handleSaveSchema}
                    disabled={saving}
                    className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    {saving ? 'Saving...' : 'Save Schema'}
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
