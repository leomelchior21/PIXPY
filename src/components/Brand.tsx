interface BrandProps {
  compact?: boolean
  inverse?: boolean
}

export function Brand({ compact = false, inverse = false }: BrandProps) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''} ${inverse ? 'brand--inverse' : ''}`} aria-label="PixPy">
      <span>PIX</span>
      <i aria-hidden="true">›_</i>
      <span className="brand__py">PY</span>
    </div>
  )
}
