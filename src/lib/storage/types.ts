import type { Project, SnapshotInfo } from "$lib/model";

/** Persistence boundary. A later backup backend can implement the same methods. */
export interface Storage {
  save(project: Project): Promise<void>;
  load(): Promise<Project>;
  listSnapshots(projectId: string): Promise<SnapshotInfo[]>;
  restore(snapshotId: string): Promise<Project>;
}
