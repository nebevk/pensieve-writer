import React from 'react';

// Lucide paths (https://lucide.dev), drawn at stroke 1.75 to match the hairline chrome.
const PATHS = {
  check: ['M20 6 9 17l-5-5'],
  settings: ['M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronUp: ['m18 15-6-6-6 6'],
  search: [['circle', { cx: 11, cy: 11, r: 7 }], 'm20 20-3.5-3.5'],
  list: ['M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13'],
  listOrdered: ['M10 12h11M10 18h11M10 6h11M4 10h2M4 6h1v4M6 18H4c0-1 2-2 2-3s-1-1.5-2-1'],
  outdent: ['M21 12H11M21 18H11M21 6H11M7 8l-4 4 4 4'],
  indent: ['M21 12H11M21 18H11M21 6H11M3 8l4 4-4 4'],
  alignLeft: ['M15 12H3M17 18H3M21 6H3'],
  alignCenter: ['M17 12H7M19 18H5M21 6H3'],
  alignRight: ['M21 12H9M21 18H7M21 6H3'],
  alignJustify: ['M3 12h18M3 18h18M3 6h18'],
  undo: ['M3 7v6h6', 'M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13'],
  redo: ['M21 7v6h-6', 'M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7'],
  clearFormat: ['M4 7V4h16v3M5 20h6M13 4 8 20M15 15l5 5M20 15l-5 5'],
  image: [['rect', { width: 18, height: 18, x: 3, y: 3, rx: 2 }], ['circle', { cx: 9, cy: 9, r: 2 }], 'm21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21'],
  link: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'],
  comment: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
  newNote: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4M12 12v6M9 15h6'],
  listTodo: [['rect', { x: 3, y: 5, width: 6, height: 6, rx: 1 }], 'm3 17 2 2 4-4M13 6h8M13 12h8M13 18h8'],
  replace: ['m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16'],
  rain: ['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M16 14v6M8 14v6M12 16v6'],
  flame: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  x: ['M18 6 6 18M6 6l12 12'],
  arrowRight: ['M5 12h14M12 5l7 7-7 7'],
  plus: ['M12 5v14M5 12h14']
};

export function Icon({ name, size = 15, strokeWidth = 1.75, color = 'currentColor', style }) {
  const parts = PATHS[name] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', display: 'block', ...style }}>
      {parts.map((p, i) => typeof p === 'string'
        ? <path key={i} d={p} />
        : React.createElement(p[0], { key: i, ...p[1] }))}
    </svg>
  );
}
Icon.names = Object.keys(PATHS);
