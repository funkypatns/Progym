/**
 * ============================================
 * LOGIN PAGE (Glass Enterprise Redesign)
 * ============================================
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Dumbbell, Eye, EyeOff, Lock, User } from 'lucide-react';
import LoadingButton from '@mui/lab/LoadingButton';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store';

const Login = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { login, isLoading } = useAuthStore();
    const isRTL = i18n.dir() === 'rtl';

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        rememberMe: false,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const result = await login(formData.username, formData.password);

        if (result.success) {
            toast.success(t('auth.loginSuccess'));
            navigate('/', { replace: true });
        } else {
            setError(result.message || t('auth.loginError'));
            toast.error(result.message || t('auth.loginError'));
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-slate-900">

            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,#1e293b_0%,#0f172a_100%)]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-[120px] opacity-40 animate-pulse-slow" />
                <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] opacity-30" />
            </div>

            {/* Login Container */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "backOut" }}
                className="relative z-10 w-full max-w-md"
            >
                {/* Brand Header */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-indigo-500/40 mb-6"
                    >
                        <Dumbbell size={32} className="text-white" />
                    </motion.div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">
                        GYM<span className="text-indigo-400">PRO</span>
                        <span className="text-indigo-500/50 ml-2 text-lg">v2</span>
                    </h1>
                    <p className="text-slate-400 text-sm font-medium">Enterprise Management System</p>
                </div>

                {/* Glass Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden group hover:border-white/20 transition-colors">

                    {/* Inner Glow */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-indigo-500 rounded-full" />
                        {t('auth.login', 'Sign In')}
                    </h2>

                    <form onSubmit={handleSubmit} noValidate className="space-y-5 relative z-10">

                        {/* Username Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{t('auth.username')}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <User size={18} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
                                    placeholder="Enter your username"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{t('auth.password')}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-11 pr-11 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
                                    placeholder="••••••••"
                                    dir="ltr"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me & Recover */}
                        <div className="flex items-center justify-between pt-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={formData.rememberMe}
                                    onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-600 text-indigo-500 bg-slate-800 focus:ring-indigo-500/40 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">{t('auth.rememberMe')}</span>
                            </label>
                            <a href="#" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                                Forgot password?
                            </a>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                        >
                            {isLoading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <span>{t('auth.loginButton', 'Sign In')}</span>
                            )}
                        </button>

                        {/* Demo Hint */}
                        <div className="mt-8 pt-6 border-t border-white/5 text-center">
                            <p className="text-xs text-slate-500 mb-2">DEMO ACCESS CREDENTIALS</p>
                            <div className="inline-flex gap-4 text-xs font-mono text-indigo-300 bg-indigo-500/10 px-4 py-2 rounded-lg border border-indigo-500/20">
                                <span>User: admin</span>
                                <span className="text-white/20">|</span>
                                <span>Pass: admin123</span>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-slate-600 text-xs mt-8">
                    &copy; 2025 GymPro Systems Inc. All rights reserved.
                </p>

            </motion.div>
        </div>
    );
};

export default Login;
