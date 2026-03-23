'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Method {
  id: string;
  name: string;
  description?: string;
  inputType: 'TEXT' | 'JSON_SCHEMA';
  provider: 'OPENAI' | 'ANTHROPIC' | 'GOOGLE';
  model: string;
  isActive: boolean;
}

export default function MethodsPage() {
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const data = await api.get<{ data: Method[] }>('/methods');
        setMethods(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load methods');
      } finally {
        setLoading(false);
      }
    };

    fetchMethods();
  }, []);

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      OPENAI: 'bg-green-100 text-green-800',
      ANTHROPIC: 'bg-orange-100 text-orange-800',
      GOOGLE: 'bg-blue-100 text-blue-800',
    };
    return colors[provider] || 'bg-gray-100 text-gray-800';
  };

  return (
    <ProtectedRoute requiredRole="CLIENT">
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="ml-64 flex-1">
          <Header />
          <main className="pt-24 p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Available Methods</h1>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading methods...</p>
              </div>
            ) : methods.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No methods available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {methods.map((method) => (
                  <Link key={method.id} href={`/methods/${method.id}`}>
                    <div className="bg-white rounded-lg shadow hover:shadow-lg transition h-full cursor-pointer">
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {method.name}
                        </h3>
                        {method.description && (
                          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                            {method.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getProviderColor(method.provider)}`}>
                            {method.provider}
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {method.inputType}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm">
                          Model: <span className="font-medium">{method.model}</span>
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
