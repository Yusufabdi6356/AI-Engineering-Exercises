export function ToolLoading({ label }: { label: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
      {label}
    </div>
  );
}

export function ToolError({ message }: { message: string }) {
  return (
    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}
