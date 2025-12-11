import React, { useState, useEffect } from 'react';
import { X, Check, Trash2 } from 'lucide-react';
import type { NewTimeEntry, TimeEntry } from '../lib/storage';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (entry: NewTimeEntry) => Promise<void>;
    onDelete?: () => Promise<void>;
    initialDate?: string;
    existingEntry?: TimeEntry;
}

const TimeEntryModal: React.FC<Props> = ({ isOpen, onClose, onSave, onDelete, initialDate, existingEntry }) => {
    const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
    const [type, setType] = useState<TimeEntry['type']>('work');
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('17:00');
    const [pause, setPause] = useState(30);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (existingEntry) {
                setDate(existingEntry.date);
                setType(existingEntry.type);
                setStartTime(existingEntry.startTime || '08:00');
                setEndTime(existingEntry.endTime || '17:00');
                setPause(existingEntry.pauseDuration || 30);
                setNotes(existingEntry.notes || '');
            } else {
                // Reset defaults for new entry
                setDate(initialDate || new Date().toISOString().split('T')[0]);
                setType('work');
                setStartTime('08:00');
                setEndTime('17:00');
                setPause(30);
                setNotes('');
            }
        }
    }, [isOpen, existingEntry, initialDate]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave({
            date,
            type,
            startTime: type === 'work' ? startTime : null,
            endTime: type === 'work' ? endTime : null,
            pauseDuration: type === 'work' ? pause : 0,
            notes
        });
        onClose();
    };

    const handleDelete = async () => {
        if (onDelete && confirm('Eintrag wirklich löschen?')) {
            await onDelete();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden scale-100 animate-scale-in">
                <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
                    <h2 className="text-lg font-semibold text-white">{existingEntry ? 'Eintrag bearbeiten' : 'Eintrag erfassen'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Date */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Datum</label>
                        <div className="flex bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="bg-transparent w-full text-white outline-none [color-scheme:dark]"
                                required
                            />
                        </div>
                    </div>

                    {/* Type */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Art des Eintrags</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'work', label: 'Arbeit', icon: '💼' },
                                { id: 'vacation', label: 'Ferien', icon: '🌴' },
                                { id: 'sick', label: 'Krank', icon: '💊' },
                                { id: 'accident', label: 'Unfall', icon: '🤕' },
                                { id: 'school', label: 'Schule', icon: '📚' },
                                { id: 'holiday', label: 'Feiertag', icon: '🎉' },
                                { id: 'other', label: 'Sonstiges', icon: '📝' },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setType(t.id as any)}
                                    className={`
                                        flex flex-col items-center justify-center p-3 rounded-xl border transition-all
                                        ${type === t.id
                                            ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}
                                    `}
                                >
                                    <span className="text-xl mb-1">{t.icon}</span>
                                    <span className="text-xs font-medium">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Work Details (Only visible for 'work') */}
                    {type === 'work' && (
                        <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50 space-y-4 animate-fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Start</label>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={e => setStartTime(e.target.value)}
                                        className="w-full bg-slate-800 rounded-lg p-2 border border-slate-700 text-white outline-none focus:border-sky-500 [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Ende</label>
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={e => setEndTime(e.target.value)}
                                        className="w-full bg-slate-800 rounded-lg p-2 border border-slate-700 text-white outline-none focus:border-sky-500 [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Pause (Minuten)</label>
                                <input
                                    type="number"
                                    min="0" max="600"
                                    value={pause}
                                    onChange={e => setPause(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-full bg-slate-800 rounded-lg p-2 border border-slate-700 text-white outline-none focus:border-sky-500 [color-scheme:dark]"
                                />
                                <span className="text-slate-400 text-sm">Min</span>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Notiz</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full bg-slate-900/50 rounded-lg p-2 border border-slate-700 text-white outline-none focus:border-sky-500 h-20 text-sm"
                            placeholder="Optional..."
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        {existingEntry && onDelete && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl border border-rose-500/30 transition-all flex items-center justify-center"
                                title="Eintrag löschen"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                        <button
                            type="submit"
                            className="flex-1 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <Check size={18} />
                            Speichern
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default TimeEntryModal;
