import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/financeiro')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/financeiro"!</div>
}
