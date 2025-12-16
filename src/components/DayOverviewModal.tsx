import React, { useState } from 'react';
import { X, Plus, Clock, Sun, TrendingUp, Trash2, Edit2, Loader2 } from 'lucide-react';
import type { TimeEntry } from '../lib/storage';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    date: string;
    entries: TimeEntry[];
    onEdit: (entry: TimeEntry) => void;
    onDelete: (entry: TimeEntry) => Promise<void>;
    onAddNew: () => void;
}

const DayOverviewModal: React.FC<Props> = ({ isOpen, onClose, date, entries, onEdit, onDelete, onAddNew }) => {
    const [deletingId, setDeletingId] = useState<number | null>(null);

    if (!isOpen) return null;

    // Sort entries by startTime
    const sortedEntries = [...entries].sort((a, b) => {
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
        return 0;
    });

    const handleDelete = async (entry: TimeEntry) => {
        if (confirm('Eintrag löschen?')) {
            setDeletingId(entry.id);
            try {
                await onDelete(entry);
                // If successful, the entry will disappear from the list via props update
            } finally {
                setDeletingId(null);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden scale-100 animate-scale-in">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Tagesübersicht</h2>
                        <p className="text-sm text-slate-400">{date}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* List */}
                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                    {sortedEntries.length === 0 ? (
                        <p className="text-center text-slate-500 py-4">Keine Einträge vorhanden.</p>
                    ) : (
                        sortedEntries.map(entry => (
                            <div key={entry.id} className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-3 flex items-center justify-between group hover:bg-slate-700/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${entry.type === 'work' ? 'bg-sky-500/10 text-sky-400' :
                                        entry.type === 'vacation' ? 'bg-emerald-500/10 text-emerald-400' :
                                            'bg-rose-500/10 text-rose-400'
                                        }`}>
                                        {entry.type === 'work' ? <Clock size={18} /> :
                                            entry.type === 'vacation' ? <Sun size={18} /> :
                                                <TrendingUp size={18} />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-white text-sm">
                                            {entry.type === 'work' ? `${entry.startTime} - ${entry.endTime}` : (entry.value === 0.5 ? 'Halber Tag' : 'Ganzer Tag')}
                                        </p>
                                        <p className="text-xs text-slate-400 capitalize">{entry.type} {entry.notes && `• ${entry.notes}`}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onEdit(entry)}
                                        disabled={deletingId === entry.id}
                                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                                        title="Bearbeiten"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(entry)}
                                        disabled={deletingId === entry.id}
                                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                                        title="Löschen"
                                    >
                                        {deletingId === entry.id ? <Loader2 size={16} className="animate-spin text-rose-400" /> : <Trash2 size={16} />}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 bg-slate-900/30">
                    <button
                        onClick={onAddNew}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium py-2.5 rounded-xl shadow-lg transition-all active:scale-[0.98]"
                    >
                        <Plus size={18} />
                        Weiteren Eintrag hinzufügen
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DayOverviewModal;
