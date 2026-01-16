/**
 * ============================================
 * SETTINGS PAGE
 * ============================================
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Save,
    Loader2,
    Globe,
    DollarSign,
    Building,
    Database,
    Upload,
    Download,
    Trash2,
    RefreshCw,
    Key,
    Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useSettingsStore, useThemeStore, useLicenseStore, usePlanStore, usePosStore } from '../store';
import AlertsRemindersSettings from '../components/AlertsRemindersSettings';

const Settings = () => {
    const { t, i18n } = useTranslation();
    const { theme, setTheme } = useThemeStore();
    const { settings, fetchSettings, updateSettings, isLoading } = useSettingsStore();

    const [activeTab, setActiveTab] = useState('general');
    const [formData, setFormData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [backups, setBackups] = useState([]);
    const [isBackupLoading, setIsBackupLoading] = useState(false);

    // License State
    const [licenseKey, setLicenseKey] = useState('');
    const { activateLicense, isValid } = useLicenseStore();

    const handleActivate = async () => {
        if (!licenseKey) return;
        const result = await activateLicense(licenseKey);
        if (result.valid) {
            toast.success('License activated successfully');
            setLicenseKey('');
        } else {
            toast.error(result.error || 'Invalid license key');
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        if (settings) {
            const flattened = {};
            Object.entries(settings).forEach(([group, values]) => {
                Object.entries(values).forEach(([key, value]) => {
                    flattened[key] = value;
                });
            });
            setFormData(flattened);
        }
    }, [settings]);

    useEffect(() => {
        if (activeTab === 'backup') {
            fetchBackups();
        }
    }, [activeTab]);

    const fetchBackups = async () => {
        setIsBackupLoading(true);
        try {
            const response = await api.get('/backup/list');
            setBackups(response.data.data);
        } catch (error) {
            toast.error('Failed to fetch backups');
        } finally {
            setIsBackupLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Group settings back
            const grouped = {};
            Object.entries(formData).forEach(([key, value]) => {
                grouped[key] = value;
            });

            const result = await updateSettings(grouped);
            if (result.success) {
                toast.success(t('settings.saved'));
            } else {
                toast.error('Failed to save settings');
            }
        } catch (error) {
            toast.error('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const createBackup = async () => {
        try {
            const toastId = toast.loading('Creating backup...');
            await api.post('/backup/create');
            toast.success(t('backup.backupCreated'), { id: toastId });
            fetchBackups();
        } catch (error) {
            toast.error('Failed to create backup');
        }
    };

    const restoreBackup = async (name) => {
        if (!window.confirm(t('backup.restoreWarning'))) return;

        try {
            const toastId = toast.loading('Restoring backup...');
            await api.post('/backup/restore', { backupName: name });
            toast.success(t('backup.restoreSuccess'), { id: toastId });

            // Delay to let user see message
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            toast.error('Failed to restore backup');
        }
    };

    const deleteBackup = async (name) => {
        if (!window.confirm('Delete this backup?')) return;

        try {
            await api.delete(`/backup/${name}`);
            toast.success('Backup deleted');
            fetchBackups();
        } catch (error) {
            toast.error('Failed to delete backup');
        }
    };

    const downloadBackup = async (name) => {
        try {
            const response = await api.get(`/backup/download/${name}`, {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', name);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error('Failed to download backup');
        }
    };

    const [resetTargets, setResetTargets] = useState({
        members: false,
        payments: false,
        subscriptions: false,
        logs: false
    });
    const [resetDate, setResetDate] = useState('');

    const handleReset = async (isFullReset) => {
        const message = isFullReset
            ? "WARNING: This will delete ALL data from the system. This action cannot be undone. Are you sure?"
            : "Are you sure you want to delete the selected data?";

        if (!window.confirm(message)) return;

        if (isFullReset) {
            const confirmText = window.prompt("To confirm factory reset, please type 'RESET' exactly:");
            if (confirmText !== 'RESET') {
                toast.error("Factory reset cancelled (Confirmation text mismatch)");
                return;
            }
        }

        const toastId = toast.loading('Clearing data...');
        try {
            const targets = isFullReset
                ? ['all']
                : Object.keys(resetTargets).filter(k => resetTargets[k]);

            await api.post('/settings/reset', {
                targets,
                date: resetDate || null
            });

            toast.success('Data cleared successfully', { id: toastId });

            // Synchronize frontend state
            if (targets.includes('all')) {
                usePlanStore.getState().reset();
                usePosStore.getState().reset();
                await useSettingsStore.getState().reset();
            } else {
                if (targets.includes('subscriptions')) usePlanStore.getState().reset();
                if (targets.includes('payments')) usePosStore.getState().reset();
            }

            // Reset form
            setResetTargets({ members: false, payments: false, subscriptions: false, logs: false });
            setResetDate('');

            if (isFullReset) {
                // For factory reset, we still want a reload to ensure all UI components re-initialize
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            }
        } catch (error) {
            console.error('Reset error:', error);
            const errMsg = error.response?.data?.message || 'Failed to clear data';
            toast.error(errMsg, { id: toastId });
        }
    };

    const tabs = [
        { id: 'general', label: t('settings.general'), icon: Building },
        { id: 'branding', label: t('settings.branding'), icon: Globe },
        { id: 'alerts', label: i18n.language === 'ar' ? 'التنبيهات والتذكير' : 'Alerts & Reminders', icon: Bell },
        { id: 'backup', label: t('settings.backup'), icon: Database },
        { id: 'data', label: t('settings.data', 'Data Management'), icon: Trash2 },
        { id: 'license', label: t('settings.license'), icon: Key },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-dark-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('settings.title')}</h1>
                <p className="text-slate-500 dark:text-dark-400 mt-1">Manage application settings</p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-dark-700">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-t-xl transition-colors relative top-[1px] ${activeTab === tab.id
                            ? 'bg-white dark:bg-dark-800 text-primary-600 dark:text-primary-400 border border-gray-200 dark:border-dark-700 border-b-white dark:border-b-dark-800'
                            : 'text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-800/50'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span className="font-medium whitespace-nowrap">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
            >
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t('settings.general')}</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="label">{t('settings.gymName')}</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.gym_name || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, gym_name: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="label">{t('settings.gymPhone')}</label>
                                <input
                                    type="tel"
                                    className="input"
                                    value={formData.gym_phone || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, gym_phone: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="label">{t('settings.gymEmail')}</label>
                                <input
                                    type="email"
                                    className="input"
                                    value={formData.gym_email || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, gym_email: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="label">{t('settings.gymAddress')}</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.gym_address || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, gym_address: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="btn-primary"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        {t('common.save')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'branding' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t('settings.branding')}</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="label">{t('settings.language')}</label>
                                <select
                                    className="input"
                                    value={i18n.language}
                                    onChange={(e) => i18n.changeLanguage(e.target.value)}
                                >
                                    <option value="en">English</option>
                                    <option value="ar">العربية</option>
                                </select>
                            </div>

                            <div>
                                <label className="label">{t('settings.theme')}</label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 ${theme === 'dark'
                                            ? 'bg-primary-50 dark:bg-primary-600/20 border-primary-500 text-primary-600 dark:text-primary-400'
                                            : 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-700 text-slate-600 dark:text-dark-400'
                                            }`}
                                    >
                                        Dark Mode
                                    </button>
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 ${theme === 'light'
                                            ? 'bg-primary-50 dark:bg-primary-600/20 border-primary-500 text-primary-600 dark:text-primary-400'
                                            : 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-700 text-slate-600 dark:text-dark-400'
                                            }`}
                                    >
                                        Light Mode
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="label">{t('settings.currency')}</label>
                                <select
                                    className="input"
                                    value={formData.currency_code || 'USD'}
                                    onChange={(e) => {
                                        const code = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            currency_code: code,
                                            currency_symbol: code === 'EGP' ? '£' : '$' // Default symbols
                                        }));
                                    }}
                                >
                                    <option value="USD">USD ($)</option>
                                    <option value="EGP">EGP (genih)</option>
                                </select>
                                <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">
                                    Determines formatting (e.g., $100 vs 100 ج.م)
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="btn-primary"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        {t('common.save')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'alerts' && (
                    <AlertsRemindersSettings />
                )}

                {activeTab === 'backup' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t('settings.backup')}</h3>

                            <button onClick={createBackup} className="btn-primary">
                                <Upload className="w-4 h-4" />
                                {t('backup.createBackup')}
                            </button>
                        </div>

                        {isBackupLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-dark-400" />
                            </div>
                        ) : backups.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 dark:text-dark-400">
                                <Database className="w-12 h-12 mx-auto mb-2 text-slate-400 dark:text-dark-600" />
                                No backups found
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Date</th>
                                            <th>Size</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {backups.map((backup) => (
                                            <tr key={backup.name}>
                                                <td className="text-slate-900 dark:text-white font-medium">{backup.name}</td>
                                                <td className="text-slate-600 dark:text-dark-300">
                                                    {new Date(backup.createdAt).toLocaleString()}
                                                </td>
                                                <td className="text-slate-600 dark:text-dark-300">
                                                    {(backup.size / 1024 / 1024).toFixed(2)} MB
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => restoreBackup(backup.name)}
                                                            className="btn-icon hover:bg-yellow-500/20 text-slate-500 dark:text-dark-400 hover:text-yellow-600 dark:hover:text-yellow-400"
                                                            title="Restore"
                                                        >
                                                            <RefreshCw className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => downloadBackup(backup.name)}
                                                            className="btn-icon hover:bg-dark-100 dark:hover:bg-dark-700 text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-white"
                                                            title="Download"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteBackup(backup.name)}
                                                            className="btn-icon hover:bg-red-500/20 text-slate-500 dark:text-dark-400 hover:text-red-600 dark:hover:text-red-400"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'license' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t('settings.license')}</h3>

                        <div className="bg-gray-50 dark:bg-dark-900/50 rounded-xl p-6 border border-gray-200 dark:border-dark-700">
                            <div className="flex items-center gap-4 mb-6">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isValid ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                    <Key className={`w-6 h-6 ${isValid ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        {isValid ? 'License Active' : 'License Inactive'}
                                    </h4>
                                    <p className={`text-sm ${isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {isValid ? 'Valid License Key' : 'Please activate your copy'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-dark-700">
                                        <span className="text-slate-500 dark:text-dark-400">License ID</span>
                                        <span className="text-slate-900 dark:text-white font-mono">
                                            {isValid ? 'GYM-XXXX-XXXX-XXXX' : 'Not Activated'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-dark-700">
                                        <span className="text-slate-500 dark:text-dark-400">Machine ID</span>
                                        <span className="text-slate-900 dark:text-white font-mono">
                                            {useLicenseStore.getState().hardwareId || 'Loading...'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-slate-500 dark:text-dark-400">Expires At</span>
                                        <span className="text-slate-900 dark:text-white">
                                            {useLicenseStore.getState().license?.expiresAt
                                                ? new Date(useLicenseStore.getState().license.expiresAt).toLocaleString()
                                                : '-'}
                                        </span>
                                    </div>
                                </div>

                                {/* Activation Form */}
                                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-700">
                                    <label className="label">Update License Key</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="input font-mono uppercase"
                                            placeholder="GYM-XXXX-XXXX-XXXX"
                                            value={licenseKey}
                                            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                                        />
                                        <button
                                            onClick={handleActivate}
                                            disabled={!licenseKey}
                                            className="btn-primary whitespace-nowrap"
                                        >
                                            Activate
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-dark-400 mt-2">
                                        Enter a new key to extend your license or switch plans.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Data Management</h3>
                            <p className="text-slate-500 dark:text-dark-400 text-sm">
                                Clear specific data from the system. Warning: This action cannot be undone.
                            </p>
                        </div>

                        {/* Selective Clear */}
                        <div className="card border border-gray-200 dark:border-dark-700 p-6 space-y-6">
                            <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                <Trash2 className="w-5 h-5 text-yellow-500" />
                                Clear Specific Data
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {['members', 'payments', 'subscriptions', 'logs'].map(target => (
                                    <label key={target} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            checked={resetTargets[target]}
                                            onChange={(e) => setResetTargets(prev => ({ ...prev, [target]: e.target.checked }))}
                                        />
                                        <span className="text-slate-700 dark:text-dark-200 capitalize">{target}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-gray-200 dark:border-dark-700">
                                <label className="label">Clear data older than (Optional)</label>
                                <input
                                    type="date"
                                    className="input max-w-xs"
                                    value={resetDate}
                                    onChange={(e) => setResetDate(e.target.value)}
                                />
                                <p className="text-xs text-slate-500 mt-1">Leave empty to clear all selected data.</p>
                            </div>

                            <button
                                onClick={() => handleReset(false)}
                                disabled={!Object.values(resetTargets).some(Boolean)}
                                className="btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30"
                            >
                                Clear Selected
                            </button>
                        </div>

                        {/* Factory Reset */}
                        <div className="card bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-6">
                            <h4 className="font-medium text-red-700 dark:text-red-400 mb-2">Factory Reset</h4>
                            <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-6">
                                This will permanently delete ALL data (Members, Payments, Subscriptions, Settings, Logs).
                                The application will be reset to its initial state.
                            </p>
                            <button
                                onClick={() => handleReset(true)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Reset Everything
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default Settings;
