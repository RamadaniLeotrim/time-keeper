import React, { useEffect, useState } from 'react';
import { storage, type TimeEntry, type UserConfig } from '../lib/storage';
import TimeEntryModal from '../components/TimeEntryModal';
import LoadingOverlay from '../components/LoadingOverlay';
import { Plus, Clock, Sun, TrendingUp, Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import { startOfYear, startOfMonth, startOfWeek, eachDayOfInterval, isWeekend, format, startOfDay, isBefore, isSameDay } from 'date-fns';

const Dashboard: React.FC = () => {
    const [config, setConfig] = useState<UserConfig | null>(null);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [currentEntry, setCurrentEntry] = useState<TimeEntry | undefined>(undefined);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Stats
    const [yearBalance, setYearBalance] = useState(0);
    const [overtimeBalance, setOvertimeBalance] = useState(0);
    const [monthBalance, setMonthBalance] = useState(0);
    const [weekBalance, setWeekBalance] = useState(0);
    const [vacationBalance, setVacationBalance] = useState(0);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const cfg = await storage.getUserConfig();
            const data = await storage.getEntries();
            setConfig(cfg);
            setEntries(data);
            calculateStats(cfg, data);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const calculateStats = (cfg: UserConfig, data: TimeEntry[]) => {
        const dailyTargetMin = (cfg.weeklyTargetHours / 5) * 60;
        const today = startOfDay(new Date());

        const startOfCalculation = startOfYear(today);
        const endOfCalculation = today;

        const days = eachDayOfInterval({ start: startOfCalculation, end: endOfCalculation });

        const weeks: Record<string, { work: number, target: number, days: Date[] }> = {};

        days.forEach(day => {
            if (isBefore(today, day)) return;
            const weekKey = format(day, 'I-w');

            if (!weeks[weekKey]) {
                weeks[weekKey] = { work: 0, target: 0, days: [] };
            }
            weeks[weekKey].days.push(day);

            const dayEntries = data.filter(e => e.date === format(day, 'yyyy-MM-dd'));

            let dailyWork = 0;
            let dailyCredit = 0;

            if (isWeekend(day)) {
                dayEntries.filter(e => e.type === 'work').forEach(e => {
                    dailyWork += calculateDuration(e);
                });
            } else {
                const excuseEntries = dayEntries.filter(e => ['vacation', 'sick', 'accident', 'holiday', 'school', 'special', 'trip'].includes(e.type));
                if (excuseEntries.length > 0) {
                    excuseEntries.forEach(e => {
                        const val = e.value || 1.0;
                        dailyCredit += (dailyTargetMin * val);
                    });
                }

                dayEntries.filter(e => e.type === 'work').forEach(e => {
                    dailyWork += calculateDuration(e);
                });

                weeks[weekKey].target += dailyTargetMin;
            }

            weeks[weekKey].work += (dailyWork + dailyCredit);
        });

        let totalFlex = 0;
        let totalOT = 0;

        Object.values(weeks).forEach(week => {
            const rawWork = week.work;
            const weekTarget = week.target;
            const cap = 45 * 60;

            let creditedToFlex = rawWork;
            let toOt = 0;

            if (rawWork > cap) {
                creditedToFlex = cap;
                toOt = rawWork - cap;
            }

            const weekFlexBalance = creditedToFlex - weekTarget;

            totalFlex += weekFlexBalance;
            totalOT += toOt;
        });

        const initialBalance = cfg.initialOvertimeBalance || 0;
        setYearBalance(totalFlex + initialBalance);
        setOvertimeBalance(totalOT);

        const calcSimpleBalance = (start: Date, end: Date) => {
            let bal = 0;
            const range = eachDayOfInterval({ start, end });
            range.forEach(day => {
                if (isBefore(today, day)) return;
                const dayStr = format(day, 'yyyy-MM-dd');
                const dayEntries = data.filter(e => e.date === dayStr);
                if (isSameDay(day, today) && dayEntries.length === 0) return;

                let w = 0;
                let c = 0;
                let t = 0;

                if (isWeekend(day)) {
                    t = 0;
                } else {
                    t = dailyTargetMin;
                    const exc = dayEntries.filter(e => ['vacation', 'sick', 'accident', 'holiday', 'school', 'special', 'trip'].includes(e.type));
                    exc.forEach(e => {
                        const val = e.value || 1.0;
                        c += (dailyTargetMin * val);
                    });
                }

                dayEntries.filter(e => e.type === 'work').forEach(e => w += calculateDuration(e));
                bal += (w + c) - t;
            });
            return bal;
        };

        setMonthBalance(calcSimpleBalance(startOfMonth(today), today));
        setWeekBalance(calcSimpleBalance(startOfWeek(today, { weekStartsOn: 1 }), today));

        const taken = data.filter(e => e.type === 'vacation').reduce((sum, e) => sum + (e.value || 1.0), 0);
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

    if (isLoading && entries.length === 0) {
        return <LoadingOverlay isLoading={true} />;
    }

    return (
        <div className="space-y-6 animate-fade-in relative">
            <LoadingOverlay isLoading={isLoading} />

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
                    {entries.length === 0 && !isLoading ? (
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
                                            <span className="px-3 py-1 rounded-full bg-slate-700 text-xs text-slate-300">
                                                {(e.value === 0.5) ? 'Halbtags' : 'Ganztägig'}
                                            </span>
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
