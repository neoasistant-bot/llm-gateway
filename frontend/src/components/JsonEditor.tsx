'use client';

import { useState, useEffect } from 'react';

interface JsonEditorProps {
  value: any;
  onChange: (value: any) => void;
  readOnly?: boolean;
  height?: string;
}

export function JsonEditor({ value, onChange, readOnly = false, height = '300px' }: JsonEditorProps) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);

  const handleChange = (newText: string) => {
    setText(newText);
    try {
      const parsed = JSON.parse(newText);
      onChange(parsed);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  return (
    <div className="w-full">
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        readOnly={readOnly}
        className={`w-full p-4 border border-gray-300 rounded-lg font-mono text-sm ${
          error ? 'border-red-500 bg-red-50' : ''
        } ${readOnly ? 'bg-gray-100' : ''}`}
        style={{ height }}
      />
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
