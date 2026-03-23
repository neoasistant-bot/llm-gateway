'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { JsonEditor } from '@/components/JsonEditor';
import { StatusBadge } from '@/components/StatusBadge';

interface Method {
  id: string;
  name: string;
  inputType: 'TEXT' | 'JSON_SCHEMA';
}

interface ExecutionResult {
  executionId?: string;
  status?: string;
  output?: any;
  error?: any;
  promptSent?: string;
  latencyMs?: number;
  tokensInput?: number;
  tokensOutput?: number;
}

export default function TestMethodPage() {
  const params = useParams();
  const methodId = params.id as string;

  const [method, setMethod] = useState<Method | null>(null);
  const [input, setInput] = useState('');
  const [inputJson, setInputJson] = useState({});
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const handleExecute = async () => {
    try {
      setExecuting(true);
      setError('');
      setResult(null);

      const payload = method?.inputType === 'TEXT' ? { input } : { input: inputJson };

      const response = await api.post<ExecutionResult>(`/execution/${methodId}`, payload);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
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
            href={`/admin/methods/${methodId}`}
            className="text-blue-600 hover:text-blue-700 text-sm mb-6 inline-block"
          >
            ← Back to Method
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 mb-8">Test Method: {method.name}</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Input</h2>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}

                {method.inputType === 'TEXT' ? (
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="w-full p-4 border border-gray-300 rounded-lg font-mono text-sm"
                    style={{ height: '300px' }}
                    placeholder="Enter your text input..."
                  />
                ) : (
                  <JsonEditor value={inputJson} onChange={setInputJson} height="300px" />
                )}

                <button
                  onClick={handleExecute}
                  disabled={executing}
                  className="mt-4 w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {executing ? 'Executing...' : 'Execute'}
                </button>
              </div>
            </div>

            <div>
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Response</h2>

                {!result ? (
                  <div className="text-center py-12 text-gray-500">
                    No response yet. Execute to see results.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {result.status && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Status</p>
                        <StatusBadge status={result.status as any} />
                      </div>
                    )}

                    {result.latencyMs !== undefined && (
                      <div>
                        <p className="text-sm text-gray-600">Latency: <span className="font-semibold">{result.latencyMs}ms</span></p>
                      </div>
                    )}

                    {result.tokensInput !== undefined && (
                      <div>
                        <p className="text-sm text-gray-600">Input Tokens: <span className="font-semibold">{result.tokensInput}</span></p>
                      </div>
                    )}

                    {result.tokensOutput !== undefined && (
                      <div>
                        <p className="text-sm text-gray-600">Output Tokens: <span className="font-semibold">{result.tokensOutput}</span></p>
                      </div>
                    )}

                    {result.promptSent && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Prompt Sent</p>
                        <div className="bg-gray-50 p-3 rounded-lg text-sm font-mono whitespace-pre-wrap break-words">
                          {result.promptSent}
                        </div>
                      </div>
                    )}

                    {result.output && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Output</p>
                        <JsonEditor value={result.output} onChange={() => {}} readOnly={true} height="150px" />
                      </div>
                    )}

                    {result.error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        <p className="font-semibold">Error</p>
                        <pre className="text-sm mt-2 whitespace-pre-wrap">{JSON.stringify(result.error, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
