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
}));

const { LibraryDisk } = await import("./libraryDisk");

const LIBRARY = "C:\\Users\\Eva\\Documents\\Pensieve";
const OPEN = `${LIBRARY}\\Romani\\Brod\\pensieve.db`;

describe("the library's folders and projects on disk (IMP-28)", () => {
  let said: string[];
  let disk: InstanceType<typeof LibraryDisk>;

  beforeEach(() => {
    calls.length = 0;
    answer = (command, args) => (command === "move_library_entry" ? `${args.parent}\\${args.name}` : command === "trash_project_folder" ? true : null);
    reopens = true;
    said = [];
    disk = new LibraryDisk({
      libraryRoot: () => LIBRARY,
      openFile: () => OPEN,
      oneAtATime: (work) => work(),
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
