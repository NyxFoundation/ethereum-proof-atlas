import { useEffect, useState, type KeyboardEvent } from 'react';
import type { AtlasBundle } from '../domain/schema';
import { loadAtlas } from './api';
import { Atlas } from './Atlas';

type LoadState = { kind: 'loading' } | { kind: 'ready'; bundle: AtlasBundle } | { kind: 'error'; message: string };
const repositoryUrl = 'https://github.com/NyxFoundation/ethereum-proof-atlas';
const tabs = [{ id: 'beacon', label: 'Beacon Spec' }, { id: 'lean', label: 'Lean Spec' },
  { id: 'execution', label: 'Execution Spec' }] as const;
export function App() {
  const [viewId, setView] = useState<'beacon' | 'lean' | 'execution'>('beacon');
  const [mode, setMode] = useState<'map' | 'index'>('index');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    loadAtlas(viewId, controller.signal).then(bundle => {
      if (!controller.signal.aborted) setState({ kind: 'ready', bundle });
    }).catch((error: Error) => {
      if (!controller.signal.aborted) setState({ kind: 'error', message: error.message });
    });
    return () => controller.abort();
  }, [viewId, attempt]);
  const switchTab = (id: typeof viewId) => {
    if (id === viewId) return;
    setState({ kind: 'loading' }); setView(id);
  };
  const tabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex(tab => tab.id === viewId);
    const next = event.key === 'Home' ? tabs[0].id : event.key === 'End' ? tabs[tabs.length - 1].id
      : tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].id;
    switchTab(next);
    document.getElementById('tab-' + next)?.focus();
  };
  return <><header>
    <div className="brand-row"><h1><a className="brand" href="/">Ethereum Proof Atlas</a></h1>
      <a className="github-link" href={repositoryUrl} target="_blank" rel="noopener noreferrer" aria-label="GitHub repository">
        <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" /></svg>
      </a></div>
    <p>Formal verification across Ethereum.</p></header>
    <main><div className="view-bar"><div role="tablist" aria-label="Architecture view">{tabs.map(tab =>
        <button id={'tab-' + tab.id} key={tab.id} role="tab" aria-selected={viewId === tab.id} aria-controls="atlas-view"
          tabIndex={viewId === tab.id ? 0 : -1} onKeyDown={tabKey} onClick={() => { if (viewId !== tab.id) switchTab(tab.id); }}>{tab.label}</button>)}</div>
    </div>
      <div id="atlas-view" role="tabpanel" aria-labelledby={'tab-' + viewId}>
        {state.kind === 'loading' && <p className="loading" role="status">Loading the selected architecture…</p>}
        {state.kind === 'error' && <div className="error" role="alert"><h2>Unable to display the atlas</h2><p>{state.message}</p>
          <button onClick={() => setAttempt(n => n + 1)}>Try again</button><button onClick={() => window.location.reload()}>Reload page</button></div>}
        {state.kind === 'ready' && <Atlas key={viewId} bundle={state.bundle}
          view={state.bundle.architectureViews.find(v => v.id === viewId)!} mode={mode} onMode={setMode} />}
      </div>
    </main></>;
}
