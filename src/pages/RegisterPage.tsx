import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, ArrowRight, Loader2 } from 'lucide-react';

const RegisterPage: React.FC = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name }),
            });
            const data = await res.json();

            if (res.ok) {
                login(data.user);
            } else {
                setError(data.error || 'Fehler beim Registrieren');
            }
        } catch (e) {
            setError('Verbindungsfehler');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
            <div className="w-full max-w-md space-y-8 animate-fade-in">
                <div className="text-center">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                        Neues Konto
                    </h1>
                    <p className="text-slate-400">Erstellen Sie Ihren persönlichen Zugang.</p>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Voller Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sky-500 transition-colors"
                                placeholder="Max Mustermann"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sky-500 transition-colors"
                                placeholder="name@beispiel.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Passwort</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sky-500 transition-colors"
                                placeholder="Min. 8 Zeichen"
                                minLength={8}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white py-3 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
                            {loading ? 'Erstelle Konto...' : 'Registrieren'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-slate-400 text-sm">
                            Bereits registriert?{' '}
                            <a href="/login" className="text-sky-400 hover:text-sky-300 font-medium transition-colors inline-flex items-center gap-1 group">
                                Anmelden
                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
