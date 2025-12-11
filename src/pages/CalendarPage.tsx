import React, { useState, useEffect } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, addMonths, subMonths, getYear, setMonth, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { storage, type TimeEntry } from '../lib/storage';
import TimeEntryModal from '../components/TimeEntryModal';

type ViewMode = 'month' | 'year' | 'week';

const CalendarPage: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
    const [currentEntry, setCurrentEntry] = useState<TimeEntry | undefined>(undefined);

    useEffect(() => {
        loadEntries();
    }, [currentDate, viewMode]); // Reload when navigation happens (in case we optimize fetch later)

    const loadEntries = async () => {
        const data = await storage.getEntries();
        setEntries(data);
    };

    const handleDateClick = (date: Date) => {
        setCurrentEntry(undefined); // New entry
        setSelectedDate(format(date, 'yyyy-MM-dd'));
        setIsModalOpen(true);
    };

    const handleEntryClick = (e: React.MouseEvent, entry: TimeEntry) => {
        e.stopPropagation(); // Prevent date click
        setCurrentEntry(entry);
        setSelectedDate(undefined);
        setIsModalOpen(true);
    };

    const getEntryForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return entries.filter(e => e.date === dateStr);
    };

    const renderHeader = () => {
        return (
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4 bg-slate-800/50 p-2 rounded-xl border border-slate-700">
                    <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-xl font-bold min-w-[140px] text-center">
                        {format(currentDate, viewMode === 'year' ? 'yyyy' : 'MMMM yyyy', { locale: de })}
                    </h2>
                    <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700">
                    <button
                        onClick={() => setViewMode('month')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'month' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Monat
                    </button>
                    <button
                        onClick={() => setViewMode('week')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'week' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Woche
                    </button>
                    <button
                        onClick={() => setViewMode('year')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'year' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Jahr
                    </button>
                </div>
            </div>
        );
    };

    const renderMonthView = (baseDate = currentDate, mini = false) => {
        const monthStart = startOfMonth(baseDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start: startDate, end: endDate });

        const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

        return (
            <div className={`h-full ${mini ? '' : 'animate-fade-in'}`}>
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 mb-2">
                    {weekDays.map(d => (
                        <div key={d} className={`text-center font-medium ${mini ? 'text-[10px] text-slate-500' : 'text-sm text-slate-400 uppercase tracking-wider'}`}>
                            {d}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1 auto-rows-fr">
                    {days.map(day => {
                        const dayEntries = getEntryForDate(day);
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        const isTodayDate = isToday(day);

                        // Styling for different entry types
                        const hasWork = dayEntries.some(e => e.type === 'work');
                        const hasVacation = dayEntries.some(e => e.type === 'vacation');
                        const hasOther = dayEntries.some(e => !['work', 'vacation'].includes(e.type));

                        let bgClass = 'bg-slate-800/30';
                        if (hasVacation) bgClass = 'bg-emerald-500/20 border-emerald-500/50';
                        else if (hasOther) bgClass = 'bg-rose-500/20 border-rose-500/50';
                        else if (hasWork) bgClass = 'bg-sky-500/10 border-sky-500/30';

                        if (!isCurrentMonth) bgClass = 'opacity-25 bg-transparent';
                        if (isTodayDate) bgClass += ' ring-1 ring-sky-400';

                        return (
                            <div
                                key={day.toString()}
                                onClick={() => !mini && handleDateClick(day)}
                                className={`
                                    relative p-1 rounded-lg border border-transparent transition-all
                                    ${mini ? 'aspect-square text-[10px] flex items-center justify-center' : 'min-h-[80px] md:min-h-[100px] cursor-pointer hover:bg-white/5 hover:scale-[1.02]'}
                                    ${bgClass}
                                `}
                            >
                                <span className={`
                                    ${mini ? '' : 'absolute top-2 left-2'} 
                                    font-medium 
                                    ${!isCurrentMonth ? 'text-slate-600' : 'text-slate-300'}
                                    ${isTodayDate ? 'text-sky-400 font-bold' : ''}
                                `}>
                                    {format(day, 'd')}
                                </span>

                                {/* Indicators (Only in normal view) */}
                                {!mini && (
                                    <div className="mt-6 space-y-1">
                                        {dayEntries.map((e, i) => (
                                            <div key={i} className={`text-xs px-1.5 py-0.5 rounded truncate ${e.type === 'work' ? 'bg-sky-500/20 text-sky-300' :
                                                e.type === 'vacation' ? 'bg-emerald-500/20 text-emerald-300' :
                                                    'bg-rose-500/20 text-rose-300'
                                                }`}>
                                                {e.type === 'work' ? `${e.startTime}-${e.endTime}` : e.type}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* Mini view simple dot */}
                                {mini && dayEntries.length > 0 && (
                                    <div className={`w-1 h-1 rounded-full absolute bottom-1 mx-auto ${hasVacation ? 'bg-emerald-400' : 'bg-sky-400'}`}></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderYearView = () => {
        const months = [];
        for (let i = 0; i < 12; i++) {
            months.push(setMonth(new Date(getYear(currentDate), 0, 1), i));
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
                {months.map(m => (
                    <div key={m.toString()} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                        <h3 className="text-center font-bold mb-4 text-sky-100">{format(m, 'MMMM', { locale: de })}</h3>
                        {renderMonthView(m, true)}
                    </div>
                ))}
            </div>
        );
    };

    const renderWeekView = () => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start, end });

        return (
            <div className="space-y-2 animate-fade-in">
                {days.map(day => {
                    const dayEntries = getEntryForDate(day);
                    const isTodayDate = isToday(day);

                    return (
                        <div
                            key={day.toString()}
                            onClick={() => handleDateClick(day)}
                            className={`
                                flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border transition-all cursor-pointer
                                ${isTodayDate ? 'bg-white/5 border-sky-500/50' : 'bg-slate-800/40 border-slate-700/50 hover:bg-white/5'}
                            `}
                        >
                            <div className="flex items-center gap-4 mb-2 md:mb-0">
                                <div className={`
                                    w-12 h-12 flex flex-col items-center justify-center rounded-lg border
                                    ${isTodayDate ? 'bg-sky-500/20 border-sky-500 text-sky-400' : 'bg-slate-700/30 border-slate-600 text-slate-400'}
                                `}>
                                    <span className="text-xs uppercase">{format(day, 'EEE', { locale: de })}</span>
                                    <span className="text-lg font-bold">{format(day, 'd')}</span>
                                </div>
                                <div>
                                    <h3 className="font-medium text-white">{format(day, 'EEEE', { locale: de })}</h3>
                                    {dayEntries.length === 0 && <p className="text-sm text-slate-500">Kein Eintrag</p>}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {dayEntries.map((e, i) => (
                                    <div
                                        key={i}
                                        onClick={(ev) => handleEntryClick(ev, e)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer hover:scale-105 transition-transform ${e.type === 'work' ? 'bg-sky-500/10 border-sky-500/20 text-sky-300' :
                                            e.type === 'vacation' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
                                                'bg-rose-500/10 border-rose-500/20 text-rose-300'
                                            }`}
                                    >
                                        <span className="text-xs uppercase font-bold tracking-wider">{e.type}</span>
                                        {e.type === 'work' && <span className="text-sm border-l border-white/10 pl-2 ml-1">{e.startTime} - {e.endTime}</span>}
                                        {e.notes && <span className="text-xs italic text-slate-400 hidden lg:inline-block">- {e.notes}</span>}
                                    </div>
                                ))}
                                {dayEntries.length === 0 && (
                                    <div className="text-sm text-slate-600 italic">Klicken zum Bearbeiten</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen">
            {renderHeader()}

            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'year' && renderYearView()}
            {viewMode === 'week' && renderWeekView()}

            <TimeEntryModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setCurrentEntry(undefined);
                }}
                initialDate={selectedDate}
                existingEntry={currentEntry}
                onSave={async (entry) => {
                    if (currentEntry) {
                        await storage.updateTimeEntry(currentEntry.id, entry);
                    } else {
                        await storage.addTimeEntry(entry);
                    }
                    await loadEntries(); // Refresh
                }}
                onDelete={currentEntry ? async () => {
                    await storage.deleteTimeEntry(currentEntry.id);
                    await loadEntries();
                } : undefined}
            />
        </div>
    );
};

export default CalendarPage;
