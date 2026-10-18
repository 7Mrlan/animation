export function Icon({
  name,
}: {
  name: 'play' | 'pause' | 'reset' | 'code' | 'arrow' | 'close' | 'copy' | 'github'
}) {
  const paths = {
    play: 'm7 4 12 8-12 8Z',
    pause: 'M8 5v14M16 5v14',
    reset: 'M3 11a9 9 0 1 1 2.7 7M3 4v7h7',
    code: 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    close: 'm6 6 12 12M6 18 18 6',
    copy: 'M8 8h12v12H8ZM4 16V4h12',
    github:
      'M9 19c-4 1-4-2-6-2m12 5v-4c0-1-.2-2-1-2 3-.3 6-1.5 6-5a4 4 0 0 0-1-3c.3-1 .3-2 0-3-2 0-3 1-3 1a12 12 0 0 0-6 0S9 5 7 5c-.3 1-.3 2 0 3a4 4 0 0 0-1 3c0 3.5 3 4.7 6 5-1 .5-1 1-1 2v4',
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
