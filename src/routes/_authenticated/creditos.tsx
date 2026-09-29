import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/creditos')({
  component: () => <Navigate to="/dashboard" replace />,
})
