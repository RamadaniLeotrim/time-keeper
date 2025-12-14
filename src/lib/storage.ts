// Types needed for frontend (kept for type safety)
export interface UserConfig {
    id: number;
    weeklyTargetHours: number;
    yearlyVacationDays: number;
}

export interface TimeEntry {
    id: number;
    date: string;
    type: 'work' | 'vacation' | 'sick' | 'accident' | 'holiday' | 'school' | 'special' | 'trip' | 'other';
    startTime: string | null;
    endTime: string | null;
    pauseDuration: number | null;
    notes: string | null;
}

export type NewTimeEntry = Omit<TimeEntry, 'id'> & { id?: number };

class StorageService {

    private getApiUrl(path: string): string {
        // In Vercel (Production & Dev), API is at /api/... relative to root.
        // If running Vite locally without Vercel Dev, this will allow fallback if we set VITE_API_URL
        // But normally with Vercel architecture we just use relative paths.
        return `/api${path}`;
    }

    private async request<T>(path: string, options?: RequestInit): Promise<T> {
        try {
            const res = await fetch(this.getApiUrl(path), {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options?.headers
                }
            });
            if (!res.ok) {
                throw new Error(`API Error: ${res.status} ${res.statusText}`);
            }
            return await res.json();
        } catch (e) {
            console.error("API Request Failed", e);
            throw e;
        }
    }

    // Config
    async getUserConfig(): Promise<UserConfig> {
        // Fallback default if API fails or returns null (bootstrap)
        try {
            return await this.request<UserConfig>('/config');
        } catch (e) {
            return { id: 1, weeklyTargetHours: 41, yearlyVacationDays: 25 };
        }
    }

    async saveUserConfig(config: Partial<UserConfig>) {
        return await this.request<UserConfig>('/config', {
            method: 'POST',
            body: JSON.stringify(config)
        });
    }

    // Entries
    async getEntries(): Promise<TimeEntry[]> {
        try {
            return await this.request<TimeEntry[]>('/entries');
        } catch (e) {
            return [];
        }
    }

    async addTimeEntry(entry: NewTimeEntry): Promise<void> {
        await this.request('/entries', {
            method: 'POST',
            body: JSON.stringify(entry)
        });
    }

    async updateTimeEntry(id: number, entry: Partial<NewTimeEntry>): Promise<void> {
        await this.request(`/entry?id=${id}`, {
            method: 'PUT',
            body: JSON.stringify(entry)
        });
    }

    async deleteTimeEntry(id: number): Promise<void> {
        await this.request(`/entry?id=${id}`, {
            method: 'DELETE'
        });
    }

    async clearAllEntries(): Promise<void> {
        await this.request('/entries?all=true', {
            method: 'DELETE'
        });
    }

    async deduplicateEntries(): Promise<number> {
        const res = await this.request<{ duplicatesRemoved: number }>('/deduplicate', {
            method: 'POST'
        });
        return res.duplicatesRemoved;
    }
}

export const storage = new StorageService();

