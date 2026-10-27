'use client';

import { useEffect, useState } from 'react';
import { JOKE_CATEGORIES, PAGE_SIZES } from '@/lib/constants';
import type { AppSettings } from '@/lib/settings';

export default function SettingsBar() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(response => (response.ok ? response.json() : null))
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  const save = async (changes: Partial<AppSettings>) => {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    }).catch(() => null);

    if (response?.ok) {
      setSettings(await response.json());
      setError('');
    } else {
      setError('Could not save settings.');
    }
  };

  if (!settings) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
      <label className="flex items-center gap-1">
        Default joke
        <select
          value={settings.jokeCategory}
          onChange={e => save({ jokeCategory: e.target.value as AppSettings['jokeCategory'] })}
          className="rounded border bg-white px-1 py-0.5"
        >
          {JOKE_CATEGORIES.map(category => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1">
        Rows per page
        <select
          value={settings.pageSize}
          onChange={e => save({ pageSize: Number(e.target.value) })}
          className="rounded border bg-white px-1 py-0.5"
        >
          {PAGE_SIZES.map(size => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
