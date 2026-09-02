interface BrandProps {
  compact?: boolean
  inverse?: boolean
}

export function Brand({ compact = false, inverse = false }: BrandProps) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''} ${inverse ? 'brand--inverse' : ''}`} aria-label="PixPy">
      <span className="brand__mark" aria-hidden="true">›_</span>
      <strong className="brand__word">pix<span>py</span></strong>
      <i aria-hidden="true">.</i>
    </div>
  )
}
