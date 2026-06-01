/* icons.jsx — minimal lucide-style stroke icons. window.Ic({name, size}) */
const ICON_PATHS = {
  trending: 'M3 17l6-6 4 4 8-8 M21 7v6h-6',
  target: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0 M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
  flag: 'M4 21V4 M4 4h13l-2 4 2 4H4',
  clock: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 7v5l3 2',
  rocket: 'M5 13c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.8-.8.8-2.2 0-3s-2.2-.8-3 0z M9 12l3-3a8 8 0 0 1 6-3 8 8 0 0 1-3 6l-3 3 M9 12l3 3 M14.5 6.5l3 3',
  wallet: 'M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v0H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V9 M16 13h.01',
  play: 'M6 4l14 8-14 8z',
  download: 'M12 3v12 M7 11l5 4 5-4 M5 21h14',
  upload: 'M12 21V9 M7 13l5-4 5 4 M5 3h14',
  layers: 'M12 3l9 5-9 5-9-5 9-5z M3 13l9 5 9-5 M3 17l9 5 9-5',
  pie: 'M12 3a9 9 0 1 0 9 9h-9z M12 3v9h9 M12 3a9 9 0 0 1 9 9',
  activity: 'M3 12h4l3 8 4-16 3 8h4',
  archive: 'M3 5h18v4H3z M5 9v10h14V9 M10 13h4',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14',
  check: 'M5 12l4 4 10-10',
  alert: 'M12 3l9 16H3z M12 10v4 M12 17h.01',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  shieldcheck: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  sliders: 'M4 8h10 M18 8h2 M4 16h2 M10 16h10 M14 5v6 M6 13v6',
  x: 'M6 6l12 12 M18 6L6 18',
  cross: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 8v8 M8 12h8',
  bars: 'M5 21V10 M12 21V4 M19 21v-7',
  spark: 'M12 3l2.2 6.8H21l-5.5 4 2.1 6.8L12 16.6 6.4 20.6l2.1-6.8L3 9.8h6.8z',
  map: 'M9 4L3 7v13l6-3 6 3 6-3V4l-6 3-6-3z M9 4v13 M15 7v13',
  sun: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M12 2v2 M12 20v2 M4 12H2 M22 12h-2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5',
  moon: 'M20 13.2A8 8 0 1 1 10.6 4 6.2 6.2 0 0 0 20 13.2z',
  page: 'M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6'
};
function Ic({ name, size }) {
  const d = ICON_PATHS[name] || '';
  const s = size || 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}
    </svg>
  );
}
window.Ic = Ic;
