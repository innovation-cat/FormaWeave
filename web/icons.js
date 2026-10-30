const paths = {
  plus:'M12 5v14M5 12h14',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  folder:'M3 7V5a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  sparkles:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4M18 4h4',
  video:'M3 5h12v14H3zM15 9l6-3v12l-6-3',image:'M3 3h18v18H3zM3 16l6-6 5 5 3-3 4 4M16 7h.01',
  box:'m12 2 9 5v10l-9 5-9-5V7zm0 10 9-5M3 7l9 5v10M7.5 4.5l9 5',
  globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
  game:'M7 7h10c3 0 4 3 4 6l1 4c0 3-3 4-5 1l-2-2H9l-2 2c-2 3-5 2-5-1l1-4c0-3 1-6 4-6M6 10v5M3.5 12.5h5M16 11h.01M19 14h.01',
  book:'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15',
  server:'M3 3h18v7H3zM3 14h18v7H3zM7 6.5h.01M7 17.5h.01',
  help:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01',
  sliders:'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-4M20 13V3M1 10h6M9 12h6M17 17h6',
  code:'m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18',arrow:'M4 12h16m-6-6 6 6-6 6',
  play:'m8 5 11 7-11 7z',clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',
  film:'M3 3h18v18H3zM7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4',
  close:'m6 6 12 12M6 18 18 6',copy:'M8 8h13v13H8zM16 8V3H3v13h5',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  chevron:'m6 9 6 6 6-6',link:'m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
  lock:'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3',check:'m5 12 4 4L19 6',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',file:'M5 2h9l5 5v15H5zM14 2v6h5M8 12h8M8 16h6',
  volume:'M11 5 5 9H2v6h3l6 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',
  expand:'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  refresh:'M20 7V2l-3 3a9 9 0 1 0 3 10M20 7h-5',terminal:'m4 5 6 6-6 6m9 0h7',
  layers:'m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5',
  wand:'m3 21 12-12 4 4L7 25M14 3v3M19 5l2-2M19 10h3M5 3v4M3 5h4',
  stop:'M5 5h14v14H5z',info:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 11v6M12 7h.01',
};
export function icon(name, className='') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.code}"/></svg>`;
}
export function hydrateIcons(root=document) {
  root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); el.removeAttribute('data-icon'); });
}
