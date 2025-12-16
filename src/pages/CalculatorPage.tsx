/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { Calculator, Clock, ArrowRight, RotateCcw, Target } from 'lucide-react';
import { calculateWorkDetails, minutesToTime, timeToMinutes, type WorkCalculation } from '../lib/rules';
import { storage } from '../lib/storage';

const CalculatorPage: React.FC = () => {
    // Inputs
    const [t1, setT1] = useState('');
    const [t2, setT2] = useState('');
    const [t3, setT3] = useState('');
    const [t4, setT4] = useState('');
    const [targetMinutes, setTargetMinutes] = useState(8.4 * 60); // Default 8h 24m

    const [result, setResult] = useState<WorkCalculation | null>(null);

    const isValidTime = (t: string) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(t);

    useEffect(() => {
        // Load target from config
        storage.getUserConfig().then(cfg => {
            // Weekly / 5 = Daily
            setTargetMinutes((cfg.weeklyTargetHours / 5) * 60);
        });
    }, []);

    // Auto-calculate on change
    useEffect(() => {
        // ... (rest of useEffect logic remains similar but needed for context)
        if (isValidTime(t1) && ((isValidTime(t2) && !t3 && !t4) || (isValidTime(t2) && isValidTime(t3) && isValidTime(t4)) || (!t2 && !t3 && isValidTime(t4)))) {
            // Handle "Implicit 2 bookings" (T1 ... T4) if user skips T2/T3
            // Our logic expects specific slots.
            // If user inputs T1 and T2 -> 2 Bookings.
            // If user inputs T1, T2, T3, T4 -> 4 Bookings.
            // If user inputs T1 and T4 (cleared others) -> Special case?

            // Simplest mapping:
            // Scenario A: T1, T2 (Continuous)
            // Scenario B: T1, T2, T3, T4 (Split)

            // Let's pass what we have.
            const r = calculateWorkDetails(
                isValidTime(t1) ? t1 : null,
                isValidTime(t2) ? t2 : null,
                isValidTime(t3) ? t3 : null,
                isValidTime(t4) ? t4 : null
            );

            // Only show if we have a valid calc
            if (r.netDuration > 0 || r.pauseDuration > 0) {
                setResult(r);
            } else {
                setResult(null);
            }
        } else {
            setResult(null);
        }
    }, [t1, t2, t3, t4]);

    const reset = () => {
        setT1(''); setT2(''); setT3(''); setT4('');
        setResult(null);
    };

    const autoFillStart2 = () => {
        if (!t2) return;
        const mins = timeToMinutes(t2);
        setT3(minutesToTime(mins + 30));
    };

    const autoFillEndWithTarget = () => {
        if (!t1 || !t2 || !t3 || !isValidTime(t1) || !isValidTime(t2) || !isValidTime(t3)) return;

        // Brute force forward from t3
        const startSearch = timeToMinutes(t3);
        let currentEnd = startSearch;

        // Max loop 24h
        while (currentEnd < 24 * 60) {
            const t4Candidate = minutesToTime(currentEnd);
            const r = calculateWorkDetails(t1, t2, t3, t4Candidate);

            // Allow 1 min tolerance or exact match
            if (r.netDuration >= targetMinutes) {
                setT4(t4Candidate);
                return;
            }
            currentEnd++;
        }
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in space-y-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Calculator className="text-sky-400" />
                    Arbeitszeit-Rechner
                </h1>
                <p className="text-slate-400 mt-2">
                    Simuliere deine Arbeitszeiten und Pausenabzüge basierend auf den aktuellen Regeln.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Inputs */}
                <div className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/50 shadow-xl backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-white">Eingabe</h2>
                        <button onClick={reset} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors" title="Zurücksetzen">
                            <RotateCcw size={18} />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">Block 1 (Morgen)</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs text-slate-500">Start</span>
                                    <input
                                        type="time"
                                        value={t1}
                                        onChange={e => setT1(e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-sky-500 transition-colors"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-slate-500">Ende</span>
                                    <input
                                        type="time"
                                        value={t2}
                                        onChange={e => setT2(e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-sky-500 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-700/50"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-slate-800 px-2 text-slate-500">Optional: Nachmittag</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">Block 2 (Nachmittag)</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-500">Start</span>
                                        {t2 && (
                                            <button
                                                onClick={autoFillStart2}
                                                className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded hover:bg-sky-500/20 transition-colors"
                                                title="Ende 1 + 30min"
                                            >
                                                +30m
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="time"
                                        value={t3}
                                        onChange={e => setT3(e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-sky-500 transition-colors"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-500">Ende</span>
                                        {t1 && t2 && t3 && (
                                            <button
                                                onClick={autoFillEndWithTarget}
                                                className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                                                title={`Sollzeit (${minutesToTime(targetMinutes)}h) auffüllen`}
                                            >
                                                <Target size={10} />
                                                Soll
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="time"
                                        value={t4}
                                        onChange={e => setT4(e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-sky-500 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results */}
                <div className="space-y-6">
                    <div className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/50 shadow-xl backdrop-blur-sm h-full flex flex-col">
                        <h2 className="text-xl font-semibold text-white mb-6">Ergebnis</h2>

                        {result ? (
                            <div className="flex-1 flex flex-col justify-between space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl bg-slate-700/30 border border-slate-600/30">
                                        <div className="text-slate-400 text-xs uppercase font-bold mb-1">Brutto Arbeitszeit</div>
                                        <div className="text-2xl font-mono text-white">{minutesToTime(result.rawDuration)} h</div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                        <div className="text-amber-400/80 text-xs uppercase font-bold mb-1">Pause (Abzug)</div>
                                        <div className="text-2xl font-mono text-amber-400">{result.pauseDuration} min</div>
                                    </div>
                                </div>

                                <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Clock className="text-emerald-400" size={24} />
                                        <div>
                                            <div className="text-emerald-400/80 text-xs uppercase font-bold">Netto Arbeitszeit</div>
                                            <div className="text-3xl font-mono text-white font-bold">{minutesToTime(result.netDuration)} h</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Balance / Saldo Display */}
                                {(() => {
                                    const balance = result.netDuration - targetMinutes;
                                    const isPositive = balance >= 0;
                                    const colorClass = isPositive ? 'text-emerald-400' : 'text-rose-400';
                                    const bgClass = isPositive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20';

                                    return (
                                        <div className={`p-4 rounded-xl border ${bgClass} flex justify-between items-center`}>
                                            <div>
                                                <div className={`${colorClass} opacity-80 text-xs uppercase font-bold`}>Tages-Saldo</div>
                                                <div className={`text-xl font-mono font-bold ${colorClass}`}>
                                                    {balance > 0 ? '+' : ''}{minutesToTime(balance)} h
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-slate-500 text-xs">Soll: {minutesToTime(targetMinutes)} h</div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="mt-4">
                                    <h3 className="text-sm font-medium text-slate-400 mb-2">Angewendete Regeln:</h3>
                                    {result.rulesApplied.length > 0 ? (
                                        <ul className="space-y-2">
                                            {result.rulesApplied.map((rule, i) => (
                                                <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                                                    <ArrowRight size={12} className="mt-0.5 text-sky-500 shrink-0" />
                                                    {rule}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-xs text-slate-500 italic">Keine speziellen Abzüge.</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 opacity-50">
                                <Calculator size={48} className="mb-4" />
                                <p className="text-sm">Gib gültige Zeiten ein</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalculatorPage;
