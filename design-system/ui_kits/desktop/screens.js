window.PvScreens = function (P) {
  const D = window.PvData;
  const { ChapterList, Desk, Sheet, Paragraph, FloatingBar, Segmented, SearchField, SectionLabel, SidebarItem, NoteCard, NoteLink, AsideList,
    QuickAdd, BoardColumn, TodoSlip, BrandMark, SavedIndicator, LangBadge, Icon, Stat, ContinueCard, ProjectCard, NewProjectTile, DecorCircles,
    Button, ThemeSwatch, FontChoice, Slider, Toggle, SettingRow, ChapterPanel, ChecklistItem, NoteMini, ThemeSwitch, ChapterStrip, ProjectRow, HomeSection } = P;

  function WriteScreen({ zen, onZen, ambience, panels, setPanels, onOpenNotes }) {
    const [ch, setCh] = React.useState(2);
    const [ptodos, setPtodos] = React.useState(D.panelTodos);
    const page = D.pages[ch];
    const next = { open: 'doing', doing: 'done', done: 'open' };
    const showPanel = !zen && (panels.todos || panels.notes);
    return (<>
      {!zen && <ChapterList chapters={D.chapters} activeIndex={ch} onSelect={setCh} />}
      <Desk>
        {page ? (
          <Sheet project="The Lantern House" folio={page.folio} chapterLabel={page.label} title={page.title}>
            {page.paras.map((p, i) => <Paragraph key={i} dropCap={i === 0} caret={i === page.paras.length - 1}>{p}</Paragraph>)}
          </Sheet>
        ) : (
          <Sheet project="The Lantern House" folio={['I', 'II', 'III', 'IV', 'V'][ch]} chapterLabel={'Chapter ' + ['One', 'Two', 'Three', 'Four', 'Five'][ch]} title={D.chapters[ch].title || 'Untitled'}>
            <Paragraph dropCap caret>{'Sample text for this chapter is not part of the design.'}</Paragraph>
          </Sheet>
        )}
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)' }}>
          <FloatingBar ambience={ambience} words={1412} today={340} goal={500} onZen={onZen} zenLabel={zen ? 'Exit Zen' : 'Zen'} />
        </div>
      </Desk>
      {showPanel && <ChapterPanel chapterLabel={'Chapter ' + (ch + 1)} title={D.chapters[ch].title || 'Untitled'} showTodos={panels.todos} showNotes={panels.notes}
        todos={ch === 2 ? ptodos : []} notes={ch === 2 ? D.panelNotes : []}
        onTodoToggle={(i) => setPtodos(ptodos.map((t, j) => j === i ? { ...t, state: next[t.state] } : t))}
        onAddTodo={(text) => setPtodos([...ptodos, { text, state: 'open' }])}
        onClose={() => setPanels({ todos: false, notes: false })} onOpenNotes={onOpenNotes} />}
    </>);
  }

  function PaneSwitch({ pane, setPane }) {
    return <Segmented block value={pane} onChange={setPane} options={[{ value: 'notes', label: 'Notes', count: 12 }, { value: 'todos', label: 'To-dos', count: 6 }]} />;
  }
  const side = { width: 'var(--pv-sidebar-wide-w)', flex: 'none', borderRight: '1px solid var(--pv-line)', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2, boxSizing: 'border-box' };

  function NotesScreen({ pane, setPane }) {
    const [sel, setSel] = React.useState(0);
    const [notes, setNotes] = React.useState(D.notes);
    const [q, setQ] = React.useState('');
    const n = notes[sel];
    const groups = ['Characters', 'Places', 'Research'];
    const next = { open: 'doing', doing: 'done', done: 'open' };
    const go = (title) => { const i = notes.findIndex((x) => x.title === title); if (i >= 0) setSel(i); };
    return (<>
      <div style={side}>
        <PaneSwitch pane={pane} setPane={setPane} />
        <SearchField placeholder="Search notes" value={q} onChange={setQ} style={{ margin: '10px 0 2px' }} />
        {groups.map((g) => {
          const items = notes.map((x, i) => [x, i]).filter(([x]) => x.group === g && (!q || x.title.toLowerCase().includes(q.toLowerCase())));
          if (!items.length) return null;
          return <React.Fragment key={g}><SectionLabel>{g}</SectionLabel>{items.map(([x, i]) => <SidebarItem key={i} title={x.title} subtitle={x.sub} active={i === sel} onClick={() => setSel(i)} />)}</React.Fragment>;
        })}
        <div style={{ flex: 1 }} />
        <Button variant="ghost" style={{ alignSelf: 'flex-start' }}>+ New note</Button>
      </div>
      <Desk padding="36px 0 0">
        <NoteCard kind={n.kind} edited={n.edited} title={n.title} fields={n.fields} todos={n.todos}
          onTodoToggle={(i) => setNotes(notes.map((x, j) => j !== sel ? x : { ...x, todos: x.todos.map((t, k) => k === i ? { ...t, state: next[t.state] } : t) }))}>
          {n.body.map((b, i) => typeof b === 'string' ? b : <NoteLink key={i} onClick={() => go(b.link)}>{b.link}</NoteLink>)}
        </NoteCard>
      </Desk>
      <div style={{ width: 'var(--pv-aside-w)', flex: 'none', borderLeft: '1px solid var(--pv-line)', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 22, boxSizing: 'border-box' }}>
        {n.appears.length > 0 && <AsideList title="Appears in" items={n.appears.map(([l, v]) => ({ label: l, value: v }))} />}
        {n.links.length > 0 && <AsideList title="Linked notes" items={n.links.map((l) => ({ label: l, link: true }))} onItem={(it) => go(it.label)} />}
      </div>
    </>);
  }

  function TodosScreen({ pane, setPane }) {
    const [todos, setTodos] = React.useState(D.todos);
    const [filter, setFilter] = React.useState('open');
    const move = (i) => setTodos(todos.map((t, j) => j !== i ? t : { ...t, col: { todo: 'doing', doing: 'done', done: 'todo' }[t.col] }));
    const shown = todos.map((t, i) => [t, i]).filter(([t]) => filter === 'open' ? true : filter === 'notes' ? t.tags.some((g) => g.kind === 'note') : t.ch === filter);
    const open = todos.filter((t) => t.col !== 'done');
    const count = (f) => open.filter(f).length;
    const cols = [['todo', 'To do'], ['doing', 'Doing'], ['done', 'Done']];
    return (<>
      <div style={side}>
        <PaneSwitch pane={pane} setPane={setPane} />
        <SectionLabel>Show</SectionLabel>
        <SidebarItem title="Open to-dos" count={open.length} active={filter === 'open'} onClick={() => setFilter('open')} />
        <SidebarItem title="From notes" count={count((t) => t.tags.some((g) => g.kind === 'note'))} active={filter === 'notes'} onClick={() => setFilter('notes')} />
        <SectionLabel>By chapter</SectionLabel>
        {[[1, '1 · The Letter'], [3, "3 · Grandmother's Keys"], [4, '4 · The Attic'], [0, 'Whole book']].map(([c, l]) => <SidebarItem key={c} title={l} count={count((t) => t.ch === c)} active={filter === c} onClick={() => setFilter(c)} />)}
      </div>
      <Desk padding="26px 32px" align="flex-start" style={{ flexDirection: 'column', gap: 22 }}>
        <QuickAdd style={{ width: 560 }} onAdd={(text) => setTodos([{ text, col: 'todo', tags: [{ label: 'Whole book' }], ch: 0 }, ...todos])} />
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', width: '100%', position: 'relative' }}>
          {cols.map(([k, l]) => {
            const items = shown.filter(([t]) => t.col === k);
            return <BoardColumn key={k} title={l} status={k} count={items.length}>{items.map(([t, i]) => <TodoSlip key={i} text={t.text} tags={t.tags} done={k === 'done'} onClick={() => move(i)} />)}</BoardColumn>;
          })}
        </div>
      </Desk>
    </>);
  }

  function PlaceholderScreen({ name }) {
    return <Desk padding="0" style={{ alignItems: 'center' }}><div style={{ position: 'relative', textAlign: 'center', color: 'var(--pv-text-faint)', fontSize: 13.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: 'var(--pv-font-heading)', fontSize: 21, color: 'var(--pv-text)' }}>{name}</span>Not designed yet.</div></Desk>;
  }

  function HomeScreen({ onOpen, onZen, onSettings, theme, setTheme, onTodos, onNotes, ambience }) {
    const night = theme === 'moonlit' || theme === 'candlelit';
    return (<div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <DecorCircles variant="home" />
      <span aria-hidden="true" style={{ position: 'absolute', left: -90, bottom: -110, width: 260, height: 260, borderRadius: '50%', background: 'var(--pv-decor-2)', opacity: 0.45 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 40px', height: 60, borderBottom: '1px solid var(--pv-divider)', position: 'relative', flex: 'none' }}>
        <BrandMark size={26} withName />
        <div style={{ flex: 1 }} />
        <SavedIndicator size="lg" label="Backed up to Google Drive · 12 min ago" />
        <span style={{ width: 1, height: 18, background: 'var(--pv-divider)', margin: '0 6px' }} />
        <ThemeSwitch value={theme === 'sunset' ? 'daylight' : theme} onChange={setTheme} />
        <LangBadge code="EN" size="lg" />
        <button type="button" className="pv-reset pv-i" onClick={onSettings} title="Settings" style={{ color: 'var(--pv-text-muted)', padding: 3, borderRadius: 3, display: 'flex' }}><Icon name="settings" size={18} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 440px', gap: 56, padding: '36px 64px 0', position: 'relative', flex: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--pv-text-faint)', fontWeight: 600 }}>{night ? 'Thursday, 2 October · 23:15' : 'Thursday, 2 October · 18:40'}</div>
          <div style={{ font: '46px/1.08 var(--pv-font-heading)', maxWidth: 560, textWrap: 'pretty' }}>{night ? 'Late again. The attic is waiting.' : 'Good evening. Ana is still in the kitchen.'}</div>
          <div style={{ display: 'flex', gap: 40, marginTop: 14 }}><Stat value={340} of={500} label="words today" /><Stat value={9} label="day streak" /><Stat value="48,930" of="80k" label="in the book" /></div>
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--pv-divider)' }}><ChapterStrip book="The Lantern House" chapters={D.chapters} activeIndex={2} onSelect={onOpen} /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ContinueCard height={250} project="The Lantern House" location="Ch. III · p. 47" previous="…as if they had been waiting in the dark for someone to remember them."
            current={'"Start with the attic," her mother said from the kitchen, without turning around.'} meta="Edited 2 h ago" onContinue={onOpen} onZen={onZen} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--pv-text-subtle)', paddingLeft: 2 }}><Icon name={ambience.icon} size={13} />{ambience.label} will play when you start · <span style={{ color: 'var(--pv-accent)', fontWeight: 600 }}>Change</span></div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 44, padding: '30px 64px 0', position: 'relative', minHeight: 0 }}>
        <HomeSection title="Open to-dos" count={6} link="All to-dos →" onLink={onTodos}>
          {D.todos.filter((t) => t.col !== 'done').sort((a, b) => (a.col === 'doing' ? -1 : 0) - (b.col === 'doing' ? -1 : 0)).slice(0, 4).map((t, i) =>
            <ChecklistItem key={i} truncate padding="6px 0" text={t.text} state={t.col === 'doing' ? 'doing' : 'open'} meta={t.tags.map((g) => g.label).join(' · ')} />)}
        </HomeSection>
        <HomeSection title="Recent notes" count={12} link="All notes →" onLink={onNotes}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <NoteMini variant="card" kind="Place" title="The attic" meta="Edited today" onClick={onNotes} />
            <NoteMini variant="card" kind="Character" title="Ana Novak" meta="Yesterday" onClick={onNotes} />
            <NoteMini variant="card" kind="Research" title="Ljubljana trams, 1950s" meta="Sept" onClick={onNotes} />
          </div>
        </HomeSection>
        <HomeSection title="Projects" count={3} link="+ New">
          <ProjectRow kind="Novel" title="The Lantern House" lang="EN" status="61%" progress={0.61} stacked onClick={onOpen} />
          <ProjectRow kind="Kratke zgodbe" title="Zgodbe ob reki" lang="SL" status="6 of 12" progress={0.5} tone="success" stacked />
          <ProjectRow kind="Article" title="Why I write by hand first" lang="EN" status="Final" progress={1} tone="success" />
        </HomeSection>
      </div>
    </div>);
  }

  function SettingsWindow({ theme, setTheme, onClose }) {
    const [sec, setSec] = React.useState('Appearance');
    const [font, setFont] = React.useState('Literata');
    const [size, setSize] = React.useState(17);
    const [width, setWidth] = React.useState('Book');
    const [grain, setGrain] = React.useState(true);
    const [head, setHead] = React.useState(true);
    const [tw, setTw] = React.useState(false);
    const sections = ['General', 'Writing & goals', 'Appearance', 'Ambience', 'Backup & export', 'Language', 'Shortcuts'];
    const lab = { fontSize: 12.5, fontWeight: 600, color: 'var(--pv-text-muted)' };
    return (<div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--pv-scrim)', display: 'grid', placeItems: 'center', zIndex: 10 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 880, height: 620, borderRadius: 'var(--pv-radius-window)', background: 'var(--pv-chrome)', boxShadow: 'var(--pv-shadow-window)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: 34, borderBottom: '1px solid var(--pv-line)', fontSize: 12.5 }}>
          <span style={{ flex: 1, fontWeight: 600 }}>Settings</span>
          <button type="button" className="pv-reset pv-i" onClick={onClose} title="Close" style={{ display: 'flex', padding: 3, borderRadius: 3, color: 'var(--pv-text-subtle)' }}><Icon name="x" size={14} strokeWidth={2} /></button>
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ width: 'var(--pv-settings-nav-w)', borderRight: '1px solid var(--pv-line)', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 1, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
            {sections.map((s) => <SidebarItem key={s} title={s} active={s === sec} onClick={() => setSec(s)} />)}
            <DecorCircles variant="settings" />
          </div>
          {sec !== 'Appearance' ? (
            <div style={{ flex: 1, padding: '22px 36px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ font: '22px var(--pv-font-heading)' }}>{sec}</div><div style={{ fontSize: 13.5, color: 'var(--pv-text-faint)' }}>Not designed yet.</div>
            </div>
          ) : (
            <div style={{ flex: 1, padding: '22px 36px', display: 'flex', flexDirection: 'column', gap: 18, overflow: 'auto' }}>
              <div style={{ font: '22px var(--pv-font-heading)' }}>Appearance</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={lab}>Theme</div>
                <div style={{ display: 'flex', gap: 14 }}>
                  {[['daylight', 'Daylight'], ['candlelit', 'Candlelit'], ['moonlit', 'Moonlit'], ['sunset', 'Follow sunset']].map(([k, l]) => <ThemeSwatch key={k} theme={k} label={l} selected={theme === k} onClick={() => setTheme(k)} />)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={lab}>Manuscript font</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['var(--pv-font-manuscript)', 'Literata', 20], ['var(--pv-font-garamond)', 'Garamond', 21], ['var(--pv-font-typewriter)', 'Typewriter', 18]].map(([f, nm, z]) => <FontChoice key={nm} family={f} name={nm} sampleSize={z} selected={font === nm} onClick={() => setFont(nm)} />)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                <Slider label="Text size" value={size} onChange={setSize} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><div style={lab}>Page width</div><Segmented options={['Narrow', 'Book', 'Wide']} value={width} onChange={setWidth} /></div>
              </div>
              <div style={{ borderTop: '1px solid var(--pv-line)' }}>
                <SettingRow label="Paper grain"><Toggle checked={grain} onChange={setGrain} label="Paper grain" /></SettingRow>
                <SettingRow label="Running head and page numbers"><Toggle checked={head} onChange={setHead} label="Running head" /></SettingRow>
                <SettingRow label="Typewriter scrolling" hint="keeps the current line centred" last><Toggle checked={tw} onChange={setTw} label="Typewriter scrolling" /></SettingRow>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>);
  }

  return { HomeScreen, WriteScreen, NotesScreen, TodosScreen, SettingsWindow, PlaceholderScreen };
};
