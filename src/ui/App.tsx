import { useEffect, useState, type KeyboardEvent } from 'react';
import type { AtlasBundle } from '../domain/schema';
import { loadAtlas } from './api';
import { Atlas } from './Atlas';

type LoadState = { kind: 'loading' } | { kind: 'ready'; bundle: AtlasBundle } | { kind: 'error'; message: string };
const tabs = [{ id: 'beacon', label: 'Beacon Spec' }, { id: 'lean', label: 'Lean Spec' },
  { id: 'execution', label: 'Execution Spec' }] as const;
export function App() {
  const [viewId, setView] = useState<'beacon' | 'lean' | 'execution'>('beacon');
  const [mode, setMode] = useState<'map' | 'index'>('map');
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
  return <><header><h1><a className="brand" href="/">Ethereum Proof Atlas</a></h1>
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
