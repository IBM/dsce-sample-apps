import { useEffect, useRef } from 'react';
import './Architecture.scss';

// ── SVG sprite ────────────────────────────────────────────────────────────────
const SVG_SPRITE = `<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;overflow:hidden">
  <symbol id="i-database" viewBox="0 0 32 32"><path d="M16 3C9.7 3 5 5.1 5 8v16c0 2.9 4.7 5 11 5s11-2.1 11-5V8c0-2.9-4.7-5-11-5Zm9 21c0 1.2-3.5 3-9 3S7 25.2 7 24v-4.3c2 1.4 5.2 2.3 9 2.3s7-.9 9-2.3V24Zm0-7c0 1.2-3.5 3-9 3s-9-1.8-9-3v-4.3c2 1.4 5.2 2.3 9 2.3s7-.9 9-2.3V17Zm-9-4c-5.5 0-9-1.8-9-3V8c0-1.2 3.5-3 9-3s9 1.8 9 3v2c0 1.2-3.5 3-9 3Z"/></symbol>
  <symbol id="i-document" viewBox="0 0 32 32"><path d="M20 2H6v28h20V8Zm0 3.4L22.6 8H20ZM8 28V4h10v6h6v18Z"/><path d="M11 14h10v2H11zm0 5h10v2H11zm0 5h7v2h-7z"/></symbol>
  <symbol id="i-asset" viewBox="0 0 32 32"><path d="M4 28h24v2H4zM6 14h8v12H6zm10-8h10v20H16zm2 2v18h6V8zM8 16v10h4V16z"/><path d="M19 11h4v2h-4zm0 5h4v2h-4zm0 5h4v2h-4z"/></symbol>
  <symbol id="i-sensor" viewBox="0 0 32 32"><path d="M16 11a5 5 0 1 0 5 5 5 5 0 0 0-5-5Zm0 8a3 3 0 1 1 3-3 3 3 0 0 1-3 3Z"/><path d="m9.6 22.4-1.4 1.4a11 11 0 0 1 0-15.6l1.4 1.4a9 9 0 0 0 0 12.8Zm12.8 0a9 9 0 0 0 0-12.8l1.4-1.4a11 11 0 0 1 0 15.6ZM5.4 26.6 4 28A17 17 0 0 1 4 4l1.4 1.4a15 15 0 0 0 0 21.2Zm21.2 0a15 15 0 0 0 0-21.2L28 4a17 17 0 0 1 0 24Z"/></symbol>
  <symbol id="i-network" viewBox="0 0 32 32"><path d="M22 18a4 4 0 0 0-3.9 3H14a6 6 0 0 0-5-5.9V11h3a4 4 0 1 0 0-2H7v6.1A6 6 0 1 0 14 23h4.1a4 4 0 1 0 3.9-5ZM16 6a2 2 0 1 1-2 2 2 2 0 0 1 2-2ZM8 25a4 4 0 1 1 4-4 4 4 0 0 1-4 4Zm14-1a2 2 0 1 1 2-2 2 2 0 0 1-2 2Z"/></symbol>
  <symbol id="i-search" viewBox="0 0 32 32"><path d="m29 27.6-7.7-7.7a10 10 0 1 0-1.4 1.4l7.7 7.7ZM5 14a9 9 0 1 1 9 9 9 9 0 0 1-9-9Z"/></symbol>
  <symbol id="i-ai" viewBox="0 0 32 32"><path d="M16 2a8 8 0 0 0-8 8v2.3A5 5 0 0 0 5 17v5a5 5 0 0 0 5 5h2v3h8v-3h2a5 5 0 0 0 5-5v-5a5 5 0 0 0-3-4.7V10a8 8 0 0 0-8-8Zm0 2a6 6 0 0 1 6 6v2H10v-2a6 6 0 0 1 6-6Zm9 13v5a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z"/><path d="M11 18h2v2h-2zm8 0h2v2h-2zm-7 4h8v2h-8z"/></symbol>
  <symbol id="i-shield" viewBox="0 0 32 32"><path d="M16 2 5 6v8c0 7.5 4.5 13.8 11 16 6.5-2.2 11-8.5 11-16V6Zm9 12c0 6.2-3.5 11.6-9 13.9C10.5 25.6 7 20.2 7 14V7.4l9-3.3 9 3.3Z"/><path d="m14.5 20.4-4-4 1.4-1.4 2.6 2.6 5.7-5.7 1.4 1.4z"/></symbol>
  <symbol id="i-tools" viewBox="0 0 32 32"><path d="M29 9.5a8 8 0 0 1-10.1 7.7L8.1 28 4 23.9l10.8-10.8A8 8 0 0 1 22.5 3l-4.2 4.2 1.5 4.5 4.5 1.5Z"/></symbol>
  <symbol id="i-plan" viewBox="0 0 32 32"><path d="M26 4h-4V2h-2v2h-8V2h-2v2H6a2 2 0 0 0-2 2v22h24V6a2 2 0 0 0-2-2Zm0 22H6V10h20ZM6 8V6h4v2h2V6h8v2h2V6h4v2Z"/><path d="M9 14h6v2H9zm0 5h6v2H9zm10-5h4v2h-4zm0 5h4v2h-4z"/></symbol>
  <symbol id="i-root" viewBox="0 0 32 32"><path d="M16 2a14 14 0 1 0 14 14A14 14 0 0 0 16 2Zm0 26a12 12 0 1 1 12-12 12 12 0 0 1-12 12Z"/><path d="M8 17h5l2-6 3 10 2-4h4v2h-5.2l-.8 1.6-3-10-1 3H8z"/></symbol>
  <symbol id="i-safety" viewBox="0 0 32 32"><path d="M7 26h18v2H7zM9 22h14v2H9zM11 20V9a5 5 0 0 1 10 0v11h-2V9a3 3 0 0 0-6 0v11Z"/><path d="M5 20h22v2H5zM3 14h4v2H3zm22 0h4v2h-4zM7.5 5.1l2.8 2.8-1.4 1.4-2.8-2.8zm14.2 2.8 2.8-2.8 1.4 1.4-2.8 2.8z"/></symbol>
  <symbol id="i-speed" viewBox="0 0 32 32"><path d="M16 4a12 12 0 1 0 12 12A12 12 0 0 0 16 4Zm0 22a10 10 0 1 1 10-10 10 10 0 0 1-10 10Z"/><path d="m20.8 10-6.2 4.4a3 3 0 1 0 3 5.2Z"/></symbol>
  <symbol id="i-consistency" viewBox="0 0 32 32"><path d="M14 4h14v2H14zm0 11h14v2H14zm0 11h14v2H14zM4 3h6v6H4zm2 2v2h2V5zm-2 9h6v6H4zm2 2v2h2v-2zm-2 9h6v6H4zm2 2v2h2v-2z"/></symbol>
  <symbol id="i-knowledge" viewBox="0 0 32 32"><path d="M16 5C9.7 5 5 7.1 5 10v12c0 2.9 4.7 5 11 5s11-2.1 11-5V10c0-2.9-4.7-5-11-5Zm9 17c0 1.2-3.5 3-9 3s-9-1.8-9-3v-2.3c2 1.4 5.2 2.3 9 2.3s7-.9 9-2.3Zm0-5c0 1.2-3.5 3-9 3s-9-1.8-9-3v-2.3c2 1.4 5.2 2.3 9 2.3s7-.9 9-2.3Zm-9-4c-5.5 0-9-1.8-9-3s3.5-3 9-3 9 1.8 9 3-3.5 3-9 3Z"/></symbol>
  <symbol id="i-trust" viewBox="0 0 32 32"><path d="M16 2 5 6v8c0 7.5 4.5 13.8 11 16 6.5-2.2 11-8.5 11-16V6Zm0 25.9C10.5 25.6 7 20.2 7 14V7.4l9-3.3 9 3.3V14c0 6.2-3.5 11.6-9 13.9Z"/><path d="M15 9h2v8h-2zm0 10h2v2h-2z"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 32 32"><path d="m18 6-1.4 1.4 7.6 7.6H4v2h20.2l-7.6 7.6L18 26l10-10z"/></symbol>
  <symbol id="i-play" viewBox="0 0 32 32"><path d="M8 5v22l19-11Z"/></symbol>
  <symbol id="i-reset" viewBox="0 0 32 32"><path d="M26 8.2A12 12 0 1 0 28 16h-2a10 10 0 1 1-1.7-5.6L20 14h8V6Z"/></symbol>
</svg>`;

// ── Story data ────────────────────────────────────────────────────────────────
const STORIES = {
  operations:  { label:'Connected knowledge',  title:'Maximo operational data grounds every answer in real work context',                      text:'Asset history, work orders, inspections, failure records, and service notes provide the operational facts needed to tailor guidance to the exact asset and situation.',                                                               tags:['Assets','Work history','Inspections'],            source:'Maximo operational data',                        hub:'Context engine + asset context',        outcome:'Troubleshooting, health, and work summaries' },
  documents:   { label:'Connected knowledge',  title:'Approved procedures become easy to find and reuse',                                       text:'Manuals, SOPs, service notes, safety documents, and controlled content are indexed with their source and metadata, making them available for grounded retrieval.',                                                         tags:['Manuals','SOPs','Safety content'],                source:'Documents and procedures',                       hub:'Unified index + semantic search',       outcome:'Planning, troubleshooting, and compliance' },
  enterprise:  { label:'Connected knowledge',  title:'Enterprise systems extend the maintenance decision',                                       text:'ERP, procurement, SharePoint, and other repositories contribute availability, supplier, document, and business context without forcing users to search each system separately.',                                       tags:['ERP','Repositories','Procurement'],               source:'Enterprise repositories',                        hub:'Context engine + governance',           outcome:'More complete maintenance decisions' },
  realtime:    { label:'Connected knowledge',  title:'Real-time signals reveal what is happening now',                                           text:'IoT and condition data complement historical records, helping the hub distinguish a current anomaly from a recurring pattern and prioritize the next action.',                                               tags:['IoT','Condition data','Live signals'],             source:'Real-time and external signals',                  hub:'Context engine + asset context',        outcome:'Health insight and predictive support' },
  index:       { label:'Hub capability',       title:'One index provides a consistent retrieval foundation',                                     text:'Structured records and unstructured content are normalized, enriched with metadata, and made searchable through a common knowledge layer.',                                                              tags:['Unified retrieval','Metadata','Provenance'],      source:'Approved enterprise knowledge',                  hub:'Unified knowledge index',               outcome:'One place to find trusted information' },
  retrieval:   { label:'Hub capability',       title:'Contextual search and RAG find the right evidence for the current task',                   text:'The hub understands the request, resolves relevant assets and entities, and combines semantic retrieval with live context before an answer is generated.',                                              tags:['Intent aware','Hybrid retrieval','Grounded evidence'], source:'Knowledge + live operational signals',        hub:'Contextual search and RAG',             outcome:'Relevant answers tailored to the task' },
  asset:       { label:'Hub capability',       title:'Asset and work context makes guidance specific, not generic',                              text:'The hub uses hierarchy, work history, location, failure, job plan, and condition information to adapt the response to the exact asset and work situation.',                                           tags:['Hierarchy','History','Conditions'],               source:'Maximo asset and work records',                  hub:'Asset and work context',                outcome:'Site- and asset-specific guidance' },
  governance:  { label:'Hub capability',       title:'Governance keeps AI grounded, controlled, and auditable',                                  text:'Role-based access, provenance, policy controls, and audit records help ensure the assistant uses the right content for the right user.',                                                          tags:['Access control','Audit','Provenance'],            source:'Approved, permissioned content',                 hub:'Trust and governance',                  outcome:'Safer enterprise AI adoption' },
  assistant:   { label:'AI experience',        title:'The assistant turns connected context into clear maintenance action',                       text:'It presents concise recommendations, supporting evidence, and relevant next steps while keeping the underlying source and asset context visible.',                                                   tags:['Copilot','Grounded response','Next action'],      source:'Connected knowledge and live context',           hub:'AI maintenance assistant',              outcome:'Clear and explainable action' },
  troubleshoot:{ label:'Maintenance outcome',  title:'Technicians can troubleshoot and resolve issues with the full context in one place',        text:'The hub combines the current symptom, asset history, manuals, service notes, and live conditions to provide a focused troubleshooting path.',                                                      tags:['Diagnosis','Repair guidance','Evidence'],         source:'History + procedures + live signals',            hub:'RAG + context engine',                  outcome:'Faster issue resolution' },
  planning:    { label:'Maintenance outcome',  title:'Teams can plan and execute work with less manual research',                                 text:'Approved procedures, OEM guidance, parts, safety requirements, and work history are assembled into a consistent planning context.',                                                              tags:['Job plans','Procedures','Materials'],             source:'Procedures + parts + enterprise systems',        hub:'Index + RAG + governance',              outcome:'Better planned work' },
  performance: { label:'Maintenance outcome',  title:'Operational signals become clearer asset-performance decisions',                           text:'Historical work, live condition, and failure patterns are brought together to support asset health insight, predictive maintenance, and better reliability decisions.',                            tags:['Asset health','Prediction','Reliability'],        source:'Maximo history + telemetry',                     hub:'Context engine + asset context',        outcome:'Earlier, better maintenance decisions' },
  knowledge:   { label:'Maintenance outcome',  title:'Knowledge access, training, safety, and compliance come together',                         text:'Users can search in natural language, learn from approved guidance, and receive permission-aware safety and compliance information with traceable source evidence.',                              tags:['Knowledge access','Training','Compliance'],       source:'Documents + repositories + controlled content',  hub:'Unified index + RAG + governance',      outcome:'Safer, faster knowledge-led work' },
  'value-speed':       { label:'Business value', title:'Reduce the time spent finding and connecting information',          text:'A single contextual experience helps users move from symptom to evidence and action without searching across multiple repositories.',                                                       tags:['Speed','Productivity','Resolution'],              source:'Operational records + procedures + signals',     hub:'RAG + context engine',                  outcome:'Faster issue resolution' },
  'value-consistency': { label:'Business value', title:'Make maintenance execution more repeatable across teams',           text:'Approved guidance and contextual recommendations reduce variation while preserving the flexibility required for the actual asset and condition.',                                          tags:['Consistency','Quality','Standard work'],          source:'Approved procedures and controls',               hub:'Index + governance',                    outcome:'More consistent work execution' },
  'value-knowledge':   { label:'Business value', title:'Turn fragmented expertise into reusable enterprise knowledge',     text:'The hub brings documents, service notes, OEM content, and operational learning into one discoverable and explainable knowledge experience.',                                              tags:['Knowledge reuse','Training','Scale'],             source:'Documents + expert knowledge',                   hub:'Unified index + RAG',                   outcome:'Faster knowledge transfer' },
  'value-trust':       { label:'Business value', title:'Adopt AI with stronger control and confidence',                    text:'Evidence grounding, provenance, access controls, and audit trails help users understand why an answer was produced and whether it is appropriate to use.',                                tags:['Trust','Governance','Auditability'],              source:'Approved permissioned content',                  hub:'Governance + AI assistant',             outcome:'Trusted, auditable decisions' },
};

const DEMO_ORDER = ['operations','index','retrieval','troubleshoot','value-speed','documents','planning','governance','knowledge','value-trust'];

export default function Architecture() {
  const shellRef      = useRef(null);
  const timerRef      = useRef(null);
  const demoIdxRef    = useRef(0);
  // side panel refs
  const panelRef      = useRef(null);
  const overlayRef    = useRef(null);
  // story content refs
  const storyLabelRef   = useRef(null);
  const storyTitleRef   = useRef(null);
  const storyTextRef    = useRef(null);
  const storyTagsRef    = useRef(null);
  const detailSrcRef    = useRef(null);
  const detailHubRef    = useRef(null);
  const detailOutRef    = useRef(null);
  const jrSrcRef        = useRef(null);
  const jrHubRef        = useRef(null);
  const jrOutRef        = useRef(null);
  const flowStatusRef   = useRef(null);

  // ── Reveal animation ───────────────────────────────────────────────────────
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.narch-reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function openPanel() {
    overlayRef.current.hidden = false;
    panelRef.current.classList.add('is-open');
    overlayRef.current.classList.add('is-open');
    panelRef.current.setAttribute('aria-hidden', 'false');
  }

  function closePanel(clearSel = false) {
    panelRef.current.classList.remove('is-open');
    overlayRef.current.classList.remove('is-open');
    panelRef.current.setAttribute('aria-hidden', 'true');
    setTimeout(() => { if (!panelRef.current.classList.contains('is-open')) overlayRef.current.hidden = true; }, 220);
    if (clearSel) {
      shellRef.current.querySelectorAll('[data-id]').forEach(el =>
        el.classList.remove('is-selected','is-related','is-muted','is-pulsing'));
      flowStatusRef.current.textContent = 'Ready to explore';
    }
  }

  function animateJourney() {
    document.querySelectorAll('.narch-journey__step').forEach((step, i) => {
      step.classList.remove('is-entering');
      void step.offsetWidth;
      step.style.animationDelay = `${i * 90}ms`;
      step.classList.add('is-entering');
    });
  }

  function selectStory(id) {
    const story = STORIES[id];
    const shell = shellRef.current;
    if (!story || !shell) return;
    const allCards = [...shell.querySelectorAll('[data-id]')];
    const selEl = allCards.find(el => el.dataset.id === id);
    if (!selEl) return;
    const related = new Set((selEl.dataset.related || '').split(',').filter(Boolean));
    allCards.forEach(el => {
      const active = el.dataset.id === id;
      const linked = related.has(el.dataset.id);
      el.classList.toggle('is-selected', active);
      el.classList.toggle('is-related', linked && !active);
      el.classList.toggle('is-muted', !active && !linked);
    });
    selEl.classList.remove('is-pulsing'); void selEl.offsetWidth; selEl.classList.add('is-pulsing');
    storyLabelRef.current.textContent  = story.label;
    storyTitleRef.current.textContent  = story.title;
    storyTextRef.current.textContent   = story.text;
    storyTagsRef.current.innerHTML     = story.tags.map(t => `<span class="narch-story-tag">${t}</span>`).join('');
    detailSrcRef.current.textContent   = story.source;
    detailHubRef.current.textContent   = story.hub;
    detailOutRef.current.textContent   = story.outcome;
    jrSrcRef.current.textContent       = story.source;
    jrHubRef.current.textContent       = story.hub;
    jrOutRef.current.textContent       = story.outcome;
    flowStatusRef.current.textContent  = story.label;
    animateJourney();
    openPanel();
  }

  function clearStory() {
    stopDemo();
    const shell = shellRef.current;
    if (shell) shell.querySelectorAll('[data-id]').forEach(el =>
      el.classList.remove('is-selected','is-related','is-muted','is-pulsing'));
    storyLabelRef.current.textContent  = 'Architecture overview';
    storyTitleRef.current.textContent  = 'Select a card to reveal its connected story';
    storyTextRef.current.textContent   = 'Select any card to open the detail panel on the left.';
    storyTagsRef.current.innerHTML     = '<span class="narch-story-tag">Interactive</span><span class="narch-story-tag">Context grounded</span><span class="narch-story-tag">Governed</span>';
    detailSrcRef.current.textContent   = 'Connected enterprise sources';
    detailHubRef.current.textContent   = 'Asset Management Knowledge Hub';
    detailOutRef.current.textContent   = 'Trusted maintenance action';
    jrSrcRef.current.textContent       = 'Connected enterprise sources';
    jrHubRef.current.textContent       = 'Asset Management Knowledge Hub';
    jrOutRef.current.textContent       = 'Trusted maintenance action';
    flowStatusRef.current.textContent  = 'Ready to explore';
    animateJourney();
    closePanel(false);
  }

  function stopDemo() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    shellRef.current?.classList.remove('is-running');
  }

  function startDemo() {
    if (timerRef.current) { stopDemo(); return; }
    shellRef.current?.classList.add('is-running');
    demoIdxRef.current = 0;
    selectStory(DEMO_ORDER[demoIdxRef.current]);
    timerRef.current = setInterval(() => {
      demoIdxRef.current = (demoIdxRef.current + 1) % DEMO_ORDER.length;
      selectStory(DEMO_ORDER[demoIdxRef.current]);
    }, 2500);
  }

  const onCard = (id) => { selectStory(id); };
  const onCardKey = (e, id) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectStory(id); } };

  return (
    <div className="narch-page">
      <div dangerouslySetInnerHTML={{ __html: SVG_SPRITE }} />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="narch-hero">
        <div className="narch-hero__content">
          <p className="narch-eyebrow">Asset Management Knowledge Hub</p>
          <h1 className="narch-hero__heading">Connected knowledge.<br />Context-aware maintenance.</h1>
          <p className="narch-hero__description">A simplified, interactive view of how enterprise knowledge and Maximo operational data become trusted, AI-assisted maintenance outcomes.</p>
          <div className="narch-hero__actions">
            <button className="narch-btn narch-btn--primary" onClick={startDemo} type="button">
              Play the story <svg className="narch-icon" aria-hidden="true"><use href="#i-play" /></svg>
            </button>
            <button className="narch-btn narch-btn--secondary" onClick={clearStory} type="button">
              Reset view <svg className="narch-icon" aria-hidden="true"><use href="#i-reset" /></svg>
            </button>
          </div>
        </div>
        <div className="narch-hero__visual" aria-hidden="true">
          <div className="narch-hub-orb">
            <div className="narch-hub-orb__label">Core intelligence layer</div>
            <div className="narch-hub-orb__title">Asset Management<br />Knowledge Hub</div>
            <div className="narch-hub-orb__meta">Search · Context · Governance · AI</div>
          </div>
        </div>
      </section>

      {/* ── Architecture section ───────────────────────────────────────────── */}
      <section className="narch-section narch-reveal">
        <div className="narch-section-header">
          <div>
            <p className="narch-kicker">Interactive knowledge flow</p>
            <h2 className="narch-section-heading">Explore the architecture by business story</h2>
            <p className="narch-section-desc">Select any card to reveal one connected story. Unrelated items fade so the architecture stays easy to follow.</p>
          </div>
          <span className="narch-status-pill" ref={flowStatusRef}>Ready to explore</span>
        </div>

        <div className="narch-shell" ref={shellRef}>
          <div className="narch-toolbar">
            <span className="narch-toolbar__title">Connected flow</span>
            <span className="narch-toolbar__hint">Choose one card. The relevant path will animate automatically.</span>
            <span className="narch-toolbar__spacer" />
            <button className="narch-btn narch-btn--primary narch-btn--sm" onClick={startDemo} type="button">
              Play walkthrough <svg className="narch-icon" aria-hidden="true"><use href="#i-play" /></svg>
            </button>
          </div>

          <div className="narch-grid">
            {/* Sources */}
            <section className="narch-col">
              <div className="narch-col__header"><span className="narch-col__title">Connected knowledge</span><span className="narch-col__count">10 sources · 4 groups</span></div>
              <div className="narch-col__body">
                {[
                  { id:'operations', icon:'i-asset',    title:'Maximo operational data',       meta:'Assets, work orders, inspections',        mod:'' },
                  { id:'documents',  icon:'i-document', title:'Procedures and documents',       meta:'Manuals, SOPs, service notes',            mod:'teal' },
                  { id:'enterprise', icon:'i-network',  title:'Parts and enterprise systems',   meta:'BOM, OEM, ERP, repositories',             mod:'purple' },
                  { id:'realtime',   icon:'i-sensor',   title:'Real-time and external signals', meta:'IoT, telemetry, trusted web content',     mod:'orange' },
                ].map(c => (
                  <button key={c.id} type="button"
                    className={`narch-card${c.mod ? ` narch-card--${c.mod}` : ''}`}
                    data-id={c.id}
                    data-related={STORIES[c.id] ? Object.keys(STORIES).filter(k => STORIES[k] && k !== c.id).join(',') : ''}
                    onClick={() => onCard(c.id)} onKeyDown={e => onCardKey(e, c.id)}>
                    <span className="narch-card__icon"><svg className="narch-icon" aria-hidden="true"><use href={`#${c.icon}`} /></svg></span>
                    <span><span className="narch-card__title">{c.title}</span><span className="narch-card__meta">{c.meta}</span></span>
                    <svg className="narch-icon narch-card__arrow" aria-hidden="true"><use href="#i-arrow" /></svg>
                  </button>
                ))}
              </div>
            </section>

            <div className="narch-connector" aria-hidden="true"><span className="narch-connector__line" /><span className="narch-connector__pulse" /></div>

            {/* Hub */}
            <section className="narch-col narch-col--hub">
              <div className="narch-col__header"><span className="narch-col__title">Asset Management Knowledge Hub</span><span className="narch-col__count">4 core capabilities</span></div>
              <div className="narch-hub-intro">
                <div className="narch-hub-intro__label">One governed intelligence layer</div>
                <div className="narch-hub-intro__title">Unify, understand, and activate knowledge</div>
                <div className="narch-hub-intro__copy">The hub combines trusted content with the exact asset and work context required for a useful answer.</div>
              </div>
              <div className="narch-col__body">
                {[
                  { id:'index',      icon:'i-database', title:'Unified knowledge index',   meta:'One searchable, traceable foundation',    mod:'' },
                  { id:'retrieval',  icon:'i-search',   title:'Contextual search and RAG', meta:'Intent-aware, grounded evidence',          mod:'purple' },
                  { id:'asset',      icon:'i-asset',    title:'Asset and work context',     meta:'History, hierarchy, plans, conditions',   mod:'green' },
                  { id:'governance', icon:'i-shield',   title:'Trust and governance',       meta:'Access, provenance, auditability',        mod:'orange' },
                ].map(c => (
                  <button key={c.id} type="button"
                    className={`narch-card${c.mod ? ` narch-card--${c.mod}` : ''}`}
                    data-id={c.id}
                    onClick={() => onCard(c.id)} onKeyDown={e => onCardKey(e, c.id)}>
                    <span className="narch-card__icon"><svg className="narch-icon" aria-hidden="true"><use href={`#${c.icon}`} /></svg></span>
                    <span><span className="narch-card__title">{c.title}</span><span className="narch-card__meta">{c.meta}</span></span>
                    <svg className="narch-icon narch-card__arrow" aria-hidden="true"><use href="#i-arrow" /></svg>
                  </button>
                ))}
              </div>
              <div className="narch-assistant-chip" role="button" tabIndex={0}
                data-id="assistant"
                onClick={() => onCard('assistant')} onKeyDown={e => onCardKey(e, 'assistant')}>
                <span className="narch-assistant-chip__icon"><svg className="narch-icon" aria-hidden="true"><use href="#i-ai" /></svg></span>
                <span>
                  <span className="narch-assistant-chip__title">AI maintenance assistant</span>
                  <span className="narch-assistant-chip__text">Turns governed context into a clear, actionable response.</span>
                </span>
              </div>
            </section>

            <div className="narch-connector" aria-hidden="true"><span className="narch-connector__line" /><span className="narch-connector__pulse" /></div>

            {/* Outcomes */}
            <section className="narch-col">
              <div className="narch-col__header"><span className="narch-col__title">Maintenance outcomes</span><span className="narch-col__count">12 use cases · 4 themes</span></div>
              <div className="narch-col__body">
                {[
                  { id:'troubleshoot', icon:'i-tools',  title:'Troubleshoot and resolve',   meta:'Diagnosis, repair, root cause, summaries',  mod:'' },
                  { id:'planning',     icon:'i-plan',   title:'Plan and execute work',        meta:'Job plans, procedures, parts readiness',    mod:'teal' },
                  { id:'performance',  icon:'i-root',   title:'Improve asset performance',    meta:'Health, failure patterns, prediction',      mod:'orange' },
                  { id:'knowledge',    icon:'i-safety', title:'Search, learn, and comply',    meta:'Knowledge access, training, safety, audit', mod:'green' },
                ].map(c => (
                  <button key={c.id} type="button"
                    className={`narch-card${c.mod ? ` narch-card--${c.mod}` : ''}`}
                    data-id={c.id}
                    onClick={() => onCard(c.id)} onKeyDown={e => onCardKey(e, c.id)}>
                    <span className="narch-card__icon"><svg className="narch-icon" aria-hidden="true"><use href={`#${c.icon}`} /></svg></span>
                    <span><span className="narch-card__title">{c.title}</span><span className="narch-card__meta">{c.meta}</span></span>
                    <svg className="narch-icon narch-card__arrow" aria-hidden="true"><use href="#i-arrow" /></svg>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      {/* ── Business value ────────────────────────────────────────────────── */}
      <section className="narch-section narch-reveal">
        <div className="narch-section-header">
          <div>
            <p className="narch-kicker">Business value</p>
            <h2 className="narch-section-heading">Clear outcomes for maintenance teams</h2>
            <p className="narch-section-desc">Four focused value areas show how connected knowledge improves daily maintenance decisions, execution, and trust.</p>
          </div>
        </div>
        <div className="narch-value-grid">
          {[
            { id:'value-speed',       icon:'i-speed',       idx:'01', title:'Faster issue resolution',             desc:'Bring the right procedure, asset history, and current condition together so technicians can diagnose and act sooner.',                                              impact:'Operational impact · Less time searching' },
            { id:'value-consistency', icon:'i-consistency', idx:'02', title:'More consistent work execution',      desc:'Use approved procedures and contextual recommendations to reduce variation across technicians, sites, and shifts.',                                                impact:'Operational impact · Repeatable quality' },
            { id:'value-knowledge',   icon:'i-knowledge',   idx:'03', title:'Knowledge that is easier to reuse',  desc:'Make manuals, service notes, OEM guidance, and expert knowledge discoverable through one natural-language experience.',                                            impact:'Operational impact · Faster knowledge transfer' },
            { id:'value-trust',       icon:'i-trust',       idx:'04', title:'Trusted, auditable decisions',        desc:'Ground AI responses in approved evidence, preserve source provenance, and apply role-based access and audit controls.',                                           impact:'Operational impact · Safer AI adoption' },
          ].map(v => (
            <button key={v.id} type="button" className="narch-value-card"
              data-id={v.id}
              onClick={() => onCard(v.id)} onKeyDown={e => onCardKey(e, v.id)}>
              <span className="narch-value-card__top">
                <span className="narch-value-card__icon"><svg className="narch-icon narch-icon--lg" aria-hidden="true"><use href={`#${v.icon}`} /></svg></span>
                <span className="narch-value-card__index">{v.idx}</span>
              </span>
              <span className="narch-value-card__title">{v.title}</span>
              <span className="narch-value-card__desc">{v.desc}</span>
              <span className="narch-value-card__impact">{v.impact}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Tech foundation ───────────────────────────────────────────────── */}
      <section className="narch-section narch-reveal">
        <div className="narch-section-header">
          <div>
            <p className="narch-kicker">Technology foundation</p>
            <h2 className="narch-section-heading">Only the essential platform view</h2>
            <p className="narch-section-desc">Four building blocks support the experience without overwhelming the architecture story.</p>
          </div>
        </div>
        <div className="narch-foundation">
          <div className="narch-foundation__intro">
            <p className="narch-kicker" style={{ color: '#78a9ff' }}>Composable platform</p>
            <div className="narch-foundation__title">Composable platform foundation</div>
            <p className="narch-foundation__text">A focused foundation for live Maximo context, governed knowledge retrieval, AI reasoning, and an enterprise-grade user experience.</p>
          </div>
          <div className="narch-foundation__tech">
            {[
              { name:'IBM Maximo',                   role:'Live asset, work, location, and inventory context via OSLC REST API' },
              { name:'IBM watsonx.ai',               role:'Granite 3 8B generation + Slate-30M 384-dim embeddings' },
              { name:'OpenSearch :9200',             role:'Hybrid keyword, vector, and metadata retrieval (Podman container)' },
              { name:'MCP Server :6868 + Carbon UI', role:'JSON-RPC / SSE tool layer and IBM Carbon v11 React interface' },
            ].map(t => (
              <div key={t.name} className="narch-tech-tile">
                <div className="narch-tech-tile__name">{t.name}</div>
                <div className="narch-tech-tile__role">{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Side panel overlay ────────────────────────────────────────────── */}
      <div className="narch-overlay" ref={overlayRef} hidden
        onClick={() => closePanel(false)} aria-hidden="true" />

      <aside className="narch-panel" ref={panelRef} aria-hidden="true">
        <div className="narch-panel__header">
          <div>
            <div className="narch-panel__kicker" ref={storyLabelRef}>Architecture overview</div>
            <div className="narch-panel__hint">Selected card details</div>
          </div>
          <button className="narch-panel__close" type="button" aria-label="Close details panel"
            onClick={() => closePanel(false)}>✕</button>
        </div>
        <div className="narch-panel__body">
          <h3 className="narch-panel__title" ref={storyTitleRef}>Select a card to reveal its connected story</h3>
          <p className="narch-panel__text" ref={storyTextRef}>Select any card in the architecture to open a clean detail view.</p>
          <div className="narch-panel__tags" ref={storyTagsRef}>
            <span className="narch-story-tag">Interactive</span>
            <span className="narch-story-tag">Context grounded</span>
            <span className="narch-story-tag">Governed</span>
          </div>
          <div className="narch-panel__section">
            <h4 className="narch-panel__section-title">Flow summary</h4>
            <div className="narch-summary">
              <div className="narch-summary__card"><div className="narch-summary__label">Connected knowledge</div><div className="narch-summary__value" ref={detailSrcRef}>Connected enterprise sources</div></div>
              <div className="narch-summary__card"><div className="narch-summary__label">Hub intelligence</div><div className="narch-summary__value" ref={detailHubRef}>Asset Management Knowledge Hub</div></div>
              <div className="narch-summary__card"><div className="narch-summary__label">Outcome</div><div className="narch-summary__value" ref={detailOutRef}>Trusted maintenance action</div></div>
            </div>
          </div>
          <div className="narch-panel__section">
            <h4 className="narch-panel__section-title">How the highlighted path works</h4>
            <div className="narch-journey">
              <div className="narch-journey__step"><span className="narch-journey__num">01</span><span><span className="narch-journey__label">Knowledge</span><span className="narch-journey__value" ref={jrSrcRef}>Connected enterprise sources</span></span></div>
              <div className="narch-journey__step"><span className="narch-journey__num">02</span><span><span className="narch-journey__label">Intelligence</span><span className="narch-journey__value" ref={jrHubRef}>Asset Management Knowledge Hub</span></span></div>
              <div className="narch-journey__step"><span className="narch-journey__num">03</span><span><span className="narch-journey__label">Outcome</span><span className="narch-journey__value" ref={jrOutRef}>Trusted maintenance action</span></span></div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
