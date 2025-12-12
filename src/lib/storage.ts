import { db } from '../db';
import { userConfig, timeEntries } from '../db/schema';
import { eq } from 'drizzle-orm';


// Types derived from Schema
export type UserConfig = typeof userConfig.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;

const USE_MOCK = false;

class StorageService {

    // Config
    async getUserConfig(): Promise<UserConfig> {
        if (USE_MOCK) {
            const stored = localStorage.getItem('timekeeper_config');
            return stored ? JSON.parse(stored) : { id: 1, weeklyTargetHours: 41, yearlyVacationDays: 25 };
        }
        try {
            const result = await db.select().from(userConfig).where(eq(userConfig.id, 1));
            if (result.length > 0) return result[0];

            // Init default
            const def = { id: 1, weeklyTargetHours: 41, yearlyVacationDays: 25 };
            await db.insert(userConfig).values(def).onConflictDoNothing();
            return def;
        } catch (e) {
            console.error("Storage Error", e);
            return { id: 1, weeklyTargetHours: 41, yearlyVacationDays: 25 };
        }
    }

    async saveUserConfig(config: Partial<UserConfig>) {
        const current = await this.getUserConfig();
        const updated = { ...current, ...config };

        if (USE_MOCK) {
            localStorage.setItem('timekeeper_config', JSON.stringify(updated));
            return updated;
        }

        await db.insert(userConfig).values(updated).onConflictDoUpdate({ target: userConfig.id, set: updated });
        return updated;
    }

    // Entries
    async getEntries(): Promise<TimeEntry[]> {
        if (USE_MOCK) {
            const stored = localStorage.getItem('timekeeper_entries');
            return stored ? JSON.parse(stored) : [];
        }
        return await db.select().from(timeEntries);
    }

    async addTimeEntry(entry: NewTimeEntry): Promise<void> {
        if (USE_MOCK) {
            const current = await this.getEntries();
            const newEntry = { ...entry, id: Date.now() } as TimeEntry;
            const updated = [newEntry, ...current];
            localStorage.setItem('timekeeper_entries', JSON.stringify(updated));
            return;
        }
        await db.insert(timeEntries).values(entry);
    }

    async updateTimeEntry(id: number, entry: Partial<NewTimeEntry>): Promise<void> {
        if (USE_MOCK) {
            const current = await this.getEntries();
            const updated = current.map(e => e.id === id ? { ...e, ...entry } : e);
            localStorage.setItem('timekeeper_entries', JSON.stringify(updated));
            return;
        }
        await db.update(timeEntries).set(entry).where(eq(timeEntries.id, id));
    }

    async deleteTimeEntry(id: number): Promise<void> {
        if (USE_MOCK) {
            const current = await this.getEntries();
            const updated = current.filter(e => e.id !== id);
            localStorage.setItem('timekeeper_entries', JSON.stringify(updated));
            return;
        }
        await db.delete(timeEntries).where(eq(timeEntries.id, id));
    }

    async clearAllEntries(): Promise<void> {
        if (USE_MOCK) {
            localStorage.setItem('timekeeper_entries', JSON.stringify([]));
            return;
        }
        await db.delete(timeEntries);
    }

    async deduplicateEntries(): Promise<number> {
        const current = await this.getEntries();
        const unique = new Map<string, TimeEntry>();
        let duplicatesRemoved = 0;

        current.forEach(e => {
            // Create a unique key for the entry
            const key = `${e.date}-${e.type}-${e.startTime}-${e.endTime}-${e.notes}`;
            if (!unique.has(key)) {
                unique.set(key, e);
            } else {
                duplicatesRemoved++;
            }
        });

        if (duplicatesRemoved > 0) {
            if (USE_MOCK) {
                localStorage.setItem('timekeeper_entries', JSON.stringify(Array.from(unique.values())));
            } else {
                // Brute force: delete all, re-insert unique.
                await db.delete(timeEntries);
                if (unique.size > 0) {
                    await db.insert(timeEntries).values(Array.from(unique.values()));
                }
            }
        }
        return duplicatesRemoved;
    }
}

export const storage = new StorageService();
