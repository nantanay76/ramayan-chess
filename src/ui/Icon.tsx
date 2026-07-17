/**
 * Monoline gold icon set — replaces platform emoji so every glyph inherits the
 * heritage palette via currentColor instead of rendering as full-colour system
 * emoji. One inline SVG, no assets, no dependencies.
 */

const PATHS = {
  sound: (
    <>
      <path d="M11 5 6.5 9H3.5v6h3L11 19V5z" />
      <path d="M14.5 9a4.2 4.2 0 0 1 0 6" />
      <path d="M17.2 6.6a8 8 0 0 1 0 10.8" />
    </>
  ),
  soundOff: (
    <>
      <path d="M11 5 6.5 9H3.5v6h3L11 19V5z" />
      <path d="m15.5 9.5 5 5M20.5 9.5l-5 5" />
    </>
  ),
  music: (
    <>
      <path d="M9.5 17.5V5.8l10-1.8v11" />
      <circle cx="7" cy="17.5" r="2.5" />
      <circle cx="17" cy="15" r="2.5" />
    </>
  ),
  musicOff: (
    <>
      <path d="M9.5 17.5V5.8l10-1.8v11" />
      <circle cx="7" cy="17.5" r="2.5" />
      <circle cx="17" cy="15" r="2.5" />
      <path d="M3.5 3.5l17 17" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="7" width="12" height="10" rx="2" />
      <path d="m15 11 6-3.5v9L15 13" />
    </>
  ),
  boardTop: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" />
      <path d="M4.5 12h15M12 4.5v15" />
    </>
  ),
  scroll: (
    <>
      <path d="M7 3.5h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" />
      <path d="M9 9h6M9 12.5h6M9 16h4" />
    </>
  ),
  magnifier: (
    <>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M14.7 14.7 20 20" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V4" />
      <path d="M6 5c2-1.4 4-1.4 6 0s4 1.4 6 0v8c-2 1.4-4 1.4-6 0s-4-1.4-6 0" />
    </>
  ),
  undo: (
    <>
      <path d="M4.5 9.5h9a5 5 0 0 1 0 10H10" />
      <path d="M8.5 5.5 4.5 9.5l4 4" />
    </>
  ),
  flip: (
    <>
      <path d="M8 19.5v-14M8 5.5 4.8 8.7M8 5.5l3.2 3.2" />
      <path d="M16 4.5v14M16 18.5l-3.2-3.2M16 18.5l3.2-3.2" />
    </>
  ),
  crown: (
    <>
      <path d="m4 9 2 9.5h12L20 9l-4.4 3.4L12 5.6l-3.6 6.8L4 9z" />
    </>
  ),
  swords: (
    <>
      <path d="m5 4.5 13.5 13.5M18.5 14.5v3.5H15M5 8V4.5h3.5" />
      <path d="M19 4.5 5.5 18M5.5 14.5V18H9M19 8V4.5h-3.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.2 19.5c0-3.3 2.5-5.7 5.8-5.7s5.8 2.4 5.8 5.7" />
      <path d="M15.4 5.4a3 3 0 1 1 1.4 5.7M17.2 13.9c2.2.6 3.6 2.4 3.6 5" />
    </>
  ),
  flame: (
    <>
      <path d="M12 3.5c1.2 2.8 4.3 4.3 4.3 8a4.8 4.8 0 0 1-9.6 0c0-1.9.9-3 1.9-4.1.2 1.4.9 2.2 1.7 2.6C10 7.4 10.6 5.4 12 3.5z" />
    </>
  ),
  lamp: (
    <>
      <path d="M12 3.2c.9 1.6 2.1 2.4 2.1 3.9a2.1 2.1 0 0 1-4.2 0c0-1.5 1.2-2.3 2.1-3.9z" />
      <path d="M4.5 13h15c0 3.4-3.2 5.7-7.5 5.7S4.5 16.4 4.5 13z" />
      <path d="M9 10.5h6" />
    </>
  ),
  fullscreen: (
    <>
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </>
  ),
  fullscreenExit: (
    <>
      <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />
    </>
  ),
  chevronFirst: (
    <>
      <path d="M7 6v12M17.5 6l-6 6 6 6" />
    </>
  ),
  chevronLeft: (
    <>
      <path d="m14.5 6-6 6 6 6" />
    </>
  ),
  chevronRight: (
    <>
      <path d="m9.5 6 6 6-6 6" />
    </>
  ),
  chevronLast: (
    <>
      <path d="M17 6v12M6.5 6l6 6-6 6" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: '-0.22em' }}
    >
      {PATHS[name]}
    </svg>
  );
}
