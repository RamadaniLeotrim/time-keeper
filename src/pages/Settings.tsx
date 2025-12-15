import React, { useEffect, useState } from 'react';
import { Save, Briefcase, Sun } from 'lucide-react';
import { storage } from '../lib/storage';

const Settings: React.FC = () => {
    const [weeklyHours, setWeeklyHours] = useState(40);
    const [vacationDays, setVacationDays] = useState(25);
    const [initialOvertime, setInitialOvertime] = useState(0);
    const [vacationCarryover, setVacationCarryover] = useState(0);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        const config = await storage.getUserConfig();
        setWeeklyHours(config.weeklyTargetHours);
        setVacationDays(config.yearlyVacationDays);
        setInitialOvertime(config.initialOvertimeBalance || 0);
        setVacationCarryover(config.vacationCarryover || 0);
    };

    const handleSave = async () => {
        setStatus('saving');
        await storage.saveUserConfig({
            weeklyTargetHours: weeklyHours,
            yearlyVacationDays: vacationDays,
            initialOvertimeBalance: initialOvertime,
            vacationCarryover: vacationCarryover
        });
        setTimeout(() => setStatus('saved'), 500);
        setTimeout(() => setStatus('idle'), 2000);
    };

    // Helper for Settings UI
    const minutesToTime = (mins: number): string => {
        const h = Math.floor(Math.abs(mins) / 60);
        const m = Math.round(Math.abs(mins) % 60);
        const sign = mins < 0 ? '-' : '';
        return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        Konfiguration
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Passen Sie Ihre Arbeitszeitmodelle und Urlaubstage an.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={status === 'saving'}
                    className={`
                        flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all
                        ${status === 'saved'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                            : 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20'}
                    `}
                >
                    {status === 'saving' ? (
                        <span className="animate-pulse">Speichere...</span>
                    ) : status === 'saved' ? (
                        <>Gespeichert!</>
                    ) : (
                        <>
                            <Save size={18} />
                            Speichern
                        </>
                    )}
                </button>
            </header>

            <div className="grid gap-6">
                {/* Arbeitszeit Card */}
                <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl relative overflow-hidden group hover:border-sky-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Briefcase size={64} />
                    </div>

                    <h2 className="text-xl font-semibold flex items-center gap-2 mb-6">
                        <Briefcase className="text-sky-400" size={20} />
                        Arbeitszeit
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Wöchentliche Soll-Stunden
                            </label>
                            <div className="flex bg-slate-900/50 rounded-lg p-2 border border-slate-700 focus-within:border-sky-500 transition-colors">
                                <input
                                    type="number"
                                    value={weeklyHours}
                                    onChange={(e) => setWeeklyHours(Number(e.target.value))}
                                    className="bg-transparent w-full outline-none text-white px-2"
                                />
                                <span className="text-slate-500 px-2 select-none">Std/Woche</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Das entspricht {(weeklyHours / 5).toFixed(1)} Stunden pro Tag (bei 5-Tage-Woche).
                            </p>
                        </div>
                    </div>
                </div>

                {/* Ferien Card */}
                <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Sun size={64} />
                    </div>

                    <h2 className="text-xl font-semibold flex items-center gap-2 mb-6">
                        <Sun className="text-emerald-400" size={20} />
                        Ferien & Urlaub
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Jährlicher Urlaubsanspruch
                            </label>
                            <div className="flex bg-slate-900/50 rounded-lg p-2 border border-slate-700 focus-within:border-emerald-500 transition-colors">
                                <input
                                    type="number"
                                    value={vacationDays}
                                    onChange={(e) => setVacationDays(Number(e.target.value))}
                                    className="bg-transparent w-full outline-none text-white px-2"
                                />
                                <span className="text-slate-500 px-2 select-none">Tage</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Saldo Start Card */}
                <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl relative overflow-hidden group hover:border-amber-500/30 transition-colors">
                    <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                        <Briefcase className="text-amber-400" size={20} />
                        Start-Salden
                    </h2>

                    <div className="space-y-6">
                        {/* Overtime */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Initialer Überzeitsaldo
                            </label>
                            <div className="flex bg-slate-900/50 rounded-lg p-2 border border-slate-700 focus-within:border-amber-500 transition-colors">
                                <input
                                    type="text"
                                    placeholder="-17:09"
                                    defaultValue={minutesToTime(initialOvertime)}
                                    key={initialOvertime} // Force re-render on load
                                    onBlur={(e) => {
                                        const val = e.target.value;
                                        // Simple parse: +/-HH:MM
                                        let mins = 0;
                                        const isNeg = val.trim().startsWith('-');
                                        const parts = val.replace('-', '').split(':');
                                        if (parts.length === 2) {
                                            mins = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                                            if (isNeg) mins = -mins;
                                        }
                                        setInitialOvertime(mins);
                                    }}
                                    className="bg-transparent w-full outline-none text-white px-2"
                                />
                                <span className="text-slate-500 px-2 select-none">HH:MM</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Format: HH:MM oder -HH:MM (z.B. -17:09)
                            </p>
                        </div>

                        {/* Vacation Carryover */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Ferienübertrag (Vorjahr)
                            </label>
                            <div className="flex bg-slate-900/50 rounded-lg p-2 border border-slate-700 focus-within:border-amber-500 transition-colors">
                                <input
                                    type="number"
                                    value={vacationCarryover}
                                    onChange={(e) => setVacationCarryover(Number(e.target.value))}
                                    className="bg-transparent w-full outline-none text-white px-2"
                                />
                                <span className="text-slate-500 px-2 select-none">Tage</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Resturlaub aus dem Vorjahr (wird zum aktuellen Anspruch addiert).
                            </p>
                        </div>
                    </div>
                </div>

                {/* Import Card */}
                <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Save size={64} />
                    </div>

                    <h2 className="text-xl font-semibold flex items-center gap-2 mb-6">
                        <Save className="text-indigo-400" size={20} />
                        Daten Import
                    </h2>

                    <div className="space-y-4">
                        <p className="text-sm text-slate-400">
                            Importieren Sie historische Daten aus Ihrem Excel-Journal (.xlsx).
                        </p>
                        <div className="flex items-center gap-4">
                            <label className="flex-1 cursor-pointer bg-slate-900/50 hover:bg-slate-900 border border-slate-700 border-dashed rounded-xl p-4 text-center transition-colors">
                                <span className="text-sm text-slate-300 font-medium">Excel Datei auswählen</span>
                                <input
                                    type="file"
                                    accept=".xlsx"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        if (confirm(`Möchten Sie "${file.name}" importieren? Dies fügt neue Einträge hinzu.`)) {
                                            try {
                                                const { parseExcelExport } = await import('../lib/importer');
                                                setStatus('saving');
                                                const entries = await parseExcelExport(file);
                                                console.log("Importing", entries.length, "entries");

                                                // Batch add
                                                if (entries.length > 0) {
                                                    await storage.addTimeEntries(entries);
                                                }

                                                alert(`${entries.length} Einträge erfolgreich importiert!`);
                                                setStatus('saved');
                                                setTimeout(() => setStatus('idle'), 2000);
                                            } catch (err) {
                                                console.error(err);
                                                alert('Fehler beim Importieren der Datei.');
                                                setStatus('idle');
                                            }
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Data Management */}
                <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl relative overflow-hidden group hover:border-rose-500/30 transition-colors">
                    <h2 className="text-xl font-semibold text-white mb-4 text-rose-400">Gefahrenzone</h2>
                    <p className="text-slate-400 text-sm mb-4">Hier können Sie alle importierten Daten löschen. Dies kann nicht rückgängig gemacht werden.</p>
                    <button
                        onClick={async () => {
                            if (confirm('Sind Sie sicher? Alle Einträge werden unwiderruflich gelöscht.')) {
                                await storage.clearAllEntries();
                                alert('Datenbank geleert.');
                                setStatus('saved');
                                setTimeout(() => setStatus('idle'), 2000);
                            }
                        }}
                        className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors text-sm font-medium"
                    >
                        Alle Daten löschen
                    </button>
                </div>
            </div>


        </div>
    );
};

export default Settings;
