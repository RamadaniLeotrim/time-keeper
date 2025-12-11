import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';

const Layout: React.FC = () => {
    const location = useLocation();
    const navItems = [
        { path: '/', label: 'Dashboard', icon: '📊' },
        { path: '/calendar', label: 'Kalender', icon: '📅' },
        { path: '/settings', label: 'Einstellungen', icon: '⚙️' },
    ];

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-sky-500/30">
            <nav className="fixed bottom-0 w-full bg-slate-800/80 backdrop-blur-md border-t border-slate-700 md:top-0 md:bottom-auto md:border-b md:border-t-0 z-50">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="flex justify-between items-center h-16">
                        <span className="text-xl font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent hidden md:block">
                            TimeKeeper
                        </span>
                        <ul className="flex justify-around w-full md:w-auto md:space-x-8">
                            {navItems.map(item => (
                                <li key={item.path}>
                                    <Link
                                        to={item.path}
                                        className={`flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-2 px-3 py-2 rounded-lg transition-colors ${location.pathname === item.path
                                            ? 'text-sky-400 bg-white/5'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`}
                                    >
                                        <span className="text-xl md:text-lg">{item.icon}</span>
                                        <span className="text-xs md:text-sm font-medium">{item.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </nav>

            <main className="pt-6 pb-24 md:pt-24 px-4 max-w-5xl mx-auto">
                <div className="animate-fade-in">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
