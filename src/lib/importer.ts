import * as XLSX from 'xlsx';
import { type NewTimeEntry } from './storage';

export const parseExcelExport = async (file: File): Promise<NewTimeEntry[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];

                const entries: NewTimeEntry[] = [];
                const year = 2025; // Default year

                // Regex for Date "01.01."
                const dateRegex = /^(\d{2})\.(\d{2})\.$/;

                rows.forEach((row) => {
                    const dateCell = row[0];
                    if (typeof dateCell === 'string' && dateRegex.test(dateCell)) {
                        const match = dateCell.match(dateRegex);
                        if (!match) return;

                        const day = match[1];
                        const month = match[2];
                        const dateStr = `${year}-${month}-${day}`;

                        // Raw Values
                        const infoCol = row[2]?.toString().trim() || '';
                        const startCol = row[3]?.toString().trim() || '';
                        const endCol = row[6]?.toString().trim() || '';

                        // Combine text to search for keywords
                        // "StartCol" often contains text like "GT Feiertag" if no time is present
                        const fullText = `${infoCol} ${startCol}`.toUpperCase();

                        // Detect Work Time
                        const hasWorkTime = /^\d{1,2}:\d{2}/.test(startCol); // rudimentary check if col 3 starts with time

                        // 1. Handle Work Entry
                        if (hasWorkTime && startCol && endCol) {
                            const startTime = cleanTime(startCol);
                            const endTime = cleanTime(endCol);

                            // Pause
                            let pause = 30;
                            const p1 = cleanTime(row[4]?.toString());
                            const p2 = cleanTime(row[5]?.toString());
                            if (p1 && p2) {
                                pause = timeToMinutes(p2) - timeToMinutes(p1);
                            }

                            if (startTime && endTime) {
                                entries.push({
                                    date: dateStr,
                                    type: 'work',
                                    startTime,
                                    endTime,
                                    pauseDuration: pause >= 0 ? pause : 0,
                                    notes: ''
                                });
                            }
                        }

                        // 2. Handle Special Types (GT, VM, NM)
                        // Types to check: Schule, Ferien, Krank, Feiertag

                        const checkForType = (keyword: string, type: NewTimeEntry['type'], icon: string) => {
                            if (fullText.includes(keyword)) {
                                let note = icon;

                                if (fullText.includes('GT')) {
                                    note += ' Ganzer Tag';
                                } else if (fullText.includes('VM')) {
                                    note += ' Vormittag';
                                } else if (fullText.includes('NM')) {
                                    note += ' Nachmittag';
                                }

                                // Avoid duplicates if it's "GT Feiertag" in startCol, we don't want to add it if we successfully parsed work (unlikely for GT, but possible for VM/NM)
                                // Actually, if we have Work AND "Ferien NM", we want BOTH entries.

                                // Special case: If text is in startCol and NOT a time, we definitely add it.
                                // If text is in infoCol, we add it too.

                                entries.push({
                                    date: dateStr,
                                    type: type,
                                    startTime: null,
                                    endTime: null,
                                    pauseDuration: 0,
                                    notes: note
                                });
                            }
                        };

                        // Logic mappings
                        if (fullText.includes('SCHULE') || fullText.includes('BERUFSSCHULE')) checkForType('SCHULE', 'school', '📚');
                        if (fullText.includes('FERIEN') || fullText.includes('URLAUB')) checkForType('FERIEN', 'vacation', '🌴');
                        if (fullText.includes('KRANK')) checkForType('KRANK', 'sick', '💊');
                        if (fullText.includes('UNFALL')) checkForType('UNFALL', 'accident', '🤕');
                        if (fullText.includes('FEIERTAG')) checkForType('FEIERTAG', 'holiday', '🎉');
                    }
                });

                resolve(entries);
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsBinaryString(file);
    });
};

// Helpers
const cleanTime = (val: string | undefined): string | null => {
    if (!val) return null;
    // Extract HH:MM and ignore any suffix like /PA, /VK
    const match = val.toString().match(/(\d{1,2}:\d{2})/);
    if (match) {
        const [h, m] = match[1].split(':');
        return `${h.padStart(2, '0')}:${m}`;
    }
    return null;
};

const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};
