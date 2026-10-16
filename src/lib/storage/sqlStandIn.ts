/**
 * The SQL plugin and the few Rust commands sqlite.ts uses, on sql.js, for the tests of where her text is kept
 * (ARCH-14). Not part of the app: only tests import it, by mocking `@tauri-apps/plugin-sql` and
 * `@tauri-apps/api/core` with it.
 *
 * As the plugin does, it keeps one database for each file, by its path, and binds `$1`, `$2` … by position.
 * `VACUUM INTO` writes a whole copy as a file of its own. `failAt` makes one statement fail, as a full disk or a
 * file that went away would, so a test can stop a save halfway.
 */
import initSqlJs from "sql.js/dist/sql-asm.js";

type SqlValue = string | number | null | Uint8Array;
type Statement = { bind(values: SqlValue[] | Record<string, SqlValue>): boolean; step(): boolean; getAsObject(): Record<string, SqlValue>; free(): void };
export type SqlJsDatabase = {
  run(sql: string, values?: SqlValue[] | Record<string, SqlValue>): void;
  prepare(sql: string): Statement;
  exec(sql: string): { columns: string[]; values: SqlValue[][] }[];
  export(): Uint8Array;
  getRowsModified(): number;
};
type SqlJs = { Database: new (data?: Uint8Array) => SqlJsDatabase };

const UNREACHABLE = "error returned from database: (code: 14) unable to open database file";

class SqlStandIn {
  readonly #sql = (initSqlJs as unknown as () => Promise<SqlJs>)();
  /** Every file, by its path. */
  readonly files = new Map<string, SqlJsDatabase>();
  #failure: { match: string | RegExp; skip: number } | null = null;

  /**
   * The (skip + 1)th statement holding `match` fails, once; "load <path>" matches opening a file. `null` clears
   * one left waiting.
   */
  failAt(match: string | RegExp | null, skip = 0) {
    this.#failure = match === null ? null : { match, skip };
  }

  #fails(text: string): boolean {
    const failure = this.#failure;
    if (!failure || !(typeof failure.match === "string" ? text.includes(failure.match) : failure.match.test(text))) return false;
    if (failure.skip > 0) {
      failure.skip -= 1;
      return false;
    }
    this.#failure = null;
    return true;
  }

  /** A file as an older Pensieve or a test made it. */
  async make(path: string, statements: string[]): Promise<SqlJsDatabase> {
    const SQL = await this.#sql;
    const db = new SQL.Database();
    for (const statement of statements) db.run(statement);
    this.files.set(path, db);
    return db;
  }

  /** Rows of a query, as plain values. */
  rows(path: string, sql: string): SqlValue[][] {
    const db = this.files.get(path);
    if (!db) throw new Error(`no file ${path}`);
    return db.exec(sql)[0]?.values ?? [];
  }

  /** The files open now, by their connection, as the plugin keeps one pool for each. */
  readonly #loaded = new Set<string>();

  /** The plugin: `Database.load`. A connection closed can't be used again: a new one is loaded. */
  readonly plugin = {
    load: async (url: string) => {
      const path = url.replace(/^sqlite:/, "");
      if (this.#fails(`load ${path}`)) throw new Error(UNREACHABLE);
      if (!this.files.has(path)) this.files.set(path, new (await this.#sql).Database());
      this.#loaded.add(url);
      const open = () => {
        if (!this.#loaded.has(url)) throw new Error(`database ${url} not loaded`);
      };
      return {
        path: url,
        execute: async (query: string, values: unknown[] = []) => (open(), this.#execute(path, query, values)),
        select: async (query: string, values: unknown[] = []) => (open(), this.#select(path, query, values)),
        close: async (db?: string) => {
          if (db) this.#loaded.delete(db);
          else this.#loaded.clear();
          return true;
        },
      };
    },
  };

  #file(path: string): SqlJsDatabase {
    const db = this.files.get(path);
    if (!db) throw new Error(UNREACHABLE);
    return db;
  }

  async #execute(path: string, query: string, values: unknown[]) {
    if (this.#fails(query)) throw new Error("error returned from database: (code: 13) database or disk is full");
    const db = this.#file(path);
    if (/^\s*VACUUM\s+INTO\s+\$1\s*$/i.test(query)) {
      this.files.set(String(values[0]), new (await this.#sql).Database(db.export()));
      return { rowsAffected: 0, lastInsertId: 0 };
    }
    db.run(query, bindOf(query, values));
    return { rowsAffected: db.getRowsModified(), lastInsertId: 0 };
  }

  #select(path: string, query: string, values: unknown[]) {
    if (this.#fails(query)) throw new Error(UNREACHABLE);
    const statement = this.#file(path).prepare(query);
    try {
      statement.bind(bindOf(query, values));
      const rows: Record<string, SqlValue>[] = [];
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  }

  /** The Rust commands sqlite.ts calls, as project.rs answers them. */
  async invoke(command: string, args: Record<string, unknown>): Promise<unknown> {
    switch (command) {
      case "project_file_exists":
        return this.files.has(String(args.path));
      case "default_project_path":
        return "C:\\Users\\Eva\\AppData\\Roaming\\com.pensieve.app\\pensieve.db";
      case "write_prefs":
        return null;
      case "settle_project_copy": {
        const copy = String(args.copy);
        const dest = `${String(args.folder).replace(/[\\/]+$/, "")}\\pensieve.db`;
        const file = this.files.get(copy);
        this.files.delete(copy);
        if (!file) throw "The project file was not found";
        if (this.files.has(dest)) throw "That folder already contains a pensieve.db file";
        this.files.set(dest, file);
        return dest;
      }
      default:
        throw new Error(`The stand-in has no ${command}`);
    }
  }
}

/** Values as the plugin binds them: $1, $2 … by position; true and false as 1 and 0. */
function bindOf(query: string, values: unknown[]): SqlValue[] | Record<string, SqlValue> {
  const list = values.map((value): SqlValue => (value === undefined ? null : typeof value === "boolean" ? (value ? 1 : 0) : (value as SqlValue)));
  if (!/\$\d/.test(query)) return list;
  return Object.fromEntries(list.map((value, index) => [`$${index + 1}`, value]));
}

export const standIn = new SqlStandIn();
