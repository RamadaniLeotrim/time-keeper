import React, { useEffect, useState } from 'react';
import { storage, type TimeEntry, type UserConfig } from '../lib/storage';
import TimeEntryModal from '../components/TimeEntryModal';
import { Plus, Clock, Sun, TrendingUp, Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import { startOfYear, startOfMonth, startOfWeek, eachDayOfInterval, isWeekend, format, startOfDay, isBefore, isSameDay } from 'date-fns';

const Dashboard: React.FC = () => {
    const [config, setConfig] = useState<UserConfig | null>(null);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [currentEntry, setCurrentEntry] = useState<TimeEntry | undefined>(undefined);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Stats
    const [yearBalance, setYearBalance] = useState(0);
    const [overtimeBalance, setOvertimeBalance] = useState(0);
    const [monthBalance, setMonthBalance] = useState(0);
    const [weekBalance, setWeekBalance] = useState(0);
    const [vacationBalance, setVacationBalance] = useState(0);

    const loadData = async () => {
        const cfg = await storage.getUserConfig();
        const data = await storage.getEntries();
        setConfig(cfg);
        setEntries(data);
        calculateStats(cfg, data);
    };

    useEffect(() => {
        loadData();
    }, []);

    const calculateStats = (cfg: UserConfig, data: TimeEntry[]) => {
        const dailyTargetMin = (cfg.weeklyTargetHours / 5) * 60;
        const today = startOfDay(new Date());

        // Helper to process a range and return { flexBalance, overtimeBalance, monthBalance, weekBalance }
        // To do this correctly for Year/Month/Week separately while respecting weekly OT rules is tricky.
        // Actually, the Overtime separation usually applies to the Year Balance (Long term account).
        // Month stats are usually just snapshots of "Work - Target" without complex OT separation, OR they should also reflect it?
        // User asked for "Gleitzeitkonto" (Year Balance) correction.
        // We will calculate the Year Balance by iterating ALL weeks from start of year.

        // We need a robust "By Week" aggregator for the entire year.

        const startOfCalculation = startOfYear(today);
        const endOfCalculation = today; // Inclusive

        const days = eachDayOfInterval({ start: startOfCalculation, end: endOfCalculation });

        // Group by ISO Week to apply 45h rule
        // Key: "YYYY-Wnn"
        const weeks: Record<string, { work: number, target: number, days: Date[] }> = {};

        days.forEach(day => {
            // Skip if future (though eachDayOfInterval shouldn't go past end)
            if (isBefore(today, day)) return;

            // Determine Week Key (ISO)
            // Use format 'I-w' (ISO Year - ISO Week)
            const weekKey = format(day, 'I-w');

            if (!weeks[weekKey]) {
                weeks[weekKey] = { work: 0, target: 0, days: [] };
            }
            weeks[weekKey].days.push(day);

            const dayEntries = data.filter(e => e.date === format(day, 'yyyy-MM-dd'));

            // 1. Calculate Daily Work & Credit
            // Logic copied from previous calcBalanceForPeriod

            let dailyWork = 0;
            let dailyCredit = 0;

            // Check Weekend
            if (isWeekend(day)) {
                // Weekend: Work counts, Target is 0.
                dayEntries.filter(e => e.type === 'work').forEach(e => {
                    dailyWork += calculateDuration(e);
                });
                // No target addition
            } else {
                // Weekday
                // Check Absences
                const excuseEntries = dayEntries.filter(e => ['vacation', 'sick', 'accident', 'holiday', 'school', 'special', 'trip'].includes(e.type));
                if (excuseEntries.length > 0) {
                    excuseEntries.forEach(e => {
                        const lowerNote = (e.notes || '').toLowerCase();
                        if (lowerNote.includes('vormittag') || lowerNote.includes('nachmittag')) {
                            dailyCredit += (dailyTargetMin / 2);
                        } else {
                            dailyCredit += dailyTargetMin;
                        }
                    });
                }

                // Work
                dayEntries.filter(e => e.type === 'work').forEach(e => {
                    dailyWork += calculateDuration(e);
                });

                // Target
                // If Today: Target is 0 (Real-time view). 
                // BUT for weekly OT calculation, we usually compare against full target? 
                // If I check "Today" stats, I see my current progress.
                // If simple view: Target applies if day is past or explicit handling.
                // Previous logic: effectiveTarget = isSameDay(day, today) ? 0 : dailyTargetMin;
                // This logic implies "Today's balance starts at 0 and goes up".
                // However, for the 45h rule, if I worked 46h by Wednesday, I have 1h OT.
                // If I assume target=0 for today, my "Weekly Work vs Target" calc is skewed?
                // Actually, the 45h rule is usually "Work Done > 45h". Target doesn't obscure the Work amount.
                // So we sum WORK independently of TARGET.

                weeks[weekKey].target += dailyTargetMin;
            }

            weeks[weekKey].work += (dailyWork + dailyCredit);
            // Note: Credit counts as work time for 45h limit? 
            // Usually yes. If I am sick 42h and work 5h, I have 47h -> 2h OT? 
            // Or does OT only come from REAL work?
            // "Gleitzeit" usually includes excuses. Let's assume Credit counts towards the limit.
        });

        let totalFlex = 0;
        let totalOT = 0;

        // Iterate Weeks and apply rule
        Object.values(weeks).forEach(week => {
            const rawWork = week.work;
            const weekTarget = week.target;

            // Rule: Max 45h (2700 min) into Flex
            const cap = 45 * 60;

            let creditedToFlex = rawWork;
            let toOt = 0;

            if (rawWork > cap) {
                creditedToFlex = cap;
                toOt = rawWork - cap;
            }

            // Flex Balance for this week
            const weekFlexBalance = creditedToFlex - weekTarget;

            totalFlex += weekFlexBalance;
            totalOT += toOt;
        });

        // Add Initial Offset to Flex (from Settings)
        const initialBalance = cfg.initialOvertimeBalance || 0;
        setYearBalance(totalFlex + initialBalance);
        setOvertimeBalance(totalOT); // Overtime account usually starts at 0 or should we also have initial OT? 
        // User asked for "-17:09h" start for *calculation*. 
        // "Die Rechnung ab -17:09h". Usually this implies the Flex Account starts there.
        // Overtime Account is separate. 
        // We will apply it to Year Balance (Flex).


        // Re-calculate simple Month/Week balances for display (Standard Logic, no OT separation for small views or? 
        // User said "In App -00:10h because 8min are OT". 
        // This implies the specific "Current Week" balance should ALSO show the capped version? 
        // Or is "Week Balance" just a simple Net?
        // Usually "Week Balance" in UI means "How am I doing this week against 41h".
        // If I worked 46h, am I +5h or +4h? 
        // If I have separate OT account, I am +4h Flex and +1h OT.
        // So the Week Display should probably reflect the FLEX part.

        // Month
        // Let's reuse the week logic but filter for weeks in month? 
        // Week boundaries don't align with Month.
        // Simple approach for Month/Week: Just run the standard calc (Uncapped) OR run the same capped logic relative to the period.
        // User complaint was about the "Total Balance" (Gleitzeitkonto).
        // Let's keep Month/Week simple for now unless requested, OR apply same CAP if the period covers a full week?
        // Let's stick to the previous simple logic for Month/Week for stability, but strictly fix Year/Gleitzeit.
        // Actually, if I work 46h this week, and my Week Balance says +5h, but Year says +4h, it's confusing.
        // But "Week Balance" is usually ephemeral.
        // Let's Recalculate Month/Week using standard unchecked linear logic for now to avoid complexity regarding partial weeks. 
        // The User specifically mentioned "Es können nur 3h in das Gleitzeitkonto gehen" referring to the stored total.

        const calcSimpleBalance = (start: Date, end: Date) => {
            // ... [Previous Logic Implementation copy or reuse]
            // We can extract the inner loop of previous function.
            // For brevity, I will inline a simplified version or restore the previous function as helper.
            // To avoid code duplication, I'll keep the logic inline.
            let bal = 0;
            const range = eachDayOfInterval({ start, end });
            range.forEach(day => {
                if (isBefore(today, day)) return;
                const dayStr = format(day, 'yyyy-MM-dd');
                const dayEntries = data.filter(e => e.date === dayStr);
                if (isSameDay(day, today) && dayEntries.length === 0) return;

                // Calc per day
                let w = 0;
                let c = 0;
                let t = 0;

                if (isWeekend(day)) {
                    t = 0;
                } else {
                    t = dailyTargetMin;
                    // Absences
                    const exc = dayEntries.filter(e => ['vacation', 'sick', 'accident', 'holiday', 'school', 'special', 'trip'].includes(e.type));
                    exc.forEach(e => {
                        const n = (e.notes || '').toLowerCase();
                        if (n.includes('vormittag') || n.includes('nachmittag')) c += dailyTargetMin / 2;
                        else c += dailyTargetMin;
                    });
                }

                dayEntries.filter(e => e.type === 'work').forEach(e => w += calculateDuration(e));
                bal += (w + c) - t;
            });
            return bal;
        };

        setMonthBalance(calcSimpleBalance(startOfMonth(today), today));
        setWeekBalance(calcSimpleBalance(startOfWeek(today, { weekStartsOn: 1 }), today));

        // Vacation Balance
        const taken = data.filter(e => e.type === 'vacation').length;
        const carryover = cfg.vacationCarryover || 0;
        setVacationBalance((cfg.yearlyVacationDays + carryover) - taken);
    };

    const calculateDuration = (e: TimeEntry) => {
        if (!e.startTime || !e.endTime) return 0;
        const start = parseTime(e.startTime);
        const end = parseTime(e.endTime);
        return (end - start) - (e.pauseDuration || 0);
    };

    const parseTime = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const formatDuration = (minutes: number) => {
        const prefix = minutes >= 0 ? '+' : '-';
        const abs = Math.abs(Math.round(minutes));
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        return `${prefix} ${h}h ${m}m`;
    };

    const handleEditEntry = (entry: TimeEntry) => {
        setCurrentEntry(entry);
        setIsModalOpen(true);
    };

    // Debug Helper
    // const debugDays = () => {
    //     const today = startOfDay(new Date());
    //     const days = eachDayOfInterval({ start: subDays(today, 6), end: today });
    //     return days.map(day => {
    //         const dayStr = format(day, 'yyyy-MM-dd');
    //         const dayEntries = entries.filter(e => e.date === dayStr);
    //         const isWknd = isWeekend(day);
    //         const dailyTargetMin = (config?.weeklyTargetHours || 40) / 5 * 60;

    //         // logic replication
    //         let worked = 0;
    //         let credit = 0;
    //         let target = dailyTargetMin;

    //         if (isWknd) {
    //             target = 0;
    //         }

    //         // Check work
    //         dayEntries.filter(e => e.type === 'work').forEach(e => worked += calculateDuration(e));

    //         // Check excuse
    //         const excuseEntries = dayEntries.filter(e => ['vacation', 'sick', 'accident', 'holiday', 'school'].includes(e.type));
    //         if (excuseEntries.length > 0) {
    //             excuseEntries.forEach(e => {
    //                 const lowerNote = (e.notes || '').toLowerCase();
    //                 if (lowerNote.includes('vormittag') || lowerNote.includes('nachmittag')) {
    //                     credit += (dailyTargetMin / 2);
    //                 } else {
    //                     credit += dailyTargetMin;
    //                 }
    //             });
    //         }

    //         // Today Logic
    //         const isToday = isSameDay(day, today);
    //         if (isToday) target = 0;
    //         else if (isWknd) target = 0; // redundant but safe

    //         // Delta
    //         const delta = (worked + credit) - target;

    //         return { date: dayStr, worked, credit, target, delta, isToday };
    //     });
    // };

    return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Übersicht</h1>
                    <p className="text-slate-400">Willkommen zurück!</p>
                </div>
                <button
                    onClick={() => {
                        setCurrentEntry(undefined);
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl shadow-lg transition-all transform hover:scale-105"
                >
                    <Plus size={20} />
                    <span className="font-semibold">Neuer Eintrag</span>
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Year Balance (Main) */}
                <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 shadow-xl backdrop-blur-sm md:col-span-2">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Calendar size={18} />
                            <h3 className="text-sm font-medium uppercase tracking-wider">Jahressaldo (Aktuell)</h3>
                        </div>
                        <TrendingUp className={yearBalance >= 0 ? "text-emerald-400" : "text-rose-400"} size={20} />
                    </div>
                    <p className={`text-5xl font-bold mb-4 ${yearBalance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatDuration(yearBalance)}
                    </p>

                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-700/50">
                        <div>
                            <div className="flex items-center gap-2 text-slate-500 mb-1">
                                <CalendarDays size={14} />
                                <span className="text-xs uppercase font-bold">Monat</span>
                            </div>
                            <p className={`text-xl font-bold ${monthBalance >= 0 ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                                {formatDuration(monthBalance)}
                            </p>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-slate-500 mb-1">
                                <CalendarRange size={14} />
                                <span className="text-xs uppercase font-bold">Woche</span>
                            </div>
                            <p className={`text-xl font-bold ${weekBalance >= 0 ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                                {formatDuration(weekBalance)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 shadow-xl backdrop-blur-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Restzurlaub</h3>
                        <Sun className="text-amber-400" size={20} />
                    </div>
                    <div>
                        <p className="text-4xl font-bold text-amber-400">
                            {vacationBalance} <span className="text-base font-normal text-amber-400/70">Tage</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                            Von {config ? (config.yearlyVacationDays + (config.vacationCarryover || 0)) : 25} Tagen verfügbar
                            {config?.vacationCarryover ? ` (inkl. ${config.vacationCarryover} Übertrag)` : ''}
                        </p>
                    </div>
                </div>

                {/* Overtime Card */}
                <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 shadow-xl backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Überzeit</h3>
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <TrendingUp className="text-indigo-400" size={20} />
                        </div>
                    </div>
                    <div>
                        <p className={`text-4xl font-bold ${overtimeBalance > 0 ? "text-indigo-400" : "text-slate-500"}`}>
                            {formatDuration(overtimeBalance)}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">Gesammelt durch &gt;45h/Woche</p>
                    </div>
                </div>
            </div>

            {/* Recent Entries List */}
            <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4 text-white">Letzte Aktivitäten</h2>
                <div className="bg-slate-800/40 rounded-2xl border border-slate-700/50 overflow-hidden">
                    {entries.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                            <Clock size={48} className="mb-4 opacity-20" />
                            <p>Noch keine Einträge vorhanden.</p>
                            <button onClick={() => setIsModalOpen(true)} className="text-sky-400 hover:text-sky-300 text-sm mt-2 font-medium">
                                Den ersten Eintrag erstellen &rarr;
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-700/50">
                            {entries.slice(0, 5).map((e, i) => (
                                <div key={i} onClick={() => handleEditEntry(e)} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${e.type === 'work' ? 'bg-sky-500/10 text-sky-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                            {e.type === 'work' ? <Clock size={20} /> : <Sun size={20} />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{e.date}</p>
                                            <p className="text-sm text-slate-400 capitalize">{e.type}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {e.type === 'work' ? (
                                            <>
                                                <p className="font-medium text-white">{e.startTime} - {e.endTime}</p>
                                                <p className="text-xs text-slate-500">Pause: {e.pauseDuration}m</p>
                                            </>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full bg-slate-700 text-xs text-slate-300">Ganztägig</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <TimeEntryModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setCurrentEntry(undefined);
                }}
                existingEntry={currentEntry}
                onSave={async (entry) => {
                    if (currentEntry) {
                        await storage.updateTimeEntry(currentEntry.id, entry);
                    } else {
                        await storage.addTimeEntry(entry);
                    }
                    await loadData();
                }}
                onDelete={currentEntry ? async () => {
                    await storage.deleteTimeEntry(currentEntry.id);
                    await loadData();
                } : undefined}
            />
        </div>
    );
};

export default Dashboard;
