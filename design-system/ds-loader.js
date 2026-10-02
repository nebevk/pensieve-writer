/* Loads the Pensieve components for cards and the UI kit.
   Uses the compiled _ds_bundle.js when present; otherwise compiles the .jsx sources in the browser. */
(function () {
  var root = document.currentScript.src.replace(/ds-loader\.js.*$/, '');
  var FILES = ["components/core/Icon.jsx","components/core/Button.jsx","components/core/Tag.jsx","components/core/LangBadge.jsx","components/core/SavedIndicator.jsx","components/core/BrandMark.jsx","components/core/DecorCircles.jsx","components/chrome/ViewTabs.jsx","components/chrome/ToolButton.jsx","components/chrome/ToolDivider.jsx","components/chrome/ToolGroup.jsx","components/chrome/StyleSelect.jsx","components/chrome/Toolbar.jsx","components/chrome/TitleBar.jsx","components/chrome/FloatingBar.jsx","components/navigation/StatusDot.jsx","components/navigation/ChapterItem.jsx","components/navigation/ChapterList.jsx","components/navigation/SectionLabel.jsx","components/navigation/SidebarItem.jsx","components/navigation/AsideList.jsx","components/forms/Segmented.jsx","components/forms/SearchField.jsx","components/forms/Toggle.jsx","components/forms/Slider.jsx","components/forms/Checkbox.jsx","components/forms/FontChoice.jsx","components/forms/ThemeSwatch.jsx","components/forms/SettingRow.jsx","components/manuscript/Desk.jsx","components/manuscript/Caret.jsx","components/manuscript/Paragraph.jsx","components/manuscript/Sheet.jsx","components/notes/NoteLink.jsx","components/notes/TodoItem.jsx","components/notes/NoteCard.jsx","components/notes/TodoSlip.jsx","components/notes/BoardColumn.jsx","components/notes/QuickAdd.jsx","components/home/Stat.jsx","components/home/ContinueCard.jsx","components/home/ProjectCard.jsx","components/home/NewProjectTile.jsx"];
  function load(src) { return new Promise(function (res) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = res; document.head.appendChild(s); }); }
  function findNS() {
    var keys = Object.keys(window);
    for (var i = 0; i < keys.length; i++) {
      try { var v = window[keys[i]]; if (v && typeof v === 'object' && typeof v.Sheet === 'function' && typeof v.TitleBar === 'function' && typeof v.NoteCard === 'function') return v; } catch (e) {}
    }
    return null;
  }
  window.PensieveDS = { ready: (async function () {
    if (!window.React) await load('https://unpkg.com/react@18.3.1/umd/react.development.js');
    if (!window.ReactDOM) await load('https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js');
    await load(root + '_ds_bundle.js');
    var ns = findNS();
    if (ns) return ns;
    if (!window.Babel) await load('https://unpkg.com/@babel/standalone@7.29.0/babel.min.js');
    var srcs = await Promise.all(FILES.map(function (f) { return fetch(root + f).then(function (r) { return r.text(); }); }));
    var names = FILES.map(function (f) { return f.split('/').pop().replace('.jsx', ''); });
    var body = srcs.map(function (s) { return s.replace(/^\s*import[^\n]*\n/gm, '').replace(/^export\s+/gm, ''); }).join('\n');
    var code = '(function(React){' + body + '\nreturn {' + names.join(',') + '};})';
    var out = Babel.transform(code, { presets: ['react'] }).code;
    var api = (0, eval)(out)(window.React);
    window.Pensieve = api;
    return api;
  })() };
})();
