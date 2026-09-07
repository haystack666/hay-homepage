import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminGuard } from './AdminGuard'
import { AdminLayout } from './AdminLayout'
import { AdminLoginPage } from './AdminLoginPage'
import { AdminNoteEditorPage } from './AdminNoteEditorPage'
import { AdminNotesPage } from './AdminNotesPage'
import '../../styles/admin.css'

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="login" element={<AdminLoginPage />} />
      <Route element={<AdminGuard />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="notes" replace />} />
          <Route path="notes" element={<AdminNotesPage />} />
          <Route path="notes/new" element={<AdminNoteEditorPage />} />
          <Route path="notes/:id/edit" element={<AdminNoteEditorPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  )
}
