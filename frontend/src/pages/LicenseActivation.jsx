/**
 * ============================================
 * LICENSE ACTIVATION PAGE
 * ============================================
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, Lock, Loader2, CheckCircle, AlertOctagon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLicenseStore } from '../store';

const LicenseActivation = () => {
    const { t } = useTranslation();
    const { activateLicense, isLoading: storeLoading } = useLicenseStore();

    const [key, setKey] = useState('');
    const [gymName, setGymName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleActivate = async (e) => {
        e.preventDefault();
        if (!key.trim()) {
            setError('License key is required');
            return;
        }
        if (!gymName.trim()) {
            setError('Gym name is required');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await activateLicense(key, gymName.trim());

            if (result.success) {
                setSuccess(true);
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                setError(result.message || 'Activation failed');
            }
        } catch (err) {
            setError(err.message || 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{t('license.activated')}</h2>
                    <p className="text-dark-400">Restarting application...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-radial from-primary-500/10 via-transparent to-transparent opacity-50" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-dark-900 border border-dark-700 rounded-2xl p-8 relative z-10 box-shadow-glow-lg"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center mx-auto mb-4 shadow-glow">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">{t('license.title')}</h1>
                    <p className="text-dark-400 mt-2">
                        Please enter your product key to activate the Gym Management System.
                    </p>
                </div>

                <form onSubmit={handleActivate} className="space-y-6">
                    <div>
                        <label className="label">{t('settings.gymName', 'Gym Name')}</label>
                        <input
                            type="text"
                            value={gymName}
                            onChange={(e) => setGymName(e.target.value)}
                            placeholder={t('settings.gymName', 'Gym Name')}
                            className="input"
                            required
                        />
                    </div>

                    <div>
                        <label className="label">{t('license.enterKey')}</label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                            <input
                                type="text"
                                value={key}
                                onChange={(e) => setKey(e.target.value.toUpperCase())}
                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                className="input pl-10 text-center font-mono tracking-widest uppercase"
                                maxLength={29}
                                autoFocus
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-3"
                        >
                            <AlertOctagon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-300">{error}</p>
                        </motion.div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !key}
                        className="btn-primary w-full py-3 text-lg font-semibold shadow-lg shadow-primary-500/20"
                    >
                        {isLoading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            t('license.activate')
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-dark-800 text-center">
                    <p className="text-xs text-dark-500">
                        For support or to purchase a license, please contact support@example.com
                    </p>
                    <p className="text-xs text-dark-600 mt-1">
                        Machine ID: {window.electronAPI?.getHardwareId?.() || 'Generating...'}
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default LicenseActivation;
