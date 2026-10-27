'use client';

import { useState } from 'react';
import type { QueryDatabasePart } from '@/tools';
import type { QueryInput, QueryResult } from '@/tools/query-database';
import { ToolError, ToolLoading } from './ToolStatus';

export default function DatabaseResult({ part }: { part: QueryDatabasePart }) {
  if (part.state === 'output-error') return <ToolError message={part.errorText} />;
  if (part.state !== 'output-available') return <ToolLoading label="Querying the database..." />;
  return <ResultTable input={part.input} initial={part.output} />;
}

function ResultTable({ input, initial }: { input: QueryInput; initial: QueryResult }) {
  const [result, setResult] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const columns =
    result.rows.length > 0
      ? Object.keys(result.rows[0]).filter(column => column !== 'id' && !column.endsWith('_id'))
      : [];

  const goToPage = async (page: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, page, pageSize: result.pageSize }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : 'Could not load that page.');
    }
    setLoading(false);
  };

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-white text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <span className="font-semibold text-gray-800">Database: {result.collection}</span>
        <span className="text-xs text-gray-500">
          {result.total} {result.operation === 'find' ? 'matching documents' : 'in total'} · {result.durationMs} ms
        </span>
      </div>

      {result.rows.length === 0 ? (
        <p className="px-3 py-4 text-gray-500">No matching documents.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                {columns.map(column => (
                  <th key={column} className="px-3 py-2 font-medium whitespace-nowrap">
                    {column.replace('_', ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={String(row.id ?? i)} className="border-t border-gray-100">
                  {columns.map(column => (
                    <td key={column} className="px-3 py-2 align-top text-gray-700">
                      {row[column] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-3 py-2">
          <button
            onClick={() => goToPage(result.page - 1)}
            disabled={loading || result.page <= 1}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">
            {loading ? 'Loading...' : `Page ${result.page} of ${result.totalPages}`}
          </span>
          <button
            onClick={() => goToPage(result.page + 1)}
            disabled={loading || result.page >= result.totalPages}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {error && <p className="px-3 pb-2 text-xs text-red-600">{error}</p>}

      <details className="border-t px-3 py-2 text-xs text-gray-500">
        <summary className="cursor-pointer">MongoDB query</summary>
        <code className="mt-1 block break-all">{result.mongoQuery}</code>
      </details>
    </div>
  );
}
