// @ts-nocheck
// Stands in for the Pensieve desktop window in a plain browser, for testing only: answers the SQL
// plugin with sql.js (one in-memory database per project file) and the app's own commands with a
// pretend disk of folders and files. Load sql-asm.js first; it defines initSqlJs.
(() => {
  const sqlReady = window.initSqlJs();
  const books = new Map();
  const callbacks = new Map();
  let nextCallback = 1;
  // The app folder, where books lived before the library, and the writer's Documents and home folders.
  const HOME = "C:\\Books\\Pensieve";
  const USER = "C:\\Users\\Eva";
  const DOCS = window.__PV_DOCUMENTS__ ?? `${USER}\\Documents`;
  window.isTauri = true;
  // Folders on the pretend disk, by lower-case path, with their own spelling.
  const folders = new Map();
  window.__PV_HARNESS__ = { books, calls: [], folders, copies: [] };

  const lower = (path) => path.toLowerCase();
  const parentOf = (path) => path.slice(0, Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/")));
  const addFolder = (path) => {
    let at = path;
    while (at && !folders.has(lower(at)) && /[\\/]/.test(at)) {
      folders.set(lower(at), at);
      at = parentOf(at);
    }
  };
  addFolder(HOME);
  addFolder(DOCS);
  addFolder(USER);

  const clean = (value) => (value === undefined ? null : typeof value === "boolean" ? (value ? 1 : 0) : value);
  // The app writes $1, $2 … in its queries; sql.js binds those by name.
  const bindOf = (query, values) => {
    const list = (values ?? []).map(clean);
    if (!/\$\d/.test(query)) return list;
    const named = {};
    list.forEach((value, index) => (named[`$${index + 1}`] = value));
    return named;
  };
  const rowsOf = (db, query, values) => {
    const statement = db.prepare(query);
    try {
      statement.bind(bindOf(query, values));
      const rows = [];
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  };

  // With window.__PV_SQL_WORKER__ set (the speed checks), sql.js runs in a worker, as the real database runs in
  // Rust: a save then costs the page what the app's own calls cost it (its JSON, the messages), not the stand-in's
  // SQL. `books` holds a handle for each file instead of its database; books aren't kept between page loads.
  const worker = window.__PV_SQL_WORKER__ ? startWorker() : null;
  function startWorker() {
    const main = () => {
      const ready = initSqlJs();
      const dbs = new Map();
      let next = 1;
      onmessage = async ({ data: { id, op, wid, query, values, bytes } }) => {
        try {
          const SQL = await ready;
          let result = null;
          if (op === "open" || op === "copy") {
            dbs.set(next, new SQL.Database(op === "copy" ? dbs.get(wid).export() : (bytes ?? undefined)));
            result = next++;
          } else if (op === "execute") {
            const db = dbs.get(wid);
            db.run(query, bindOf(query, values));
            result = [db.getRowsModified(), db.exec("SELECT last_insert_rowid()")[0]?.values?.[0]?.[0] ?? 0];
          } else if (op === "select") {
            result = rowsOf(dbs.get(wid), query, values);
          }
          postMessage({ id, result });
        } catch (error) {
          postMessage({ id, error: String(error?.message ?? error) });
        }
      };
    };
    const source = `${window.__PV_SQL_SOURCE__}\n;const clean = ${clean};\nconst bindOf = ${bindOf};\nconst rowsOf = ${rowsOf};\n(${main})();`;
    const thread = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
    const waiting = new Map();
    let nextId = 1;
    thread.onmessage = ({ data }) => {
      const { resolve, reject } = waiting.get(data.id);
      waiting.delete(data.id);
      if ("error" in data) reject(new Error(data.error));
      else resolve(data.result);
    };
    return (message) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        waiting.set(id, { resolve, reject });
        thread.postMessage({ ...message, id });
      });
  }

  // With window.__PV_KEEP__ set, books outlive a page load (in localStorage), like files on disk.
  const kept = (path) => `pv-db:${path}`;
  const keep = (path) => {
    if (worker) return;
    const bytes = books.get(path).export();
    let text = "";
    for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
    localStorage.setItem(kept(path), btoa(text));
  };
  const bytesOf = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  };
  // window.__PV_SEED__ maps a book path to a prepared database (base64), like a file already on disk.
  // It is decoded now, before the app starts, so timing the app does not time this.
  const seeds = new Map(Object.entries(window.__PV_SEED__ ?? {}).map(([path, base64]) => [path, bytesOf(base64)]));
  for (const key of seeds.keys()) addFolder(parentOf(key.replace(/^sqlite:/, "")));
  if (window.__PV_KEEP__) {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) ?? "";
      if (key.startsWith("pv-db:sqlite:")) addFolder(parentOf(key.slice("pv-db:sqlite:".length)));
    }
    for (const path of JSON.parse(localStorage.getItem("pv-folders") ?? "[]")) addFolder(path);
  }
  const keepFolders = () => {
    if (window.__PV_KEEP__) localStorage.setItem("pv-folders", JSON.stringify([...folders.values()]));
  };
  /** A file's bytes when it is already on the pretend disk (seeded, or kept from an earlier page), else null. */
  const bytesFor = (path) => {
    if (seeds.has(path)) return seeds.get(path);
    const saved = window.__PV_KEEP__ ? localStorage.getItem(kept(path)) : null;
    return saved ? bytesOf(saved) : null;
  };
  const opened = async (path) => {
    if (worker) return { wid: await worker({ op: "open", bytes: bytesFor(path) }) };
    const SQL = await sqlReady;
    return new SQL.Database(bytesFor(path) ?? undefined);
  };
  /** Whether a file is on the pretend disk: loaded in this page, seeded, or kept from an earlier one. */
  const fileExists = (path) => {
    const key = lower(`sqlite:${path}`);
    for (const name of books.keys()) if (lower(name) === key) return true;
    for (const name of seeds.keys()) if (lower(name) === key) return true;
    if (window.__PV_KEEP__) {
      for (let index = 0; index < localStorage.length; index += 1) {
        if (lower(localStorage.key(index) ?? "") === lower(kept(`sqlite:${path}`))) return true;
      }
    }
    return false;
  };
  window.__PV_HARNESS__.stacks = [];
  const dirty = new Set();
  const keepAll = () => {
    for (const path of dirty) keep(path);
    dirty.clear();
  };
  window.__PV_HARNESS__.keepAll = keepAll;
  addEventListener("pagehide", keepAll);
  addEventListener("beforeunload", keepAll);
  /** A clean disk for the next page load: nothing kept from this one. */
  window.__PV_HARNESS__.forget = () => {
    dirty.clear();
    removeEventListener("pagehide", keepAll);
    removeEventListener("beforeunload", keepAll);
    localStorage.clear();
  };

  // The same rules and English messages as src-tauri/src/library.rs.
  const folderName = (name) => {
    const trimmed = String(name).trim().replace(/[.\s]+$/, "");
    if (!trimmed || trimmed === "." || trimmed === "..") throw "Give the folder a name";
    if ([...trimmed].length > 120) throw "That name is too long for a folder";
    if (/[\\/:*?"<>|\u0000-\u001f]/.test(trimmed)) throw "A folder name can't have \\ / : * ? \" < > or |";
    if (/^[.$]/.test(trimmed)) throw "A folder name can't start with . or $";
    if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(trimmed)) throw "Windows keeps that name for itself; choose another";
    return trimmed;
  };
  const createFolder = (parent, name) => {
    addFolder(parent);
    const path = `${parent.replace(/[\\/]+$/, "")}\\${folderName(name)}`;
    if (folders.has(lower(path)) || fileExists(path)) throw "Something with that name is already there";
    addFolder(path);
    keepFolders();
    return path;
  };
  /** The library as library.rs lists it: folders, and projects (folders holding pensieve.db). */
  const listFolder = (folder, depth, open = "") => {
    const prefix = `${lower(folder.replace(/[\\/]+$/, ""))}\\`;
    const children = [...folders.entries()].filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("\\"));
    return children
      .filter(([, path]) => !path.split(/[\\/]/).pop().startsWith("."))
      .map(([, path]) => {
        const project = fileExists(`${path}\\pensieve.db`);
        return {
          name: path.split(/[\\/]/).pop(),
          path,
          project,
          file: false,
          // Only the open project's own files and folders are listed, as library.rs does.
          children: depth >= 6 ? [] : project ? (open && lower(path) === lower(open) ? listFolder(path, depth + 1) : []) : listFolder(path, depth + 1, open),
        };
      })
      .reverse()
      .concat(
        [...files.values()]
          .filter((file) => lower(parentOf(file.path)) === prefix.slice(0, -1))
          .map((file) => ({ name: file.path.split(/[\\/]/).pop(), path: file.path, project: false, file: true, children: [] }))
          .filter((file) => !/^(\.|\$|~\$)/.test(file.name) && !file.name.toLowerCase().startsWith("pensieve.db")),
      );
  };

  // Her files on the pretend disk (pictures, PDFs, Word files), by lower-case path: { path, base64 }. Seeded
  // through localStorage "pv-files" ({ path: base64 }) before the page loads.
  const files = new Map();
  for (const [path, base64] of Object.entries(JSON.parse(localStorage.getItem("pv-files") ?? "{}"))) {
    files.set(lower(path), { path, base64 });
    addFolder(parentOf(path));
  }
  window.__PV_HARNESS__.files = files;
  window.__PV_HARNESS__.opened = [];
  window.__PV_HARNESS__.revealed = [];
  // Links opened in her browser or mail program (links.rs open_link).
  window.__PV_HARNESS__.links = [];
  // The copies Pensieve keeps in its own folder (kept.rs), kept between page loads: { "kind/name": { contents, modified } }.
  const KEPT = `${USER}\\AppData\\Roaming\\com.pensieve.app\\Kept copies`;
  const keptFolder = (kind) => `${KEPT}\\${kind === "rescue" ? "Rescue" : "Deleted writings"}`;
  const keptCopies = new Map(Object.entries(JSON.parse(localStorage.getItem("pv-kept") ?? "{}")));
  const keepCopies = () => localStorage.setItem("pv-kept", JSON.stringify(Object.fromEntries(keptCopies)));
  window.__PV_HARNESS__.keptCopies = keptCopies;
  // Raises a window event as Tauri does: "tauri://close-requested" when her ✕ asks the window to close.
  window.__PV_HARNESS__.emit = (event, payload = null) => {
    for (const listener of window.__PV_HARNESS__.listeners ?? []) {
      if (listener.event === event) callbacks.get(listener.handler)?.({ event, id: listener.handler, payload });
    }
  };
  const PROGRAMS = /\.(appref-ms|application|bat|chm|cmd|com|cpl|exe|gadget|hta|inf|jar|js|jse|lnk|msc|msi|msp|pif|ps1|psm1|reg|scf|scr|sct|url|vb|vbe|vbs|ws|wsc|wsf|wsh)$/i;

  // Database files open now: Windows won't move a folder with one of them inside.
  const openPools = new Set();
  window.__PV_HARNESS__.openPools = openPools;
  const within = (path, folder) => lower(path) === lower(folder) || lower(path).startsWith(`${lower(folder)}\\`);
  // library.rs in_library: a folder inside the library, never the library itself.
  const inLibrary = (path, library) => Boolean(library) && lower(path).startsWith(`${lower(library)}\\`);
  /** library.rs move_entry on the pretend disk: folders, files kept or loaded, all follow. */
  const moveFolder = (from, parent, name, library) => {
    from = String(from).replace(/[\\/]+$/, "");
    parent = String(parent).replace(/[\\/]+$/, "");
    library = String(library ?? "").replace(/[\\/]+$/, "");
    if (!folders.has(lower(from))) throw "That folder isn't there any more";
    if (!inLibrary(from, library) || !(lower(parent) === lower(library) || inLibrary(parent, library))) {
      throw "Only a folder of the library can be moved or deleted from here";
    }
    if (!folders.has(lower(parent))) throw "Choose a folder that exists";
    const to = `${parent}\\${folderName(name)}`;
    if (lower(to).startsWith(`${lower(from)}\\`)) throw "A folder can't go inside itself";
    if (lower(to) === lower(from)) {
      if (to === from) return from;
    } else if (folders.has(lower(to)) || fileExists(to)) {
      throw "Something with that name is already there";
    }
    for (const db of openPools) if (within(db.replace(/^sqlite:/, ""), from)) throw "That folder is in use; close what has it open and try again";
    const moved = (path) => `${to}${path.slice(from.length)}`;
    for (const [key, spelled] of [...folders]) {
      if (!within(spelled, from)) continue;
      folders.delete(key);
      folders.set(lower(moved(spelled)), moved(spelled));
    }
    for (const [key, db] of [...books]) {
      const path = key.replace(/^sqlite:/, "");
      if (!within(path, from)) continue;
      books.delete(key);
      books.set(`sqlite:${moved(path)}`, db);
      if (dirty.delete(key)) dirty.add(`sqlite:${moved(path)}`);
    }
    for (const [key, file] of [...files]) {
      if (!within(file.path, from)) continue;
      files.delete(key);
      files.set(lower(moved(file.path)), { ...file, path: moved(file.path) });
    }
    if (window.__PV_KEEP__) {
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith("pv-db:sqlite:")) continue;
        const path = key.slice("pv-db:sqlite:".length);
        if (!within(path, from)) continue;
        localStorage.setItem(`pv-db:sqlite:${moved(path)}`, localStorage.getItem(key));
        localStorage.removeItem(key);
      }
    }
    keepFolders();
    return to;
  };

  const UNREACHABLE = "error returned from database: (code: 14) unable to open database file";
  async function handle(cmd, args, options) {
    window.__PV_HARNESS__.calls.push(args.query ? `${cmd} ${args.query.replace(/\s+/g, " ").trim().slice(0, 80)}` : cmd);
    if (window.__PV_STACKS__ && args.query && window.__PV_STACKS__.test(args.query)) {
      window.__PV_HARNESS__.stacks.push(`${args.query.replace(/\s+/g, " ").trim().slice(0, 60)}\n${new Error().stack}`);
    }
    switch (cmd) {
      case "plugin:sql|load": {
        // failOpen: files whose path holds these words won't open, as a broken copy wouldn't.
        if (window.__PV_HARNESS__.failOpen && args.db.includes(window.__PV_HARNESS__.failOpen)) throw UNREACHABLE;
        addFolder(parentOf(args.db.replace(/^sqlite:/, "")));
        if (!books.has(args.db)) {
          const db = await opened(args.db);
          // Two loads of one file at once: the first one opened is the file.
          if (!books.has(args.db)) books.set(args.db, db);
        }
        openPools.add(args.db);
        return args.db;
      }
      case "plugin:sql|execute": {
        if (window.__PV_HARNESS__.failSaves) throw UNREACHABLE;
        const db = books.get(args.db);
        // VACUUM INTO writes a copy of the database file beside it; here it is one more pretend file.
        const into = /^\s*VACUUM\s+INTO\s+\$1\s*$/i.exec(args.query);
        if (into) {
          const target = String((args.values ?? [])[0]);
          books.set(`sqlite:${target}`, worker ? { wid: await worker({ op: "copy", wid: db.wid }) } : new (await sqlReady).Database(db.export()));
          window.__PV_HARNESS__.copies.push(target);
          return [0, 0];
        }
        if (worker) return worker({ op: "execute", wid: db.wid, query: args.query, values: args.values });
        db.run(args.query, bindOf(args.query, args.values));
        const changes = db.getRowsModified();
        const last = db.exec("SELECT last_insert_rowid()")[0]?.values?.[0]?.[0] ?? 0;
        // Kept when the page goes, not after every write: copying every database each time runs sql.js out of memory.
        if (window.__PV_KEEP__) dirty.add(args.db);
        return [changes, last];
      }
      case "plugin:sql|select":
        if (window.__PV_HARNESS__.failSaves) throw UNREACHABLE;
        if (worker) return worker({ op: "select", wid: books.get(args.db).wid, query: args.query, values: args.values });
        return rowsOf(books.get(args.db), args.query, args.values);
      case "plugin:sql|close":
        if (args.db) openPools.delete(args.db);
        else openPools.clear();
        return true;
      case "plugin:event|listen":
        (window.__PV_HARNESS__.listeners ??= []).push({ event: args.event, handler: args.handler });
        return args.handler ?? 0;
      case "plugin:window|destroy":
        window.__PV_HARNESS__.destroyed = true;
        return null;
      case "plugin:window|is_maximized":
        return false;
      case "default_project_path":
        return `${HOME}\\pensieve.db`;
      case "read_prefs":
        return "";
      case "project_file_exists":
        return fileExists(args.path);
      case "reserve_project_path":
        return `${args.folder}\\pensieve.db`;
      case "example_book_path": {
        const path = `${HOME}\\examples\\${args.name}.db`;
        return { path, exists: fileExists(path) };
      }
      case "settle_project_copy": {
        // project.rs settle_project_copy: the copy VACUUM INTO wrote, in place as the folder's pensieve.db.
        const copy = books.get(`sqlite:${args.copy}`);
        if (!copy || lower(parentOf(args.copy)) !== lower(String(args.folder).replace(/[\\/]+$/, ""))) throw "The project file was not found";
        const dest = `${String(args.folder).replace(/[\\/]+$/, "")}\\pensieve.db`;
        books.delete(`sqlite:${args.copy}`);
        if (fileExists(dest)) throw "That folder already contains a pensieve.db file";
        books.set(`sqlite:${dest}`, copy);
        if (window.__PV_KEEP__) dirty.add(`sqlite:${dest}`);
        return dest;
      }
      // session.rs: what Windows shows while Pensieve saves at a shutdown, and that the page has saved.
      case "session_reason":
        window.__PV_HARNESS__.sessionReason = args.text;
        return null;
      case "session_saved":
        window.__PV_HARNESS__.sessionSaved = (window.__PV_HARNESS__.sessionSaved ?? 0) + 1;
        return null;
      case "library_places":
        return { documents: DOCS, home: USER };
      case "list_library":
        return folders.has(lower(args.folder)) ? listFolder(args.folder, 1, String(args.open ?? "").replace(/[\\/]+$/, "")) : [];
      case "create_library_folder":
        return createFolder(args.parent, args.name);
      case "new_project_folder":
        return `${createFolder(args.parent, args.name)}\\pensieve.db`;
      // Updates: localStorage "pv-update" holds the newer version GitHub Releases pretends to have.
      case "plugin:app|version":
        return "0.1.0";
      case "plugin:updater|check": {
        const version = localStorage.getItem("pv-update");
        return version ? { rid: 7, currentVersion: "0.1.0", version, date: null, body: "", rawJson: {} } : null;
      }
      case "plugin:updater|download_and_install":
        window.__PV_HARNESS__.installed = (window.__PV_HARNESS__.installed ?? 0) + 1;
        return null;
      case "move_library_entry":
        return moveFolder(args.path, args.parent, args.name, args.library);
      case "open_library_file": {
        if (!files.has(lower(args.path))) throw "That file isn't there any more";
        if (PROGRAMS.test(args.path)) throw "Pensieve doesn't start programs; open it from Explorer if you trust it";
        window.__PV_HARNESS__.opened.push(args.path);
        return null;
      }
      case "show_in_explorer":
        if (!files.has(lower(args.path)) && !folders.has(lower(args.path)) && !fileExists(args.path)) throw "That isn't there any more";
        window.__PV_HARNESS__.revealed.push(args.path);
        return null;
      case "open_link":
        if (!/^(https?:|mailto:)/i.test(String(args.url))) throw "Pensieve opens only web and e-mail links";
        window.__PV_HARNESS__.links.push(args.url);
        return null;
      case "write_backup": {
        // backup.rs write_backup: the backup as a file in her folder; what was written is in __PV_HARNESS__.backups.
        const folder = String(args.folder).replace(/[\\/]+$/, "");
        addFolder(folder);
        const path = `${folder}\\${args.filename}`;
        const bytes = new TextEncoder().encode(String(args.contents));
        let binary = "";
        for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
        files.set(lower(path), { path, base64: btoa(binary) });
        (window.__PV_HARNESS__.backups ??= []).push(path);
        return path;
      }
      case "backup_usage": {
        // backup.rs backup_usage: Pensieve's backups in the folder, by project, the one backed up last first.
        const folder = lower(String(args.folder).replace(/[\\/]+$/, ""));
        const projects = new Map();
        for (const file of files.values()) {
          const at = file.path.lastIndexOf("\\");
          if (lower(file.path.slice(0, at)) !== folder) continue;
          const match = /^pensieve-(?:([A-Za-z0-9]{1,32})-)?(\d{4}-\d{2}-\d{2}T.*)\.json$/.exec(file.path.slice(at + 1));
          if (!match) continue;
          const key = match[1] ?? "";
          const project = projects.get(key) ?? { key, title: "", count: 0, bytes: 0, saved: "" };
          const binary = atob(file.base64);
          project.count += 1;
          project.bytes += binary.length;
          if (match[2] > project.saved) {
            project.saved = match[2];
            try {
              const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
              project.title = data.project?.title ?? data.book?.title ?? "";
            } catch {
              project.title = "";
            }
          }
          projects.set(key, project);
        }
        return [...projects.values()].sort((a, b) => (a.saved < b.saved ? 1 : -1)).map(({ saved, ...rest }) => rest);
      }
      case "kept_copies_folder":
        return keptFolder(args.kind);
      case "write_kept_copy": {
        // kept.rs write_kept_copy; failKept stands for a full disk.
        if (window.__PV_HARNESS__.failKept) throw "There is not enough space on the disk. (os error 112)";
        // kept.rs valid_name: at most 200 bytes, a .json, no leading dot or space, no "..", nothing Windows refuses.
        const valid =
          new TextEncoder().encode(args.name).length <= 200 && /\.json$/.test(args.name) && !/^[. ]/.test(args.name) && !args.name.includes("..") && !/[\p{Cc}<>:"/\\|?*]/u.test(args.name);
        if (!valid) throw "The copy's name isn't valid";
        keptCopies.set(`${args.kind}/${args.name}`, { contents: String(args.contents), modified: Date.now() });
        keepCopies();
        return `${keptFolder(args.kind)}\\${args.name}`;
      }
      case "list_kept_copies":
        return [...keptCopies]
          .filter(([key]) => key.startsWith(`${args.kind}/`))
          .map(([key, copy]) => {
            const name = key.slice(args.kind.length + 1);
            return { name, path: `${keptFolder(args.kind)}\\${name}`, bytes: copy.contents.length, modified: copy.modified };
          })
          .sort((a, b) => b.modified - a.modified);
      case "remove_kept_copy":
        keptCopies.delete(`${args.kind}/${args.name}`);
        keepCopies();
        return null;
      case "read_backup_file": {
        for (const kind of ["rescue", "deleted"]) {
          const folder = `${keptFolder(kind)}\\`;
          if (!String(args.path).startsWith(folder)) continue;
          const copy = keptCopies.get(`${kind}/${String(args.path).slice(folder.length)}`);
          if (!copy) throw "That file isn't there any more";
          return copy.contents;
        }
        const file = files.get(lower(String(args.path)));
        if (!file) throw "That file isn't there any more";
        return new TextDecoder().decode(bytesOf(file.base64));
      }
      case "read_image_file": {
        const file = files.get(lower(String(args.path)));
        if (!file) throw "That file isn't there any more";
        return [...bytesOf(file.base64)];
      }
      case "read_document_file": {
        if (!/\.(docx|odt|txt|md|markdown)$/i.test(args.path)) throw "Only a Word, OpenDocument, text or Markdown file can come in as a writing";
        const file = files.get(lower(args.path));
        if (!file) throw "That file isn't there any more";
        return bytesOf(file.base64).buffer;
      }
      // The file and folder pickers: the answers a check queued, in turn; none left is a Cancel.
      case "plugin:dialog|open":
      case "plugin:dialog|save":
        return window.__PV_HARNESS__.dialogAnswers?.shift() ?? null;
      case "write_document": {
        // export.rs write_document: the file's bytes, its path hex-encoded in a header; kept as one of her files.
        const headers = options?.headers instanceof Headers ? Object.fromEntries(options.headers) : (options?.headers ?? {});
        const path = new TextDecoder().decode(new Uint8Array((String(headers["x-path"] ?? "").match(/../g) ?? []).map((pair) => parseInt(pair, 16))));
        if (!path) throw "The file path is missing";
        const bytes = args instanceof Uint8Array ? args : new Uint8Array(args);
        let binary = "";
        for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
        addFolder(parentOf(path));
        files.set(lower(path), { path, base64: btoa(binary) });
        return { path, stamp: `${bytes.length}:1` };
      }
      case "remove_library_folder": {
        const path = String(args.path).replace(/[\\/]+$/, "");
        if (!folders.has(lower(path))) throw "That folder isn't there any more";
        if (!inLibrary(path, String(args.library ?? "").replace(/[\\/]+$/, ""))) throw "Only a folder of the library can be moved or deleted from here";
        const inside =
          [...folders.values()].some((spelled) => lower(spelled).startsWith(`${lower(path)}\\`)) ||
          [...books.keys()].some((key) => within(key.replace(/^sqlite:/, ""), path)) ||
          [...files.values()].some((file) => within(file.path, path));
        if (inside) throw "Only an empty folder can be deleted; move what's in it out first";
        folders.delete(lower(path));
        keepFolders();
        return null;
      }
      case "trash_project_folder": {
        // library.rs trash_project: only a project of the library goes; what went is in __PV_HARNESS__.trashed.
        const path = String(args.path).replace(/[\\/]+$/, "");
        const library = String(args.library ?? "").replace(/[\\/]+$/, "");
        if (!folders.has(lower(path))) throw "That folder isn't there any more";
        if (!library || !lower(path).startsWith(`${lower(library)}\\`) || !fileExists(`${path}\\pensieve.db`)) {
          throw "Only a project's folder goes to the Recycle Bin from here";
        }
        for (const db of openPools) {
          if (within(db.replace(/^sqlite:/, ""), path)) throw "Windows couldn't move the folder to the Recycle Bin; close what has it open and try again";
        }
        for (const [key, spelled] of [...folders]) if (within(spelled, path)) folders.delete(key);
        for (const key of [...books.keys()]) {
          if (!within(key.replace(/^sqlite:/, ""), path)) continue;
          books.delete(key);
          dirty.delete(key);
        }
        for (const key of [...seeds.keys()]) if (within(key.replace(/^sqlite:/, ""), path)) seeds.delete(key);
        for (const [key, file] of [...files]) if (within(file.path, path)) files.delete(key);
        if (window.__PV_KEEP__) {
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith("pv-db:sqlite:") && within(key.slice("pv-db:sqlite:".length), path)) localStorage.removeItem(key);
          }
        }
        keepFolders();
        (window.__PV_HARNESS__.trashed ??= []).push(path);
        return true;
      }
      default:
        return null;
    }
  }

  window.__TAURI_INTERNALS__ = {
    invoke: (cmd, args = {}, options) => handle(cmd, args, options),
    transformCallback(callback, once = false) {
      const id = nextCallback++;
      callbacks.set(id, (data) => {
        if (once) callbacks.delete(id);
        return callback?.(data);
      });
      return id;
    },
    unregisterCallback(id) {
      callbacks.delete(id);
    },
    runCallback(id, data) {
      callbacks.get(id)?.(data);
    },
    callbacks,
    convertFileSrc: (path) => path,
    metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
    plugins: { path: { sep: "\\", delimiter: ";" } },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
})();
