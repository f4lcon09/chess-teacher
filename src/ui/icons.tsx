// Small stroke icons (24x24 grid) that follow the current text color.

function Svg({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function CrownIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M4 17 3 7l5 4 4-6 4 6 5-4-1 10z" />
      <path d="M5 20.5h14" />
    </Svg>
  )
}

export function SyncIcon() {
  return (
    <Svg>
      <path d="M20 11a8 8 0 0 0-14.5-4M4 5v3.5h3.5" />
      <path d="M4 13a8 8 0 0 0 14.5 4M20 19v-3.5h-3.5" />
    </Svg>
  )
}

export function SlidersIcon() {
  return (
    <Svg>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </Svg>
  )
}
