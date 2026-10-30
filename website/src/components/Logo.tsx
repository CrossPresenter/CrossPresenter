interface LogoProps {
  size?: number
  className?: string
}

/**
 * Monochrome mark: a presentation frame with a cross inside and a single
 * accent registration square. Inherits colour from the parent.
 */
export default function Logo({ size = 22, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0.75" y="0.75" width="22.5" height="22.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M12 5.5v13" stroke="currentColor" strokeWidth="1.25" />
      <path d="M6.5 10.5h11" stroke="currentColor" strokeWidth="1.25" />
      <rect x="18" y="3" width="3" height="3" className="fill-accent" />
    </svg>
  )
}
