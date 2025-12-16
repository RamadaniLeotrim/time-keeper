import React, { useEffect, useState } from 'react';
import { storage, type UserSession } from '../lib/storage';
import { Shield, ShieldAlert, Trash2, User } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';
import { useAuth } from '../context/AuthContext';

const AdminPage: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<UserSession[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await storage.getUsers();
            setUsers(data);
        } catch (e) {
            setError('Fehler beim Laden der Benutzer. Bist du Admin?');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleRole = async (targetUser: UserSession) => {
        const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
        if (!confirm(`${targetUser.name} wirklich zum ${newRole.toUpperCase()} machen?`)) return;

        setIsLoading(true);
        try {
            await storage.updateUserRole(targetUser.id, newRole);
            await loadUsers();
        } catch (e) {
            alert('Fehler beim Ändern der Rolle.');
            setIsLoading(false);
        }
    };

    const handleDelete = async (targetUser: UserSession) => {
        if (!confirm(`WARNUNG: User "${targetUser.name}" und ALLE SEINE DATEN (Zeiteinträge) unwiderruflich löschen?`)) return;

        setIsLoading(true);
        try {
            await storage.deleteUser(targetUser.id);
            await loadUsers();
        } catch (e) {
            alert('Fehler beim Löschen.');
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in relative">
            <LoadingOverlay isLoading={isLoading} />

            <header className="flex items-center gap-4">
                <div className="p-3 bg-red-500/10 rounded-xl text-red-400">
                    <ShieldAlert size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Admin Verwaltung</h1>
                    <p className="text-slate-400">Benutzer verwalten und Rollen zuweisen</p>
                </div>
            </header>

            {error && (
                <div className="p-4 bg-rose-500/20 text-rose-300 rounded-xl border border-rose-500/30">
                    {error}
                </div>
            )}

            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-700 bg-slate-900/50 text-slate-400 text-sm uppercase tracking-wider">
                            <th className="p-4">Name</th>
                            <th className="p-4">Email</th>
                            <th className="p-4">Rolle</th>
                            <th className="p-4 text-right">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 text-white font-medium flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700/50 text-slate-400'}`}>
                                        <User size={16} />
                                    </div>
                                    {u.name}
                                    {u.id === currentUser?.id && <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">Du</span>}
                                </td>
                                <td className="p-4 text-slate-300">{u.email}</td>
                                <td className="p-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.role === 'admin'
                                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                        : 'bg-slate-700 text-slate-400'
                                        }`}>
                                        {u.role.toUpperCase()}
                                    </span>
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    <button
                                        onClick={() => handleToggleRole(u)}
                                        disabled={u.id === currentUser?.id}
                                        className="p-2 text-slate-400 hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title={u.role === 'admin' ? "Zum User abstufen" : "Zum Admin machen"}
                                    >
                                        <Shield size={20} className={u.role === 'admin' ? "fill-current" : ""} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(u)}
                                        disabled={u.id === currentUser?.id}
                                        className="p-2 text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="Löschen"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && !isLoading && !error && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-500">
                                    Keine Benutzer gefunden.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminPage;
