import { db } from '../db';
import { userConfig, timeEntries } from '../db/schema';
// import { eq } from 'drizzle-orm';


// Types derived from Schema
export type UserConfig = typeof userConfig.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;

const USE_MOCK = true; // Set to false once Turso is working

class StorageService {

    // Config
    async getUserConfig(): Promise<UserConfig> {
        if (USE_MOCK) {
            const stored = localStorage.getItem('timekeeper_config');
            return stored ? JSON.parse(stored) : { id: 1, weeklyTargetHours: 40, yearlyVacationDays: 25 };
        }
        // DB Implementation (Future)
        const result = await db.select().from(userConfig).limit(1);
        return result[0] || { id: 1, weeklyTargetHours: 40, yearlyVacationDays: 25 };
    }

    async saveUserConfig(config: Partial<UserConfig>) {
        if (USE_MOCK) {
            const current = await this.getUserConfig();
            const updated = { ...current, ...config };
            localStorage.setItem('timekeeper_config', JSON.stringify(updated));
            return updated;
        }
        // DB Implementation
        // ... upsert logic
        return config;
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
            // Assign a fake ID for mock
            const newEntry = { ...entry, id: Date.now() };
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
        // await db.update(timeEntries).set(entry).where(eq(timeEntries.id, id));
    }

    async deleteTimeEntry(id: number): Promise<void> {
        if (USE_MOCK) {
            const current = await this.getEntries();
            const updated = current.filter(e => e.id !== id);
            localStorage.setItem('timekeeper_entries', JSON.stringify(updated));
            return;
        }
        // await db.delete(timeEntries).where(eq(timeEntries.id, id));
    }

    async clearAllEntries(): Promise<void> {
        if (USE_MOCK) {
            localStorage.setItem('timekeeper_entries', JSON.stringify([]));
            return;
        }
        // await db.delete(timeEntries);
    }
}

export const storage = new StorageService();
