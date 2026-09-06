import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { HomePage } from '../features/home/HomePage'
import { NoteDetailPage } from '../features/notes/NoteDetailPage'
import { NotesListPage } from '../features/notes/NotesListPage'

const AdminRoutes = lazy(() => import('../features/admin/AdminRoutes'))

function PendingPage({ label }: { label: string }) {
  return (
    <main style={{ padding: '2rem' }}>
      <p>{label}</p>
      <Link to="/">Return home</Link>
    </main>
  )
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div data-testid="app-root">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/notes" element={<NotesListPage />} />
          <Route path="/notes/:slug" element={<NoteDetailPage />} />
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<PendingPage label="Loading admin" />}>
                <AdminRoutes />
              </Suspense>
            }
          />
          <Route path="*" element={<PendingPage label="Not found" />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
