import fs from 'fs/promises';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'backend', 'data');

async function ensureDbDir() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create DB directory:', error);
  }
}

export async function readCollection<T extends { id: string; updatedAt?: number }>(
  collection: string
): Promise<T[]> {
  await ensureDbDir();
  const filePath = path.join(DB_DIR, `${collection}.json`);
  
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

export async function writeCollection<T extends { id: string; updatedAt?: number }>(
  collection: string,
  data: T[]
): Promise<void> {
  await ensureDbDir();
  const filePath = path.join(DB_DIR, `${collection}.json`);
  const jsonString = JSON.stringify(data);
  await fs.writeFile(filePath, jsonString, 'utf-8');
}

export function mergeByTimestamp<T extends { id: string; updatedAt?: number; deleted?: boolean }>(
  existing: T[],
  incoming: T[]
): T[] {
  const merged = new Map<string, T>();
  
  existing.forEach(item => merged.set(item.id, item));
  
  incoming.forEach(item => {
    const current = merged.get(item.id);
    if (!current || (item.updatedAt || 0) > (current.updatedAt || 0)) {
      merged.set(item.id, item);
    }
  });
  
  return Array.from(merged.values()).filter(item => !item.deleted);
}
