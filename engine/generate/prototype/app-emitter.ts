/**
 * app.jsx — root <App/> with view-switching state, mounts to #root.
 */

import type { ViewEmitterResult } from './view-emitter';

export function buildAppJsx(views: ViewEmitterResult[], hasChrome: boolean): string {
  if (views.length === 0) {
    return [
      '/* app.jsx */',
      'function App() { return <div className="app"><p>No views generated.</p></div>; }',
      'ReactDOM.createRoot(document.getElementById("root")).render(<App />);',
      '',
    ].join('\n');
  }

  const firstSlug = views[0].slug;
  const lines: string[] = [
    '/* app.jsx */',
    'function App() {',
    `  const [view, setView] = React.useState(${JSON.stringify(firstSlug)});`,
    '  return (',
    '    <div className="app">',
  ];

  // View switcher tab bar
  lines.push('      <nav className="view-switcher">');
  for (const v of views) {
    lines.push(
      `        <button className={view === ${JSON.stringify(v.slug)} ? "view-tab active" : "view-tab"} onClick={() => setView(${JSON.stringify(v.slug)})}>${v.componentName}</button>`,
    );
  }
  lines.push('      </nav>');

  const wrapOpen = hasChrome ? '      <Chrome>' : '      <>';
  const wrapClose = hasChrome ? '      </Chrome>' : '      </>';
  lines.push(wrapOpen);

  for (const v of views) {
    const dataVar = `${camelCaseFromPascal(v.componentName)}Data`;
    lines.push(
      `        {view === ${JSON.stringify(v.slug)} && <${v.componentName} data={window.${dataVar}} />}`,
    );
  }

  lines.push(wrapClose);
  lines.push('    </div>');
  lines.push('  );');
  lines.push('}');
  lines.push('');
  lines.push('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
  lines.push('');

  return lines.join('\n');
}

function camelCaseFromPascal(pascal: string): string {
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
