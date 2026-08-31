import { Check, X } from 'lucide-react'

interface ToastProps {
  message: string
  tone?: 'success' | 'warning' | 'neutral'
  onClose?: () => void
}

export function Toast({ message, tone = 'neutral', onClose }: ToastProps) {
  return (
    <div className={`toast toast--${tone}`} role="status">
      <span className="toast__icon">{tone === 'success' ? <Check size={17} /> : '!'}</span>
      <span>{message}</span>
      {onClose && <button onClick={onClose} aria-label="Close message"><X size={16} /></button>}
    </div>
  )
}
