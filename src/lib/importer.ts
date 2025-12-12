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

                // Regex for Date "01.01." or "01.01.2025"
                const dateRegex = /^(\d{1,2})\.(\d{1,2})(\.(\d{2,4}))?/;

                let lastDateStr: string | null = null;

                rows.forEach((row) => {
                    const dateCell = row[0];
                    let dateStr = lastDateStr;

                    // Try to parse Date
                    if (typeof dateCell === 'string' && dateRegex.test(dateCell)) {
                        const match = dateCell.match(dateRegex);
                        if (match) {
                            const day = match[1];
                            const month = match[2];
                            dateStr = `${year}-${month}-${day}`;
                            lastDateStr = dateStr; // Update cache
                        }
                    }
                    // If dateCell is empty/invalid, we rely on dateStr (lastDateStr)

                    if (!dateStr) return; // Skip if we have no date context

                    // Raw Values
                    const infoCol = row[2]?.toString().trim() || '';
                    const startCol = row[3]?.toString().trim() || '';
                    const endCol = row[6]?.toString().trim() || '';

                    // Combine text to search for keywords
                    const fullText = `${infoCol} ${startCol}`.toUpperCase();

                    // Detect Work Time
                    const hasWorkTime = /^\d{1,2}:\d{2}/.test(startCol);

                    // 1. Handle Work Entry
                    if (hasWorkTime) {
                        // Determine Columns
                        const t1 = cleanTime(row[3]?.toString()); // Start 1
                        const t2 = cleanTime(row[4]?.toString()); // End 1 (or End of Day if single block)
                        const t3 = cleanTime(row[5]?.toString()); // Start 2
                        const t4 = cleanTime(row[6]?.toString()); // End 2

                        let startTime: string | null = null;
                        let endTime: string | null = null;
                        let pause = 0;
                        let hasOriginalPause = false;

                        if (t1 && t4) {
                            // Case: 4 Bookings (Full Day with Break)
                            startTime = t1;
                            endTime = t4;
                            if (t2 && t3) {
                                pause = timeToMinutes(t3) - timeToMinutes(t2);
                                hasOriginalPause = true;
                            } else {
                                // Fallback if middle cols missing but 3 and 6 exist? Unlikely but safe to assume 0 pause or calculate implicit? 
                                // Better to stick to explicit.
                                pause = 30; // Legacy default
                            }
                        } else if (t1 && t2) {
                            // Case: 2 Bookings (Single Block / Half Day)
                            // Only if t4 is missing
                            startTime = t1;
                            endTime = t2;
                            pause = 0;
                            hasOriginalPause = false;
                        }

                        if (startTime && endTime) {
                            // Automatic Pause Deduction Rules
                            // Layer 1: Lunch Correction (If forgot to stamp)
                            // If attendance > 7h AND (No Original Pause OR Note says 'Keine Pause' implied by 0), add 30m.

                            const startMin = timeToMinutes(startTime);
                            const endMin = timeToMinutes(endTime);
                            let attendance = endMin - startMin;

                            // Handle midnight crossing
                            if (attendance < 0) attendance += (24 * 60);

                            // LAYER 1: Lunch Correction
                            if (attendance > (7 * 60)) {
                                if (!hasOriginalPause || pause === 0) {
                                    // Case 1: Long day, forgot to stamp -> +30m
                                    pause += 30;
                                } else if (hasOriginalPause && pause < 30) {
                                    // Case 2: Stamped (4 bookings), but < 30m -> Fill to 30m
                                    // User Rule: "Nur dann auf 30min erhöht, wenn die Totale arbeitszeit > 7h ist"
                                    pause = 30;
                                }
                            }

                            // LAYER 2: Mandatory Breaks (Always applied to Net Work)
                            // LAYER 2: Mandatory Breaks (Always applied to Net Work)
                            // Rule 1: Add 15m ONLY if working at 09:30
                            // User request: "Nur wenn man um 9:30Uhr gearbeitet hat, werden die 15min abgezogen"

                            // Check intervals using cleaned variables (t1, t2, t3, t4) derived earlier
                            const targetCheck = 9 * 60 + 30; // 09:30 = 570 min
                            let workingAt930 = false;

                            if (t1 && t2 && t3 && t4) {
                                // 4 Bookings (Split Day)
                                const s1 = timeToMinutes(t1);
                                const e1 = timeToMinutes(t2);
                                const s2 = timeToMinutes(t3);
                                const e2 = timeToMinutes(t4);
                                if ((s1 <= targetCheck && targetCheck < e1) || (s2 <= targetCheck && targetCheck < e2)) {
                                    workingAt930 = true;
                                }
                            } else if (t1 && t2) {
                                // 2 Bookings (Single Block)
                                const s = timeToMinutes(t1);
                                const e = timeToMinutes(t2);
                                if (s <= targetCheck && targetCheck < e) {
                                    workingAt930 = true;
                                }
                            } else if (t1 && t4 && !t2 && !t3) {
                                // Fallback (Start/End only, implicit single block, though usually caught by Case 4 Bookings logi above if full)
                                // But if it fell through, treated as single block t1->t4
                                const s = timeToMinutes(t1);
                                const e = timeToMinutes(t4);
                                if (s <= targetCheck && targetCheck < e) {
                                    workingAt930 = true;
                                }
                            }

                            // Check for Weekend
                            const d = new Date(dateStr);
                            const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
                            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                            if (workingAt930 && !isWeekend) {
                                pause += 15;
                            }

                            let currentNetWork = attendance - (pause >= 0 ? pause : 0);

                            // Rule 2: > 9h Net Work -> Minimum 60m Pause
                            if (currentNetWork > (9 * 60)) {
                                if (pause < 60) {
                                    const diff = 60 - pause;
                                    pause += diff;
                                    // currentNetWork -= diff; // Optional: Technically net work decreases further, but irrelevant for further rules
                                }
                            }

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

                            entries.push({
                                date: dateStr!, // Safe assertion as we check !dateStr above
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
                    if (fullText.includes('PRIVATE ABWESENHEIT')) checkForType('PRIVATE ABWESENHEIT', 'special', '🎗️');
                    if (fullText.includes('DIENSTGANG')) checkForType('DIENSTGANG', 'trip', '🚗');

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
