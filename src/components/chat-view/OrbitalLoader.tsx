import { LoaderCircle } from 'lucide-react'

export function OrbitalLoader({
  label,
  showLabel = true,
}: {
  label: string
  showLabel?: boolean
}) {
  return (
    <span className="smtcmp-orbital-status" role="status" aria-label={label}>
      <LoaderCircle className="smtcmp-task-spinner" size={16} aria-hidden />
      {showLabel && <span>{label}</span>}
    </span>
  )
}
