import { useRef, useState } from 'react'
import clsx from 'clsx'
import { X, UploadCloud, Eye, EyeOff } from 'lucide-react'

export function Card({ className, children, ...rest }) {
  return (
    <div className={clsx('rounded-2xl border border-ink-200 bg-white shadow-sm', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={clsx('flex items-center justify-between gap-4 border-b border-ink-100 px-5 py-4', className)}>
      <div>
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

const badgeStyles = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-sky-100 text-sky-700',
}

export function Badge({ variant = 'neutral', children, className }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', badgeStyles[variant], className)}>
      {children}
    </span>
  )
}

const buttonVariants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-white text-brand-700 border border-brand-200 hover:bg-brand-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  ghost: 'text-ink-600 hover:bg-ink-100',
}

export function Button({ variant = 'primary', className, children, disabled, loading, icon: Icon, ...rest }) {
  return (
    <button
      className={clsx(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  )
}

export function Spinner({ className }) {
  return (
    <svg className={clsx('animate-spin', className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export function StatCard({ label, value, icon: Icon, hint, tone = 'brand' }) {
  const toneClasses = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
        </div>
        {Icon && (
          <div className={clsx('flex h-10 w-10 items-center justify-center rounded-lg', toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-ink-50/50 px-6 py-14 text-center">
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
          <Icon className="h-6 w-6 text-ink-400" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-ink-800">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={clsx('skeleton', className)} />
}

export function SkeletonRows({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4" onClick={onClose}>
      <div
        className={clsx('w-full rounded-xl bg-white shadow-xl', sizes[size])}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function ProgressBar({ value, max = 100, tone = 'brand' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const toneClasses = { brand: 'bg-brand-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' }
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
      <div className={clsx('h-full rounded-full transition-all', toneClasses[tone])} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Input({ label, error, className, ...rest }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-ink-700">{label}</span>}
      <input
        className={clsx(
          'h-11 w-full rounded-xl border border-ink-200 px-3.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
          error && 'border-rose-400',
          className,
        )}
        {...rest}
      />
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  )
}

/** Password field with a show/hide toggle. Same visual language as Input. */
export function PasswordInput({ label, error, className, ...rest }) {
  const [visible, setVisible] = useState(false)
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-ink-700">{label}</span>}
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          className={clsx(
            'h-11 w-full rounded-xl border border-ink-200 px-3.5 pr-10 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
            error && 'border-rose-400',
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  )
}

export function Select({ label, error, className, children, ...rest }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-ink-700">{label}</span>}
      <select
        className={clsx(
          'h-11 w-full rounded-xl border border-ink-200 px-3.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
          error && 'border-rose-400',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </label>
  )
}

export function Textarea({ label, error, className, ...rest }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-ink-700">{label}</span>}
      <textarea
        className={clsx(
          'w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
          error && 'border-rose-400',
          className,
        )}
        {...rest}
      />
    </label>
  )
}

/** Drag-and-drop + click-to-browse file picker. Purely a local file selector — callers decide when to upload. */
export function Dropzone({ accept, multiple = false, disabled = false, hint, icon: Icon = UploadCloud, onFiles, className }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (files.length) onFiles(files)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (!disabled) handleFiles(e.dataTransfer.files)
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={clsx(
        'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
        disabled
          ? 'cursor-not-allowed border-ink-200 bg-ink-50 opacity-60'
          : dragOver
          ? 'cursor-pointer border-brand-500 bg-brand-50'
          : 'cursor-pointer border-ink-300 bg-ink-50/50 hover:border-brand-300 hover:bg-brand-50/50',
        className,
      )}
    >
      <Icon className="h-8 w-8 text-ink-400" />
      <p className="text-sm font-medium text-ink-700">Drag &amp; drop your file{multiple ? 's' : ''} here</p>
      <p className="text-xs text-ink-400">or click to browse</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
