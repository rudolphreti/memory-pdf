import Dexie, { Table } from "dexie";
import type { Project } from "./types";

interface MetaItem {
  key: string;
  value: string;
}

class MemoryDb extends Dexie {
  projects!: Table<Project, string>;
  meta!: Table<MetaItem, string>;

  constructor() {
    super("memory-pdf");
    this.version(1).stores({
      projects: "id, createdAt",
      meta: "key",
    });
  }
}

export const db = new MemoryDb();

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put(project);
  await db.meta.put({ key: "lastProjectId", value: project.id });
}

export async function getLastProjectId(): Promise<string | null> {
  const item = await db.meta.get("lastProjectId");
  return item?.value ?? null;
}

export async function getProject(id: string): Promise<Project | null> {
  const project = await db.projects.get(id);
  return project ?? null;
}

export async function getMostRecentProject(): Promise<Project | null> {
  const project = await db.projects.orderBy("createdAt").reverse().first();
  return project ?? null;
}
