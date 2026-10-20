import { beforeEach, describe, expect, it, vi } from "vitest";

// What the Windows side was asked, and what it answers; how the open project's file fares when its folder moves.
const calls: string[] = [];
let answer: (command: string, args: Record<string, unknown>) => unknown = () => null;
let reopens = true;
vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (command: string, args: Record<string, unknown>) => {
    calls.push(`${command} ${JSON.stringify(args)}`);
    return answer(command, args);
  },
}));
vi.mock("$lib/storage/sqlite", () => ({
  moveProjectFile: async (move: () => Promise<string>, back: () => Promise<void>) => {
    calls.push("let go of the open file");
    const moved = await move();
    if (reopens) return moved;
    await back();
    throw new Error("unable to open database file");
  },
  copyOpenProject: async (folder: string) => {
    calls.push(`copy the open file into ${folder}`);
    return `${folder}\\pensieve.db`;
  },
  openShelf: async (writingId: string) => {
    if (!reopens) throw new Error("unable to open database file");
    return { shelf: { projectId: "kopija", title: "" }, writing: { id: writingId } };
  },
}));
// The folder Settings' dialog answers with.
let picked: string | null = null;
vi.mock("$lib/storage/backup", () => ({ chooseBackupFolder: async () => picked }));

const { LibraryDisk } = await import("./libraryDisk");
type Session = import("$lib/session.svelte").Session;

const LIBRARY = "C:\\Users\\Eva\\Documents\\Pensieve";
const OPEN = `${LIBRARY}\\Romani\\Brod\\pensieve.db`;

describe("the library's folders and projects on disk (IMP-28)", () => {
  let said: string[];
  let session: { path: string };
  let disk: InstanceType<typeof LibraryDisk>;

  beforeEach(() => {
    calls.length = 0;
    answer = (command, args) => (command === "move_library_entry" ? `${args.parent}\\${args.name}` : command === "trash_project_folder" ? true : null);
    reopens = true;
    picked = null;
    said = [];
    // The session as it moves the open project: copied, then opened there, or the copy discarded.
    const moving = {
      path: OPEN,
      async moveTo(copy: () => Promise<string>, open: (path: string) => Promise<unknown>, discard: () => Promise<unknown>) {
        const copied = await copy();
        try {
          const opened = await open(copied);
          moving.path = copied;
          return opened;
        } catch (error) {
          await discard();
          throw error;
        }
      },
    };
    session = moving;
    disk = new LibraryDisk({
      libraryRoot: () => LIBRARY,
      backupFolder: () => "D:\\Varnostne kopije",
      setLibraryFolder: (folder) => said.push(`library folder ${folder}`),
      session: moving as unknown as Session,
      openProject: () => ({ title: "Brod na reki", writingId: "pisanje" }),
      oneAtATime: (work) => work(),
      withEditorClosed: (work) => work(),
      named: async (path, opened) => {
        said.push(`named by ${path}`);
        return opened;
      },
      movedIn: (source) => said.push(`moved in from ${source}`),
      say: (message) => said.push(`say: ${message}`),
      fail: (message) => said.push(`fail: ${message}`),
      renamedByFolder: async (file) => void said.push(`named by ${file}`),
      followMove: (from, to) => said.push(`follow ${from} → ${to}`),
      rememberProject: () => said.push("remember"),
      forgetProject: (path) => said.push(`forget ${path}`),
      refreshLibrary: async () => void said.push("refresh"),
      libraryNotice: (message) => said.push(`library: ${message}`),
      notice: (message) => said.push(`notice: ${message}`),
    });
  });

  it("makes a folder in the library, or says what is wrong with its name", async () => {
    expect(await disk.newFolder("", "Kratke zgodbe")).toBeNull();
    expect(calls).toEqual([`create_library_folder ${JSON.stringify({ parent: LIBRARY, name: "Kratke zgodbe" })}`]);
    expect(said).toEqual(["refresh"]);
    expect(await disk.newFolder("", "a/b")).toBe("A name can't have \\ / : * ? \" < > or |.");
    expect(calls).toHaveLength(1);
    answer = () => {
      throw "Something with that name is already there";
    };
    expect(await disk.newFolder(LIBRARY, "Romani")).toBe("Something with that name is already there");
  });

  it("renames a folder without the open project in it, and what Pensieve keeps follows it", async () => {
    expect(await disk.relocate(`${LIBRARY}\\Zgodbe`, LIBRARY, "Čarovnice")).toBeNull();
    expect(calls).toEqual([`move_library_entry ${JSON.stringify({ path: `${LIBRARY}\\Zgodbe`, parent: LIBRARY, name: "Čarovnice", library: LIBRARY })}`]);
    expect(said).toEqual([`follow ${LIBRARY}\\Zgodbe → ${LIBRARY}\\Čarovnice`, "remember", "refresh"]);
  });

  it("moves the folder of the open project with its file let go, and names the project by its folder", async () => {
    expect(await disk.relocate(`${LIBRARY}\\Romani`, LIBRARY, "Romani in novele")).toBeNull();
    expect(calls[0]).toBe("let go of the open file");
    expect(said).toEqual([`named by ${LIBRARY}\\Romani in novele\\Brod\\pensieve.db`, `follow ${LIBRARY}\\Romani → ${LIBRARY}\\Romani in novele`, "remember", "refresh"]);
  });

  it("puts a folder back when the open project won't open where it went, and nothing follows it", async () => {
    reopens = false;
    expect(await disk.relocate(`${LIBRARY}\\Romani`, LIBRARY, "Drugam")).toBe("Pensieve can't reach this project's file. If its folder was moved or renamed, put it back where it was, and saving starts again.");
    expect(calls.at(-1)).toBe(`move_library_entry ${JSON.stringify({ path: `${LIBRARY}\\Drugam`, parent: LIBRARY, name: "Romani", library: LIBRARY })}`);
    expect(said).toEqual(["refresh"]);
  });

  it("a move the Windows side refuses is said, and nothing follows it", async () => {
    answer = () => {
      throw "A folder can't go inside itself";
    };
    await disk.move(`${LIBRARY}\\Zgodbe`, `${LIBRARY}\\Romani`);
    expect(said).toEqual(["refresh", "library: A folder can't go inside itself"]);
  });

  it("doesn't move a folder where it already is, or into itself", async () => {
    await disk.move(`${LIBRARY}\\Zgodbe`, LIBRARY);
    await disk.move(`${LIBRARY}\\Zgodbe`, `${LIBRARY}\\Zgodbe\\Notri`);
    expect(calls).toEqual([]);
  });

  it("deletes an empty folder, or says why one stays", async () => {
    await disk.deleteFolder(`${LIBRARY}\\Prazna`);
    answer = () => {
      throw "Only an empty folder can be deleted; move what's in it out first";
    };
    await disk.deleteFolder(`${LIBRARY}\\Romani`);
    expect(said).toEqual(["refresh", "library: Only an empty folder can be deleted; move what's in it out first", "refresh"]);
  });

  it("sends a project of the library to the Recycle Bin and forgets it; never the open one or one elsewhere", async () => {
    await disk.deleteProject(OPEN);
    await disk.deleteProject("C:\\Users\\Eva\\Documents\\Drugje\\pensieve.db");
    expect(calls).toEqual([]);
    await disk.deleteProject(`${LIBRARY}\\Vrt\\pensieve.db`);
    expect(calls).toEqual([`trash_project_folder ${JSON.stringify({ path: `${LIBRARY}\\Vrt`, library: LIBRARY })}`]);
    expect(said).toEqual([`forget ${LIBRARY}\\Vrt\\pensieve.db`, "refresh"]);
    // Where Windows asked her and she said no, it stays on Pensieve's lists.
    answer = () => false;
    said.length = 0;
    await disk.deleteProject(`${LIBRARY}\\Reka\\pensieve.db`);
    expect(said).toEqual(["refresh"]);
  });

  it("makes a project's folder, or reuses one there already when asked to", async () => {
    answer = (command) => (command === "new_project_folder" ? `${LIBRARY}\\Mlin\\pensieve.db` : command === "project_file_exists" ? false : null);
    expect(await disk.makeProjectFolder(LIBRARY, " Mlin ")).toBe(`${LIBRARY}\\Mlin\\pensieve.db`);
    expect(calls).toEqual([`new_project_folder ${JSON.stringify({ parent: LIBRARY, name: "Mlin" })}`]);
    await expect(disk.makeProjectFolder(LIBRARY, "a/b")).rejects.toThrow("A name can't have");
    answer = (command) => (command === "project_file_exists" ? true : null);
    expect(await disk.makeProjectFolder(LIBRARY, "Primeri", true)).toBe(`${LIBRARY}\\Primeri\\pensieve.db`);
    answer = (command) => {
      if (command === "new_project_folder") throw "Something with that name is already there";
      return false;
    };
    expect(await disk.makeProjectFolder(LIBRARY, "Primeri", true)).toBe(`${LIBRARY}\\Primeri\\pensieve.db`);
    await expect(disk.makeProjectFolder(LIBRARY, "Primeri")).rejects.toBe("Something with that name is already there");
  });

  it("finds a free folder for a project, its name made fit for one", async () => {
    const taken = new Set([`${LIBRARY}\\Brod na reki`]);
    answer = (command, args) => {
      const path = `${args.parent}\\${args.name}`;
      if (taken.has(path)) throw "Something with that name is already there";
      return path;
    };
    expect(await disk.freeProjectFolder(LIBRARY, "Brod na reki")).toBe(`${LIBRARY}\\Brod na reki (2)`);
    expect(await disk.freeProjectFolder(LIBRARY, "Mlin?")).toBe(`${LIBRARY}\\Mlin`);
    expect(await disk.freeProjectFolder(LIBRARY, "...")).toBe(`${LIBRARY}\\My first project`);
  });

  it("chooses the library folder: never a synced one, never with the backups, never a project's own", async () => {
    await disk.chooseFolder();
    expect(said).toEqual([]);
    picked = "C:\\Users\\Eva\\OneDrive\\Pisanje";
    await disk.chooseFolder();
    picked = "D:\\Varnostne kopije\\Knjige";
    await disk.chooseFolder();
    picked = "C:\\Users\\Eva\\Documents\\Brod";
    answer = (command) => command === "project_file_exists";
    await disk.chooseFolder();
    expect(said).toEqual([
      "say: That folder is kept in sync by a cloud service, which can damage a project while it's open. Choose a folder outside it.",
      "say: Keep the library and the backups folder apart.",
      "say: That folder is a project. Choose the folder that holds your projects.",
    ]);
    said.length = 0;
    picked = "C:\\Users\\Eva\\Documents\\Pisanje";
    answer = () => false;
    await disk.chooseFolder();
    expect(said).toEqual(["library folder C:\\Users\\Eva\\Documents\\Pisanje", "refresh", "say: New projects now go in C:\\Users\\Eva\\Documents\\Pisanje."]);
  });

  it("moves a project kept elsewhere into a folder of its own in the library, and opens it there", async () => {
    session.path = "C:\\Users\\Eva\\Desktop\\Brod\\pensieve.db";
    answer = (command, args) => (command === "create_library_folder" ? `${args.parent}\\${args.name}` : null);
    await disk.moveOpenProjectIn();
    expect(calls).toEqual([`create_library_folder ${JSON.stringify({ parent: LIBRARY, name: "Brod na reki" })}`, `copy the open file into ${LIBRARY}\\Brod na reki`]);
    expect(said).toEqual([
      `named by ${LIBRARY}\\Brod na reki\\pensieve.db`,
      "moved in from C:\\Users\\Eva\\Desktop\\Brod\\pensieve.db",
      `say: Project file moved to ${LIBRARY}\\Brod na reki\\pensieve.db`,
      `notice: Project file moved to ${LIBRARY}\\Brod na reki\\pensieve.db`,
      "refresh",
    ]);
    // One in the library already stays where it is.
    calls.length = 0;
    await disk.moveOpenProjectIn();
    expect(calls).toEqual([]);
  });

  it("a copy that won't open goes to the Recycle Bin, the project stays where it was, and she is told", async () => {
    session.path = "C:\\Users\\Eva\\Desktop\\Brod\\pensieve.db";
    answer = (command, args) => (command === "create_library_folder" ? `${args.parent}\\${args.name}` : null);
    reopens = false;
    await disk.moveOpenProjectIn();
    expect(calls.at(-1)).toBe(`trash_project_folder ${JSON.stringify({ path: `${LIBRARY}\\Brod na reki`, library: LIBRARY })}`);
    expect(session.path).toBe("C:\\Users\\Eva\\Desktop\\Brod\\pensieve.db");
    expect(said.filter((line) => line.startsWith("fail: "))).toHaveLength(1);
  });

  it("opens her files in their own programs, or says why not", async () => {
    answer = () => {
      throw "Pensieve doesn't start programs; open it from Explorer if you trust it";
    };
    await disk.openFile(`${LIBRARY}\\Romani\\Brod\\setup.exe`);
    answer = () => {
      throw "That isn't there any more";
    };
    await disk.showInExplorer(`${LIBRARY}\\Ni ga`);
    expect(said).toEqual(["notice: Pensieve doesn't start programs; open it from Explorer if you trust it", "notice: That isn't there any more"]);
  });
});
