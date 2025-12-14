import React, { useEffect, useState } from 'react';
import { storage, type TimeEntry, type UserConfig } from '../lib/storage';
import { Bug } from 'lucide-react';
import { isWeekend, eachDayOfInterval, format } from 'date-fns';

const DebugPage: React.FC = () => {
    const [config, setConfig] = useState<UserConfig | null>(null);
    const [entries, setEntries] = useState<TimeEntry[]>([]);

    const loadData = async () => {
        const cfg = await storage.getUserConfig();
        const data = await storage.getEntries();
        setConfig(cfg);
        setEntries(data);
    };

    useEffect(() => {
        loadData();
    }, []);

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

    // Calculate daily balances for debug
    const dailyBalances = new Map<string, number>();

    // Determine date range
    if (entries.length === 0) return <div>No data</div>;

    // Sort entries by date ascending
    const sortedEntriesRaw = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const minDate = new Date(sortedEntriesRaw[0].date);
    const maxDate = new Date(); // Today

    const daysInRange = eachDayOfInterval({ start: minDate, end: maxDate });
    const processedEntries: (TimeEntry & {
        isMissing?: boolean,
        _debugCount: number,
        _debugWeeklyAcc: number
    })[] = []; // Unified list of real + missing entries

    // Calculate Running Totals (Chronologically)
    const runningTotals = new Map<string, number>();
    let currentTotal = -1029; // Start at -17:09 (-1029 minutes)
    let weeklyWorkAccumulator = 0; // Track actual work per week for 45h rule

    daysInRange.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayEntries = entries.filter(e => e.date === dateStr);
        const isWknd = isWeekend(day);

        // Skip future days if maxDate includes time (it shouldn't matter much with startOfDay but safe check)

        let worked = 0;
        let credit = 0;
        const dailyTargetMin = (config?.weeklyTargetHours || 40) / 5 * 60;

        // Calculate Data needed for accumulation first
        if (dayEntries.length > 0) {
            dayEntries.filter(e => e.type === 'work').forEach(e => worked += calculateDuration(e));

            // Credit (Weekdays only)
            if (!isWknd) {
                const excuseEntries = dayEntries.filter(e => ['vacation', 'sick', 'accident', 'holiday', 'school', 'special', 'trip'].includes(e.type));
                if (excuseEntries.length > 0) {
                    excuseEntries.forEach(e => {
                        const lowerNote = (e.notes || '').toLowerCase();
                        if (lowerNote.includes('vormittag') || lowerNote.includes('nachmittag')) {
                            credit += (dailyTargetMin / 2);
                        } else {
                            credit += dailyTargetMin;
                        }
                    });
                }
            }
        }

        // Logic branching for Display
        if (dayEntries.length === 0) {
            // Missing Day Logic
            if (!isWknd) {
                // strictBalance = 0 (worked) - target = -target
                const strictBalance = -dailyTargetMin;
                currentTotal += strictBalance;

                dailyBalances.set(dateStr, strictBalance);
                runningTotals.set(dateStr, currentTotal);

                processedEntries.push({
                    id: 0, // Mock ID for debug view
                    date: dateStr,
                    type: 'other', // Fallback type
                    startTime: '-',
                    endTime: '-',
                    pauseDuration: 0,
                    notes: 'Kein Eintrag (Soll nicht erfüllt)',
                    isMissing: true,
                    _debugCount: 0,
                    _debugWeeklyAcc: weeklyWorkAccumulator
                });
            }
            // Empty Weekend -> Do nothing for display (except maybe debug row?)
        } else {
            // Real Entry Logic
            // Strict Balance
            let strictTarget = dailyTargetMin;
            if (isWknd) strictTarget = 0;
            const strictBalance = (worked + credit) - strictTarget;

            currentTotal += strictBalance;
            dailyBalances.set(dateStr, strictBalance);
            runningTotals.set(dateStr, currentTotal);

            // Add real entries to list
            dayEntries.forEach(e => processedEntries.push({ ...e, _debugCount: dayEntries.length, _debugWeeklyAcc: weeklyWorkAccumulator + worked + credit }));
        }

        // GLOBAL: Update Weekly Accumulator (Runs for empty days too, adding 0)
        weeklyWorkAccumulator += (worked + credit);
        const currentWkAcc = weeklyWorkAccumulator;

        // GLOBAL: End of Week Check (Runs for empty days too!)
        if (day.getDay() === 0) { // Sunday
            const cap = 45 * 60;
            if (weeklyWorkAccumulator > cap) {
                const deduction = weeklyWorkAccumulator - cap;
                currentTotal -= deduction;
                runningTotals.set(dateStr, currentTotal);

                processedEntries.push({
                    id: 0, // Mock ID for debug
                    date: dateStr,
                    type: 'other', // Fallback
                    startTime: '',
                    endTime: '',
                    pauseDuration: 0,
                    notes: `Übertrag Überzeit: -${formatDuration(deduction)} (>45h)`,
                    isMissing: true,
                    _debugCount: dayEntries.length,
                    _debugWeeklyAcc: currentWkAcc
                });
            }
            weeklyWorkAccumulator = 0;
        }
    });

    // Reverse for Missing Days check? Actually user asked for Ascending.
    // processedEntries is already built roughly in chronological order because daysInRange is chronological.
    // However, if multiple entries exist on one day, they are pushed in block.
    // We should ensure the final list is flat and sorted? It is already.

    return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex items-center gap-4">
                <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
                    <Bug size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Debug Console</h1>
                    <p className="text-slate-400">Interne Berechnungsdetails</p>
                </div>
            </header>

            <div className="flex gap-4">
                <button
                    onClick={async () => {
                        if (confirm('Wirklich alle Duplikate entfernen?')) {
                            const count = await storage.deduplicateEntries();
                            alert(`${count} Duplikate entfernt.`);
                            loadData();
                        }
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors"
                >
                    Dubletten entfernen
                </button>
            </div>

            {/* Debug Section: Raw Entries */}
            <div className="mt-8 p-4 bg-black/30 rounded-xl font-mono text-xs text-slate-400 overflow-x-auto">
                <h3 className="font-bold text-slate-200 mb-2">Details (Zeile für Zeile) - Ohne Duration Spalte</h3>
                <div className="min-w-[800px]">
                    <div className="grid grid-cols-10 gap-2 border-b border-slate-600 pb-1 mb-1 font-bold">
                        <div>Date</div>
                        <div>Type</div>
                        <div>Count</div>
                        <div>Wk. Acc.</div>
                        <div>Start</div>
                        <div>End</div>
                        <div>Pause</div>
                        <div>Day Saldo</div>
                        <div>Total</div>
                        <div>Notes</div>
                    </div>
                    {processedEntries.map(e => {
                        const strictBalance = dailyBalances.get(e.date) || 0;
                        const total = runningTotals.get(e.date) || 0;

                        return (
                            <div key={e.id} className={`grid grid-cols-10 gap-2 hover:bg-white/5 py-1 border-b border-white/5 items-center ${e.isMissing ? 'text-rose-500/50' : ''}`}>
                                <div>{e.date}</div>
                                <div>{e.type}</div>
                                <div className={e._debugCount > 1 ? "text-rose-500 font-bold" : "text-slate-600"}>{e._debugCount || 1}</div>
                                <div className="text-indigo-400">{e._debugWeeklyAcc ? formatDuration(e._debugWeeklyAcc) : '-'}</div>
                                <div>{e.startTime || '-'}</div>
                                <div>{e.endTime || '-'}</div>
                                <div>{e.pauseDuration || 0}m</div>
                                <div className={strictBalance >= 0 ? "text-sky-400 font-bold" : "text-rose-400 font-bold"}>
                                    {formatDuration(strictBalance)}
                                </div>
                                <div className={total >= 0 ? "text-emerald-400 font-bold" : "text-orange-400 font-bold"}>
                                    {formatDuration(total)}
                                </div>
                                <div className="truncate">{e.notes || '-'}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default DebugPage;
