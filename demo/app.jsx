import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { displayName, feed, themeValue } from './model.js';
import { LiveFeed } from './live-feed.jsx';
import { useNavigationFocus } from './navigation.js';

/** @param {{children:import('react').ReactNode, tone?:string}} props */
function Chip({ children, tone = '' }) { return <span className={`chip ${tone}`}>{children}</span>; }
/** @param {{label:string,children:import('react').ReactNode}} props */
function Fact({ label, children }) { return <div className="fact"><dt>{label}</dt><dd>{children}</dd></div>; }

function App() {
  const [page, setPage] = useState('Feed');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('All');
  const [selected, setSelected] = useState(feed[0]);
  const [theme, setTheme] = useState(() => { try { return themeValue(localStorage.getItem('dread-demo-theme')); } catch { return 'system'; } });
  const [ended, setEnded] = useState(false);
  const [missingClaims, setMissingClaims] = useState(false);
  useNavigationFocus(ended ? 'Ended' : page);
  const [followed, setFollowed] = useState(['Cedar Cloud', 'Willow Identity']);
  useEffect(() => {
    const listener = (/** @type {StorageEvent} */ event) => { if (event.key === 'dread-demo-theme' || event.key === null) setTheme(themeValue(event.newValue)); };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, []);
  /** @param {string} next */
  function navigate(next) { setPage(next); setQuery(''); setKind('All'); }
  /** @param {import('./model.js').FeedItem} item */
  function openFinding(item) { setSelected(item); navigate('Finding'); }
  const user = displayName(missingClaims ? {} : { name: 'Alex Morgan' });
  return <>
    <a href="#main" className="skip">Skip to content</a>
    <header className="header"><div className="header-inner">
      <a className="brand" href="#main" onClick={() => navigate('Feed')}><img src="/logo.svg" alt="" width="38" height="38"/><span>The Daily Dread<small>Northstar Labs · Sample company</small></span></a>
      {!ended && <nav aria-label="Main navigation">{['Feed','Findings','Repositories','Vendors','Alerts','Admin'].map(name => <button type="button" key={name} aria-current={page === name || page === 'Finding' && name === 'Findings' ? 'page' : undefined} onClick={() => navigate(name)}>{name}</button>)}</nav>}
      <div className="identity"><div><strong>{user}</strong><small>Sample identity · Okta</small></div><span className="admin-badge">Admin demo</span><button className="exit" onClick={() => { setEnded(true); setQuery(''); setSelected(feed[0]); }}>End demo</button></div>
    </div></header>
    <div className="demo-bar"><span><strong>Interactive demo</strong><span className="demo-description"> Real public feed · Sample repository analysis</span></span><label className="theme-label">Theme <select aria-label="Theme" value={theme} onChange={event => { const next = themeValue(event.target.value); setTheme(next); window.dispatchEvent(new CustomEvent('dread-demo-theme', { detail: next })); }}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div>
    <main id="main" tabIndex={-1} className="page">
      {ended ? <section className="end-panel"><span className="eyebrow">Demo ended</span><h1>Ready when you are.</h1><p>The sample views have been cleared. Restart to walk through the fictional scenario again.</p><button className="primary" onClick={() => { setEnded(false); navigate('Feed'); setFollowed(['Cedar Cloud', 'Willow Identity']); }}>Restart demo</button></section> : <>
      {page === 'Feed' && <LiveFeed openDemo={() => openFinding(feed[0])}/> }
      {page === 'Findings' && <><PageTitle eyebrow="Local exposure" title="Findings" text="Trace each conclusion back to the evidence that supports it."/><div className="feed-list">{feed.slice(0,1).map(item => <article key={item.id} className="feed-row"><div className="chips"><Chip tone="hatched">◌ Needs review</Chip><Chip>{item.severity} severity</Chip></div><h2><button className="title-link" onClick={() => openFinding(item)}>{item.title}</button></h2><p>{item.reason}</p><button className="text-button" onClick={() => openFinding(item)}>Open finding</button></article>)}</div></>}
      {page === 'Finding' && <>
        <button className="text-button back" onClick={() => navigate('Feed')}>← Back to feed</button>
        <PageTitle eyebrow={`${selected.id} · Synthetic scenario`} title={selected.title} text="Finding version 3 · Analyzed November 4, 2026 at 09:48 UTC"/>
        <div className="report-layout"><section className="verdict panel"><div className="chips"><Chip tone="hatched">◌ Completed with gaps</Chip><span className="provenance">Analysis</span></div><h2>{selected.id === feed[0].id ? 'Affected version found. Reachability needs review.' : 'Relevant signal. More evidence is needed.'}</h2><p>{selected.id === feed[0].id ? 'The sample lockfile resolves harbor-gateway@2.4.1, inside the advisory’s affected range. The available files do not establish whether the legacy integration is enabled.' : selected.reason}</p><div className="confidence"><div><strong>84</strong><span>/100 · High confidence</span></div><div className="confidence-track" role="meter" aria-label="Confidence in the sample evidence match" aria-valuemin={0} aria-valuemax={100} aria-valuenow={84}><span/></div><p>Exact package identity and version match in the sample lockfile. This score does not measure severity.</p></div></section>
        <aside className="evidence panel"><span className="eyebrow">Show your work</span><h2>Evidence</h2><dl><Fact label="Repository"><code>northstar/checkout</code></Fact><Fact label="Branch"><code>main</code></Fact><Fact label="Commit"><code>f3a12c07d4e5b8932a100bc4d7755aa1e02cc891</code></Fact><Fact label="Dependency"><code>harbor-gateway@2.4.1</code></Fact><Fact label="Path"><code>services/checkout/package-lock.json</code></Fact><Fact label="Scope">Production dependency</Fact><Fact label="Affected range"><code>≥2.0.0, &lt;2.4.3</code></Fact><Fact label="Source revision">Synthetic advisory revision 2</Fact><Fact label="Analysis version">Demo matcher 1</Fact></dl><p className="caption">Illustrative evidence for this fictional scenario only.</p></aside>
        <section className="narrative"><div className="panel"><h2>What this means</h2><dl className="impact"><Fact label="Severity">{selected.severity} · Fictional source rating</Fact><Fact label="Business impact"><span className="unknown-label">Unknown</span> Deployment and configuration are unverified.</Fact><Fact label="Exploitation">{selected.status === 'Exploitation reported' ? <Chip tone="dawn">⚑ {selected.status}</Chip> : selected.status}</Fact></dl></div><div className="gap"><strong>Coverage gap</strong><p>Runtime configuration was not available. Review the deployed legacy integration setting to establish reachability.</p></div><div className="panel"><span className="provenance">Analysis</span><h2>Recommended next steps</h2><ol className="steps"><li><strong>Confirm the deployed configuration.</strong><p>Determine whether the legacy integration is enabled in the checkout service.</p></li><li><strong>Review the corrected release.</strong><p>Evaluate harbor-gateway 2.4.3 against the service’s compatibility requirements.</p></li><li><strong>Check access logs.</strong><p>Look for the indicators described by the advisory, within your existing access policy.</p></li></ol></div><div className="panel"><span className="provenance">Publisher statement · Fictional</span><blockquote>{selected.description}</blockquote><p className="caption">{selected.source} · Sample revision 2 · Retrieved November 4, 2026. Invented text for demonstration.</p></div><div className="panel"><span className="provenance">Company note · Fictional</span><p>The checkout service is owned by the Platform team. Confirm production configuration before drawing a conclusion about exposure.</p></div><div className="panel"><h2>Report history</h2><p><strong>Version 3</strong> — Current dependency evidence added.</p><p><strong>Version 2</strong> — Affected range corrected.</p><p><strong>Version 1</strong> — Initial sample finding.</p></div></section></div>
      </>}
      {page === 'Repositories' && <><PageTitle eyebrow="Inspection progress" title="Repositories" text="A completed check can still have gaps. See what was—and wasn’t—read."/><div className="batch panel"><div><h2>Harbor Gateway advisory batch</h2><p>Fixed sample batch · Last updated 09:48 UTC</p></div><div className="chips"><Chip>3 total</Chip><Chip>1 completed with gaps</Chip><Chip>1 running</Chip><Chip>1 queued</Chip></div></div><div className="repo-list">{[['northstar/checkout','Completed with gaps','Dependency files read. Runtime configuration unavailable.','hatched'],['northstar/customer-portal','Running','Reading immutable dependency evidence.','running'],['northstar/worker','Queued','Queue position 1. Waiting for a repository slot.','']].map(([name,status,detail,tone]) => <article className="panel repository" key={name}><div><Chip tone={tone}>◷ {status}</Chip><h2><code>{name}</code></h2><p>{detail}</p></div><dl><Fact label="Branch"><code>main</code></Fact><Fact label="Trigger">Sample advisory revision 2</Fact></dl></article>)}</div><p className="quiet-note">This is a frozen demonstration of progress states; no scans are running.</p></>}
      {page === 'Vendors' && <><PageTitle eyebrow="Company context" title="Vendor watchlist" text="Keep the services your company relies on in view."/><div className="vendor-grid">{['Cedar Cloud','Willow Identity','Harbor Systems'].map(name => <article className="panel" key={name}><span className="vendor-mark" aria-hidden="true">{name.slice(0,1)}</span><h2>{name}</h2><p>{name === 'Cedar Cloud' ? 'Cloud infrastructure' : name === 'Willow Identity' ? 'Identity provider' : 'Gateway and integration software'}</p><p className="muted">Fictional vendor · Sample relationship</p><button className={followed.includes(name) ? 'secondary' : 'primary'} onClick={() => setFollowed(current => current.includes(name) ? current.filter(value => value !== name) : [...current,name])}>{followed.includes(name) ? 'Remove from demo watchlist' : 'Add to demo watchlist'}</button></article>)}</div><p role="status" className="quiet-note">{followed.length} vendors followed in this demo. No notifications will be sent.</p></>}
      {page === 'Alerts' && <><PageTitle eyebrow="Attributable updates" title="Alerts" text="What was detected, what was sent, and what remains uncertain."/><div className="feed-list"><article className="feed-row"><Chip>In-app sample</Chip><h2>Harbor Gateway requires review</h2><p>A matching dependency was found in the sample checkout service.</p><button className="text-button" onClick={() => openFinding(feed[0])}>Review the finding</button></article><article className="feed-row"><Chip tone="dawn">Outcome uncertain · Sample</Chip><h2>Example external delivery state</h2><p>A provider acknowledgment alone would not establish that a person read a message. No message was sent by this demo.</p></article></div></>}
      {page === 'Admin' && <><PageTitle eyebrow="Demo controls" title="Administration preview" text="Explore presentation fallbacks without changing a real installation."/><div className="panel admin-panel"><h2>Identity fallback</h2><p>The product must stay usable when optional display claims are missing.</p><label className="checkbox"><input type="checkbox" checked={missingClaims} onChange={event => setMissingClaims(event.target.checked)}/> Hide optional sample profile claims</label><p>Current display: <strong>{user}</strong></p></div><div className="gap"><strong>Production configuration is unavailable</strong><p>Identity setup, connector credentials, audit destinations and provider activation are blocked production work. This demo collects no credentials.</p></div></>}
      </>}
    </main><footer className="footer"><span>The Daily Dread</span><span>Evidence before conclusions.</span><a href="/NOTICES.txt">Licenses</a></footer>
  </>;
}

/** @param {{eyebrow:string,title:string,text:string}} props */
function PageTitle({eyebrow,title,text}) { return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div></div>; }
const root = document.getElementById('root');
if (root) createRoot(root).render(<App/>);
