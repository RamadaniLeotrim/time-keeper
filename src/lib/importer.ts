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
                    // const endCol = row[6]?.toString().trim() || ''; // Unused

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
                        // let hasOriginalPause = false; // Unused


                        // 1. Identify Scenario: 2 Bookings vs 4 Bookings
                        // Note: "2 Bookings" means continuous block (Start -> End)
                        // "4 Bookings" means Split Day (Start1 -> End1, Start2 -> End2)

                        let isFourBookings = false;
                        let isTwoBookings = false;

                        if (t1 && t2 && t3 && t4) {
                            // Classic 4 Bookings
                            isFourBookings = true;
                        } else if (t1 && t4 && t2 && t3) {
                            // Redundant check but covers all 4 present
                            isFourBookings = true;
                        } else if (t1 && t2 && !t3 && !t4) {
                            // Classic 2 Bookings (Single Block)
                            isTwoBookings = true;
                        } else if (t1 && t4 && !t2 && !t3) {
                            // Implicit Single Block (StartCol and EndCol, no middle)
                            // Treated as 2 Bookings
                            isTwoBookings = true;
                        }

                        // Dates for Weekend Check
                        const d = new Date(dateStr);
                        const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                        // 9:30 Check Helper
                        const check930 = () => {
                            if (isWeekend) return false;
                            const targetCheck = 9 * 60 + 30; // 570 min

                            if (isFourBookings && t1 && t2 && t3 && t4) {
                                const s1 = timeToMinutes(t1);
                                const e1 = timeToMinutes(t2);
                                const s2 = timeToMinutes(t3);
                                const e2 = timeToMinutes(t4);
                                return (s1 <= targetCheck && targetCheck < e1) || (s2 <= targetCheck && targetCheck < e2);
                            }

                            if (isTwoBookings) {
                                // Resolve Start/End
                                const sStr = t1;
                                const eStr = t2 || t4; // If Implicit t1-t4
                                if (sStr && eStr) {
                                    const s = timeToMinutes(sStr);
                                    const e = timeToMinutes(eStr);
                                    return s <= targetCheck && targetCheck < e;
                                }
                            }
                            return false;
                        }

                        const workingAt930 = check930();

                        // --- SCENARIO A: 2 BOOKINGS (No Stamp Out) ---
                        if (isTwoBookings) {
                            // Determine Start/End
                            const sStr = t1;
                            const eStr = t2 || t4;

                            if (sStr && eStr) {
                                startTime = sStr;
                                endTime = eStr;

                                const s = timeToMinutes(sStr);
                                const e = timeToMinutes(eStr);
                                let attendance = e - s;
                                if (attendance < 0) attendance += (24 * 60); // Midnight wrap

                                // Base Pause
                                pause = 0;
                                let effectiveAttendance = attendance;

                                // Rule 1: Working at 9:30 -> Deduct 15min FIRST
                                if (workingAt930) {
                                    pause += 15;
                                    effectiveAttendance -= 15;
                                }

                                // Rule 2: > 5.5h (Based on REDUCED attendance) -> +30min
                                if (effectiveAttendance > (5.5 * 60)) {
                                    pause += 30;
                                    // effectiveAttendance -= 30; // Not explicitly requested to chain reductions, usually thresholds are based on the state after previous required breaks?
                                    // User said: "schaust erst dann wie viel die totale Arbeitszeit ist um zu definieren ob arbeitszeit > 5.5h"
                                    // This implies the 15m reduction is the ONLY one that affects the check base? 
                                    // "Standard" assumption: 9:30 break counts as performed. 
                                    // Lunch break is TO BE ADDED. 
                                    // So we check if (Available Time - Mandatory 9:30 Break) > 5.5h. 
                                    // If so, we deduct Lunch.
                                }

                                // Rule 3: > 9h (Based on REDUCED attendance?)
                                // "und wenn nach alldem die total arbeitszeit immernoch über 9h ist" - applied to 4-booking, likely same for 2-booking?
                                // User said for Scenario 1: "schaust erst dann wie viel die totale Arbeitszeit ist um zu definieren ob arbeitszeit > 5.5h oder >9h"
                                // So yes, check against effectiveAttendance.

                                if (effectiveAttendance > (9 * 60)) {
                                    const targetPause = workingAt930 ? 60 : 45;
                                    if (pause < targetPause) {
                                        pause = targetPause;
                                    }
                                }

                                entries.push({
                                    date: dateStr,
                                    type: 'work',
                                    startTime,
                                    endTime,
                                    pauseDuration: pause,
                                    notes: 'Auto-Pause (2 Bookings)',
                                    value: 1.0
                                });
                            }
                        }

                        // --- SCENARIO B: 4 BOOKINGS (Stamped Out) ---
                        else if (isFourBookings && t1 && t2 && t3 && t4) {
                            startTime = t1;
                            endTime = t4;

                            const s1 = timeToMinutes(t1);
                            const e1 = timeToMinutes(t2);
                            const s2 = timeToMinutes(t3);
                            const e2 = timeToMinutes(t4);

                            const rawNet = (e1 - s1) + (e2 - s2); // Pure worked time
                            const gap = s2 - e1; // The actual hole in the day

                            // Rule 1: Lunch Correction
                            // If gap < 30 -> set to 30. Else gap.
                            // UPDATE: Only apply this if Raw Work > 7h
                            let effectivePause = gap;

                            if (rawNet > (7 * 60)) {
                                if (effectivePause < 30) {
                                    effectivePause = 30;
                                }
                            }

                            // Rule 2: Working at 9:30 -> +15min (added to the PAUSE DEDUCTION, reducing Net)
                            if (workingAt930) {
                                effectivePause += 15;
                            }

                            // Calculate Net with these deductions
                            // We start with the full span and subtract the effective pause?
                            // Or we take RawNet and Subtract the "Extra" added pause?
                            // Logic:
                            // Real Gap = 20m.
                            // Effective Pause = 30m. (Added 10m virtual pause).
                            // 9:30 Active -> +15m virtual pause.
                            // Total Virtual Pause = 30 + 15 = 45m.
                            // Real Gap was 20m.
                            // Extra Deduction = 45 - 20 = 25m.
                            // Net Work = RawNet - 25m.

                            const extraDeduction = effectivePause - gap;
                            let currentNet = rawNet - extraDeduction;

                            // Rule 3: > 9h Net -> Ensure min pause 45m or 60m
                            // "if after all this, the total working time is still > 9h"
                            if (currentNet > (9 * 60)) {
                                const targetLimit = workingAt930 ? 60 : 45;

                                // Current Effective Pause vs Target
                                if (effectivePause < targetLimit) {
                                    // Need to increase Effective Pause
                                    const diff = targetLimit - effectivePause;
                                    effectivePause += diff;
                                    // Recalculate Net to be safe, though not needed for output
                                    currentNet -= diff;
                                }
                            }

                            // The "pauseDuration" we store is usually the deducted amount? 
                            // Or the stored pause is just metadata? The app calculates duration as (End-Start) - Pause.
                            // So if Start=08:00, End=17:00 (Span 9h).
                            // If we want Net=8h, Pause must be 60.
                            // Here Span (t4-t1) includes the Gap.
                            // Span = (e2-s1).
                            // Net = Span - Pause.
                            // We want Net to equal `currentNet`.
                            // So Pause = Span - currentNet.

                            const span = e2 - s1;
                            const finalPause = span - currentNet;

                            entries.push({
                                date: dateStr,
                                type: 'work',
                                startTime,
                                endTime,
                                pauseDuration: Math.round(finalPause),
                                notes: 'Auto-Pause (4 Bookings)',
                                value: 1.0
                            });
                        }
                        // Helper for fallbacks or unhandled cases? 
                        // The previous logic covered t1/t2 case. 
                        // What if t1/t4 only but no t2/t3? Covered by isTwoBookings logic above.

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
                                notes: note,
                                value: 1.0
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
