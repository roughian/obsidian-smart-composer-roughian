import { LoaderCircle } from 'lucide-react'

export function ResponsePendingIndicator() {
  return (
    <div
      className="smtcmp-response-pending"
      role="status"
      aria-label="Thinking"
    >
      <LoaderCircle className="smtcmp-task-spinner" size={16} aria-hidden />
    </div>
  )
}
