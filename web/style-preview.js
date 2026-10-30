// Design illustration uses the same preset as the renderer; it is never a video result.
export function stylePreview(style) {
  const p=style.palette;
  const grid=style.decoration==='grid'
    ? `<pattern id="g" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="${p.grid}" stroke-width="1"/></pattern>`
    : `<pattern id="g" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="${p.grid}" opacity=".6"/></pattern>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <defs>${grid}</defs><rect width="960" height="540" fill="${p.background}"/><rect width="960" height="540" fill="url(#g)"/>
    <g font-family="Segoe UI,Microsoft YaHei,sans-serif"><text x="56" y="58" fill="${p.muted}" font-size="12" letter-spacing="3">THE BEAUTY OF MATHEMATICS</text>
    <text x="56" y="111" fill="${p.foreground}" font-size="30" font-weight="bold">数学，可以看得见。</text>
    <text x="56" y="141" fill="${p.muted}" font-size="13">从一个直角三角形，理解勾股定理</text></g>
    <g transform="translate(415 350)" stroke-width="${style.stroke_max}"><path d="M0 0V-150H-150V0Z" fill="${p.primary}" fill-opacity=".1" stroke="${p.primary}"/>
    <path d="M0 0H200V200H0Z" fill="${p.secondary}" fill-opacity=".1" stroke="${p.secondary}"/>
    <path d="M0-150 200 0 350-200 150-350Z" fill="${p.primary}" fill-opacity=".1" stroke="${p.primary}"/>
    <path d="M0-150V0H200Z" fill="${p.secondary}" fill-opacity=".12" stroke="${p.primary}"/>
    <path d="M0-19H19V0" fill="none" stroke="${p.primary}"/>
    <g font-family="Georgia,serif" font-size="25" font-style="italic" fill="${p.foreground}" stroke="none"><text x="-25" y="-70">a</text><text x="91" y="32">b</text><text x="105" y="-92">c</text></g></g>
    <rect x="55" y="227" width="267" height="83" rx="9" fill="${p.grid}" fill-opacity=".3"/>
    <text x="79" y="281" fill="${p.primary}" font-family="Georgia,serif" font-size="32" font-style="italic">a² + b² = c²</text>
    <text x="56" y="472" fill="${p.muted}" font-family="Segoe UI,sans-serif" font-size="11" letter-spacing="2">CODE → EXPLAIN → CREATE</text>
    <text x="903" y="484" text-anchor="end" fill="${p.foreground}" font-family="Segoe UI,sans-serif" font-size="18" font-weight="bold">FormaWeave</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
