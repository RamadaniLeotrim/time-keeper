import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

const Layout: React.FC = () => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const navItems = [
        { path: '/', label: 'Dashboard', icon: '📊' },
        { path: '/calendar', label: 'Kalender', icon: '📅' },
        { path: '/calculator', label: 'Rechner', icon: '🧮' },
        { path: '/settings', label: 'Einstellungen', icon: '⚙️' },
        { path: '/debug', label: 'Debug', icon: '🐞' },
    ];

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-sky-500/30">
            <nav className="fixed bottom-0 w-full bg-slate-800/80 backdrop-blur-md border-t border-slate-700 md:top-0 md:bottom-auto md:border-b md:border-t-0 z-50">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="flex justify-between items-center h-16">
                        <span className="text-xl font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent hidden md:block">
                            TimeKeeper
                        </span>

                        <div className="flex items-center w-full md:w-auto gap-2 md:gap-4">
                            <ul className="flex flex-1 items-center justify-between md:justify-start md:w-auto md:space-x-4">
                                {navItems.map(item => (
                                    <li key={item.path} className="flex-1 flex justify-center md:flex-none">
                                        <Link
                                            to={item.path}
                                            className={`flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 px-3 py-2 rounded-lg transition-colors w-full md:w-auto ${location.pathname === item.path
                                                ? 'text-sky-400 bg-white/5'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                                }`}
                                        >
                                            <span className="text-xl md:text-lg">{item.icon}</span>
                                            <span className="text-xs md:text-sm font-medium hidden md:inline">{item.label}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>

                            {/* Mobile Logout */}
                            <button
                                onClick={logout}
                                className="md:hidden p-2 text-slate-400 hover:text-rose-400 transition-colors"
                                title="Abmelden"
                            >
                                <LogOut size={20} />
                            </button>

                            {/* Desktop User Info & Logout */}
                            <div className="hidden md:flex items-center gap-3 pl-4 border-l border-slate-700">
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-white leading-none">{user?.name}</p>
                                    <p className="text-xs text-slate-500 leading-none mt-1">{user?.email}</p>
                                </div>
                                <button
                                    onClick={logout}
                                    className="p-2 text-slate-400 hover:text-rose-400 transition-colors"
                                    title="Abmelden"
                                >
                                    <LogOut size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="pt-6 pb-24 md:pt-24 md:pb-8 px-4 max-w-5xl mx-auto">
                <div className="animate-fade-in">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
