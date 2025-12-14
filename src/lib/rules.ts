export const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

export const minutesToTime = (mins: number): string => {
    const h = Math.floor(Math.abs(mins) / 60);
    const m = Math.round(Math.abs(mins) % 60);
    const sign = mins < 0 ? '-' : '';
    return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export interface WorkCalculation {
    rawDuration: number; // Total span or raw worked mins
    pauseDuration: number;
    netDuration: number;
    rulesApplied: string[];
}

export const calculateWorkDetails = (
    t1: string | null,
    t2: string | null,
    t3: string | null,
    t4: string | null
): WorkCalculation => {
    const log: string[] = [];

    // Default Result
    let result: WorkCalculation = {
        rawDuration: 0,
        pauseDuration: 0,
        netDuration: 0,
        rulesApplied: []
    };

    if (!t1) return result;

    // Detect Scenario
    let isFourBookings = false;
    let isTwoBookings = false;

    // Normalize inputs
    // If t1, t2, t3, t4 -> 4 bookings
    // If t1, t2 -> 2 bookings
    // If t1, t4 with no t2/t3 -> 2 bookings (Implicit)

    if (t1 && t2 && t3 && t4) isFourBookings = true;
    else if (t1 && t4 && t2 && t3) isFourBookings = true;
    else if (t1 && t2 && !t3 && !t4) isTwoBookings = true;
    else if (t1 && t4 && !t2 && !t3) isTwoBookings = true;

    if (!isFourBookings && !isTwoBookings) {
        // Fallback or partial data
        return result;
    }

    // Check 9:30 Rule
    // We assume standard usage (not weekend check here as we don't have date, user can check manually or we assume valid workday)
    const check930 = () => {
        const targetCheck = 9 * 60 + 30; // 570 min
        if (isFourBookings && t1 && t2 && t3 && t4) {
            const s1 = timeToMinutes(t1);
            const e1 = timeToMinutes(t2);
            const s2 = timeToMinutes(t3);
            const e2 = timeToMinutes(t4);
            return (s1 <= targetCheck && targetCheck < e1) || (s2 <= targetCheck && targetCheck < e2);
        }
        if (isTwoBookings) {
            const sStr = t1;
            const eStr = t2 || t4;
            if (sStr && eStr) {
                const s = timeToMinutes(sStr);
                const e = timeToMinutes(eStr);
                return s <= targetCheck && targetCheck < e;
            }
        }
        return false;
    };

    const workingAt930 = check930();
    if (workingAt930) log.push("Arbeit um 09:30 erkannt (+15min Pause/Abzug)");

    // Logic Implementation

    if (isTwoBookings) {
        const sStr = t1;
        const eStr = t2 || t4;
        if (sStr && eStr) {
            const s = timeToMinutes(sStr);
            const e = timeToMinutes(eStr);
            let attendance = e - s;
            if (attendance < 0) attendance += (24 * 60); // Midnight wrap

            result.rawDuration = attendance;
            let pause = 0;
            let effectiveAttendance = attendance;

            // Rule 1: 9:30
            if (workingAt930) {
                pause += 15;
                effectiveAttendance -= 15;
            }

            // Rule 2: > 5.5h
            if (effectiveAttendance > (5.5 * 60)) {
                pause += 30;
                log.push("Netto-Arbeit > 5.5h (+30min Pause)");
            }

            // Rule 3: > 9h
            if (effectiveAttendance > (9 * 60)) {
                const targetPause = workingAt930 ? 60 : 45;
                if (pause < targetPause) {
                    log.push(`Netto-Arbeit > 9h (Pause auf ${targetPause}min erhöht)`);
                    pause = targetPause;
                }
            }

            result.pauseDuration = pause;
            result.netDuration = attendance - pause;
        }
    } else if (isFourBookings && t1 && t2 && t3 && t4) {
        const s1 = timeToMinutes(t1);
        const e1 = timeToMinutes(t2);
        const s2 = timeToMinutes(t3);
        const e2 = timeToMinutes(t4);

        const rawNet = (e1 - s1) + (e2 - s2);
        const gap = s2 - e1;

        result.rawDuration = rawNet; // Actually raw worked time is usually what users equate to 'duration' sum, or span? 
        // In 4-booking, Raw Duration usually means Sum of Blocks. 
        // Span is e2 - s1.

        // Rule 1: Lunch Correction
        let effectivePause = gap;

        // UPDATE 7h Rule
        if (rawNet > (7 * 60)) {
            if (effectivePause < 30) {
                effectivePause = 30;
                log.push("Mittagspause < 30min & Arbeit > 7h (Pause auf 30min gesetzt)");
            }
        }

        // Rule 2: 9:30
        if (workingAt930) {
            effectivePause += 15;
        }

        const extraDeduction = effectivePause - gap;
        const currentNet = rawNet - extraDeduction;

        // Rule 3: > 9h
        if (currentNet > (9 * 60)) {
            const targetLimit = workingAt930 ? 60 : 45;
            if (effectivePause < targetLimit) {
                const diff = targetLimit - effectivePause;
                effectivePause += diff;
                log.push(`Netto > 9h (Pause auf ${targetLimit}min erhöht)`);
            }
        }

        // Final Calculation
        const span = e2 - s1;
        // The "Pause" shown is usually Span - Net.
        // Because "EffectivePause" includes the virtual deductions.

        // Recalculate Net based on Final Effective Pause
        // Net = RawNet - (FinalEffectivePause - Gap)
        //     = RawNet - FinalEffectivePause + Gap
        // AND Span = RawNet + Gap
        // So Net = Span - FinalEffectivePause

        result.netDuration = span - effectivePause;
        result.pauseDuration = Math.round(effectivePause);

        // Alternative View: "Pause" often simply means "Time I didn't get paid for between Start and End".
        // = Span - Net.
        // = effectivePause. Correct.
    }

    result.rulesApplied = log;
    return result;
};
