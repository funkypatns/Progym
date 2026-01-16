import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Key, RefreshCw, Lock } from 'lucide-react';
import { useLicenseStore } from '../store';
import { useNavigate } from 'react-router-dom';

const LicenseExpired = () => {
    const { t } = useTranslation();
    const { license, activateLicense, checkLicense } = useLicenseStore();
    const navigate = useNavigate();
    const [key, setKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleActivate = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const result = await activateLicense(key);

        if (result.success || result.valid) {
            await checkLicense();
            navigate('/');
        } else {
            setError(result.message || 'Invalid license key');
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-700">
                <div className="bg-red-500/10 p-8 text-center border-b border-white/5">
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-10 h-10 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">License Expired/Invalid</h1>
                    <p className="text-slate-400">
                        Your gym management system license has expired or is invalid. Please enter a valid license key to continue.
                    </p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleActivate} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                License Key
                            </label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    value={key}
                                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 font-mono uppercase"
                                    placeholder="GYM-XXXX-XXXX-XXXX"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                <ShieldAlert className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <span>Activate License</span>
                            )}
                        </button>
                    </form>

                    {license?.hardwareId && (
                        <div className="mt-6 pt-6 border-t border-white/5 text-center">
                            <p className="text-xs text-slate-500 mb-1">Hardware ID (for support)</p>
                            <code className="text-xs bg-black/30 px-2 py-1 rounded text-slate-400 font-mono">
                                {license.hardwareId}
                            </code>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LicenseExpired;
