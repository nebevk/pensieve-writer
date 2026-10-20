import { describe, expect, it, vi } from "vitest";
import type { LibraryEntry } from "$lib/chapters/library";

// The project files on the pretend disk.
const there = new Set<string>();
vi.mock("@tauri-apps/api/core", () => ({ invoke: async (_command: string, args: { path: string }) => there.has(args.path) }));

const { everyProject, readEach } = await import("./everyProject");

const LIBRARY = "C:\\Users\\Eva\\Documents\\Pensieve";
const project = (folder: string): LibraryEntry => ({ name: folder.split("\\").pop() ?? folder, path: `${LIBRARY}\\${folder}`, project: true, children: [] });
const ENTRIES: LibraryEntry[] = [
  project("Žerjav"),
  { name: "Primeri", path: `${LIBRARY}\\Primeri`, project: false, children: [project("Primeri\\Svetilnik")] },
  project("Brod"),
];
const file = (folder: string) => `${LIBRARY}\\${folder}\\pensieve.db`;

describe("every project, read in turn (IMP-28)", () => {
  it("is the library's in its tree's order, then those kept elsewhere, each once", () => {
    const known = [{ path: "D:\\Drugje\\Reka\\pensieve.db", title: "Reka" }, { path: file("Brod").toUpperCase(), title: "Brod" }];
    // By name as Slovenian sorts them, a folder's projects in its place: Ž after P.
    expect(everyProject(ENTRIES, known, "sl-SI")).toEqual([file("Brod"), file("Primeri\\Svetilnik"), file("Žerjav"), "D:\\Drugje\\Reka\\pensieve.db"]);
  });

  it("the open project first for the search, or left out for the other projects' ideas", () => {
    expect(everyProject(ENTRIES, [], "sl-SI", { first: file("Žerjav") })).toEqual([file("Žerjav"), file("Brod"), file("Primeri\\Svetilnik")]);
    expect(everyProject(ENTRIES, [], "sl-SI", { except: file("Brod") })).toEqual([file("Primeri\\Svetilnik"), file("Žerjav")]);
  });

  it("reads each, leaves out one that is gone, names one that can't be read, and says how far it got", async () => {
    there.clear();
    there.add(file("Brod")).add(file("Žerjav"));
    const steps: string[] = [];
    const paths = [file("Odprti"), file("Brod"), file("Izginil"), file("Žerjav")];
    const read = await readEach(
      paths,
      file("Odprti"),
      async (path, name) => {
        if (name === "Žerjav") throw new Error("file is not a database");
        return [`${name}: ${path === file("Odprti") ? "odprt" : "prebran"}`];
      },
      (done, total) => steps.push(`${done}/${total}`),
    );
    // The open project's file is read even before Windows says it is there.
    expect(read).toEqual({ found: ["Odprti: odprt", "Brod: prebran"], unread: ["Žerjav"] });
    expect(steps).toEqual(["0/4", "1/4", "2/4", "3/4", "4/4"]);
  });
});
