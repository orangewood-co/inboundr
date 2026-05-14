export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-stone-900">Page not found</h1>
        <p className="mt-2 text-sm text-stone-500">
          The content you're looking for doesn't exist or has been removed.
        </p>
      </div>
    </main>
  )
}
