'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { JsonEditor } from '@/components/JsonEditor';

interface Method {
  id: string;
  name: string;
  description?: string;
  provider: string;
  model: string;
  inputType: string;
  promptTemplate: string;
  isPublic: boolean;
  config?: any;
}

export default function EditMethodPage() {
  const params = useParams();
  const methodId = params.id as string;
  const router = useRouter();

  const [formData, setFormData] = useState<Method | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMethod = async () => {
      try {
        const data = await api.get<Method>(`/methods/${methodId}`);
        setFormData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load method');
      } finally {
        setLoading(false);
      }
    };

    fetchMethod();
  }, [methodId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!formData) return;
    const { name, value, type } = e.target as any;
    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    try {
      setSaving(true);
      setError('');
      await api.patch(`/methods/${methodId}`, formData);
      router.push('/admin/methods');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save method');
    } finally {
      setSaving(false);
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

  if (!formData) {
    return (
      <main className="pt-24 p-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Method not found</p>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-24 p-8">
      <Link
        href="/admin/methods"
        className="text-blue-600 hover:text-blue-700 text-sm mb-6 inline-block"
      >
        ← Back to Methods
      </Link>

      <div className="bg-white rounded-lg shadow p-8 max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Edit Method</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Provider *</label>
              <select
                name="provider"
                value={formData.provider}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="OPENAI">OpenAI</option>
                <option value="ANTHROPIC">Anthropic</option>
                <option value="GOOGLE">Google</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Model *</label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Input Type *</label>
              <select
                name="inputType"
                value={formData.inputType}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="TEXT">Text</option>
                <option value="JSON_SCHEMA">JSON Schema</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="isPublic"
                  checked={formData.isPublic}
                  onChange={handleChange}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">Public Method</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Prompt Template *</label>
            <textarea
              name="promptTemplate"
              value={formData.promptTemplate}
              onChange={handleChange}
              required
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Configuration (JSON)</label>
            <JsonEditor
              value={formData.config || {}}
              onChange={(value) => setFormData((prev) => prev ? { ...prev, config: value } : null)}
              height="200px"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Save Method'}
            </button>
            <Link
              href="/admin/methods"
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
