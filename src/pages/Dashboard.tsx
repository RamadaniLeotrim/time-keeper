import React, { useEffect, useState } from 'react';
import { storage, type TimeEntry, type UserConfig } from '../lib/storage';
import TimeEntryModal from '../components/TimeEntryModal';
import { Plus, Clock, Sun, TrendingUp, Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import { startOfYear, startOfMonth, startOfWeek, eachDayOfInterval, isWeekend, format, startOfDay, isBefore } from 'date-fns';

const Dashboard: React.FC = () => {
    const [config, setConfig] = useState<UserConfig | null>(null);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [currentEntry, setCurrentEntry] = useState<TimeEntry | undefined>(undefined);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Stats
    const [yearBalance, setYearBalance] = useState(0);
    const [monthBalance, setMonthBalance] = useState(0);
    const [weekBalance, setWeekBalance] = useState(0);
    const [vacationBalance, setVacationBalance] = useState(0);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const cfg = await storage.getUserConfig();
        const data = await storage.getEntries();
        setConfig(cfg);
        setEntries(data);
        calculateStats(cfg, data);
    };

    const calculateStats = (cfg: UserConfig, data: TimeEntry[]) => {
        const dailyTargetMin = (cfg.weeklyTargetHours / 5) * 60;
        const today = startOfDay(new Date());

        const calcBalanceForPeriod = (start: Date, end: Date) => {
            let balance = 0;
            const days = eachDayOfInterval({ start, end });

            days.forEach(day => {
                // Skip future days (if end is today, iterate up to today)
                if (isBefore(today, day)) return;

                // Robust date comparison string
                const dayStr = format(day, 'yyyy-MM-dd');
                const dayEntries = data.filter(e => e.date === dayStr);

                // Check Weekend
                // Logic: Weekends have 0 Target. Worked hours count fully as Plus.
                // Empty weekend days do NOT reduce balance ('return' skips subtraction).
                if (isWeekend(day)) {
                    dayEntries.forEach(e => {
                        if (e.type === 'work' && e.startTime && e.endTime) {
                            const duration = calculateDuration(e);
                            balance += duration;
                        }
                    });
                    return;
                }

                // Weekday
                // If any entry types are 'vacation', 'sick', 'holiday' -> Target is fulfilled (0 delta)
                // Actually, often these count as "Target Hours Worked".
                const isExcused = dayEntries.some(e => ['vacation', 'sick', 'accident', 'holiday', 'school'].includes(e.type));

                if (isExcused) {
                    // Balance doesn't change (0 diff from target)
                    // Or strictly: Work = Target. Diff = 0.
                    return;
                }

                // Work entries
                const workEntries = dayEntries.filter(e => e.type === 'work');
                let workedMin = 0;
                workEntries.forEach(e => {
                    workedMin += calculateDuration(e);
                });

                balance += (workedMin - dailyTargetMin);
            });
            return balance;
        };

        // 1. Year Balance (From 1.1.)
        setYearBalance(calcBalanceForPeriod(startOfYear(today), today));

        // 2. Month Balance (From 1. of Month)
        setMonthBalance(calcBalanceForPeriod(startOfMonth(today), today));

        // 3. Week Balance (From Monday)
        setWeekBalance(calcBalanceForPeriod(startOfWeek(today, { weekStartsOn: 1 }), today));

        // Vacation Balance
        const taken = data.filter(e => e.type === 'vacation').length;
        setVacationBalance(cfg.yearlyVacationDays - taken);
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

    return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Übersicht</h1>
                    <p className="text-slate-400">Willkommen zurück!</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Year Balance (Main) */}
                <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 shadow-xl backdrop-blur-sm md:col-span-2">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Calendar size={18} />
                            <h3 className="text-sm font-medium uppercase tracking-wider">Jahressaldo</h3>
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
                        <p className="text-xs text-slate-500 mt-2">Von {config?.yearlyVacationDays} Tagen verfügbar</p>
                    </div>
                </div>

                <div
                    onClick={() => {
                        setCurrentEntry(undefined);
                        setIsModalOpen(true);
                    }}
                    className="p-6 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 shadow-xl cursor-pointer group hover:shadow-sky-500/20 transition-all flex flex-col justify-center items-center text-center border border-white/10"
                >
                    <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <Plus size={32} className="text-white" />
                    </div>
                    <h3 className="text-white font-bold text-lg">Neuer Eintrag</h3>
                    <p className="text-sky-100/70 text-sm">Arbeitszeit oder Abwesenheit</p>
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
                            {entries.map((e, i) => (
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
