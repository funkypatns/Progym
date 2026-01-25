/**
 * ============================================
 * ALERTS & REMINDERS SETTINGS
 * ============================================
 * 
 * Settings page tab for voice alerts and reminder configuration
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Loader2, Bell, Volume2, Calendar, Sliders } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { getTTSSettings, saveTTSSettings } from '../utils/tts';

const AlertsRemindersSettings = () => {
    const { t, i18n } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Reminder settings (from DB)
    const [reminderSettings, setReminderSettings] = useState({
        enableAutoReminders: true,
        reminderDaysBeforeDue: 3,
        dueSoonDays: 3
    });

    // Voice/Sound settings (from localStorage)
    const [alertSettings, setAlertSettings] = useState({
        enableSoundAlerts: true,
        enableVoiceAlerts: true,
        maxSpokenPerBatch: 3
    });

    useEffect(() => {
        loadSettings();
    }, []);

    const parseBoolean = (value, fallback = true) => {
        if (value === undefined || value === null) return fallback;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return fallback;
    };

    const parseNumber = (value, fallback) => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            // Load reminder settings from backend
            const response = await api.get('/settings');
            if (response.data.success) {
                const settings = response.data.data;
                setReminderSettings({
                    enableAutoReminders: parseBoolean(settings.general?.enable_auto_reminders, true),
                    reminderDaysBeforeDue: parseNumber(settings.general?.reminder_days_before_due, 3),
                    dueSoonDays: parseNumber(settings.general?.due_soon_days, 3)
                });
            }

            // Load voice/sound settings from localStorage
            const ttsSettings = getTTSSettings();
            setAlertSettings({
                enableSoundAlerts: ttsSettings.enableSound,
                enableVoiceAlerts: ttsSettings.enableVoice,
                maxSpokenPerBatch: ttsSettings.maxSpokenPerBatch
            });
        } catch (error) {
            console.error('Failed to load settings:', error);
            toast.error('Failed to load settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save reminder settings to backend
            await api.put('/settings', {
                settings: {
                    enable_auto_reminders: reminderSettings.enableAutoReminders,
                    reminder_days_before_due: reminderSettings.reminderDaysBeforeDue,
                    due_soon_days: reminderSettings.dueSoonDays
                }
            });

            // Save voice/sound settings to localStorage
            const currentTTS = getTTSSettings();
            saveTTSSettings({
                ...currentTTS,
                enableSound: alertSettings.enableSoundAlerts,
                enableVoice: alertSettings.enableVoiceAlerts,
                maxSpokenPerBatch: alertSettings.maxSpokenPerBatch
            });

            toast.success(i18n.language === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved successfully');
        } catch (error) {
            console.error('Failed to save settings:', error);
            toast.error(i18n.language === 'ar' ? 'فشل حفظ الإعدادات' : 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {i18n.language === 'ar' ? 'التنبيهات والتذكير' : 'Alerts & Reminders'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-dark-400">
                    {i18n.language === 'ar'
                        ? 'إعدادات التنبيهات الصوتية وتذكيرات المدفوعات'
                        : 'Configure voice alerts and payment reminder settings'}
                </p>
            </div>

            {/* Automatic Reminders Section */}
            <div className="card border border-gray-200 dark:border-dark-700 p-6 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h4 className="font-medium text-slate-900 dark:text-white">
                            {i18n.language === 'ar' ? 'التذكيرات التلقائية' : 'Automatic Reminders'}
                        </h4>
                        <p className="text-sm text-slate-500">
                            {i18n.language === 'ar'
                                ? 'إرسال تذكيرات تلقائية للمدفوعات المتأخرة'
                                : 'Automatically send payment reminders'}
                        </p>
                    </div>
                </div>

                {/* Enable Auto Reminders Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-dark-700/50">
                    <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                            {i18n.language === 'ar' ? 'تفعيل التذكيرات التلقائية' : 'Enable Auto Reminders'}
                        </p>
                        <p className="text-sm text-gray-500">
                            {i18n.language === 'ar'
                                ? 'توليد تذكيرات تلقائية للأعضاء الذين لديهم مدفوعات متبقية'
                                : 'Generate automatic reminders for members with outstanding payments'}
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={reminderSettings.enableAutoReminders}
                            onChange={(e) => setReminderSettings(prev => ({
                                ...prev,
                                enableAutoReminders: e.target.checked
                            }))}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                </div>

                {/* Days Before Due */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-dark-700/50">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {i18n.language === 'ar' ? 'عدد الأيام قبل الاستحقاق' : 'Days Before Due'}
                            </p>
                            <p className="text-sm text-gray-500">
                                {i18n.language === 'ar'
                                    ? 'إرسال تذكير قبل X أيام من تاريخ الاستحقاق'
                                    : 'Send reminder X days before due date'}
                            </p>
                        </div>
                        <span className="text-2xl font-bold text-primary-500">
                            {reminderSettings.reminderDaysBeforeDue}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="14"
                        value={reminderSettings.reminderDaysBeforeDue}
                        onChange={(e) => setReminderSettings(prev => ({
                            ...prev,
                            reminderDaysBeforeDue: parseInt(e.target.value)
                        }))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{i18n.language === 'ar' ? '1 يوم' : '1 day'}</span>
                        <span>{i18n.language === 'ar' ? '14 يوم' : '14 days'}</span>
                    </div>
                </div>

                {/* Due Soon Days */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-dark-700/50">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {i18n.language === 'ar' ? 'عدد أيام "مستحق قريبًا"' : 'Due Soon Days'}
                            </p>
                            <p className="text-sm text-gray-500">
                                {i18n.language === 'ar'
                                    ? 'عرض التنبيهات للمدفوعات التي تستحق خلال X أيام'
                                    : 'Show alerts for payments due within X days'}
                            </p>
                        </div>
                        <span className="text-2xl font-bold text-primary-500">
                            {reminderSettings.dueSoonDays}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="60"
                        value={reminderSettings.dueSoonDays}
                        onChange={(e) => setReminderSettings(prev => ({
                            ...prev,
                            dueSoonDays: parseInt(e.target.value)
                        }))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{i18n.language === 'ar' ? '1 يوم' : '1 day'}</span>
                        <span>{i18n.language === 'ar' ? '60 يوم' : '60 days'}</span>
                    </div>
                </div>
            </div>

            {/* Voice & Sound Alerts Section */}
            <div className="card border border-gray-200 dark:border-dark-700 p-6 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Volume2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h4 className="font-medium text-slate-900 dark:text-white">
                            {i18n.language === 'ar' ? 'التنبيهات الصوتية' : 'Voice & Sound Alerts'}
                        </h4>
                        <p className="text-sm text-slate-500">
                            {i18n.language === 'ar'
                                ? 'إعدادات الصوت والتنبيهات الصوتية (TTS)'
                                : 'Sound and Text-to-Speech alert settings'}
                        </p>
                    </div>
                </div>

                {/* Enable Sound Alerts */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-dark-700/50">
                    <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-gray-500" />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {i18n.language === 'ar' ? 'صوت التنبيه' : 'Alert Sound'}
                            </p>
                            <p className="text-sm text-gray-500">
                                {i18n.language === 'ar'
                                    ? 'تشغيل صوت قصير عند ظهور تنبيه جديد'
                                    : 'Play short beep when new alert appears'}
                            </p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={alertSettings.enableSoundAlerts}
                            onChange={(e) => setAlertSettings(prev => ({
                                ...prev,
                                enableSoundAlerts: e.target.checked
                            }))}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                </div>

                {/* Enable Voice Alerts */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-dark-700/50">
                    <div className="flex items-center gap-3">
                        <Volume2 className="w-5 h-5 text-gray-500" />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {i18n.language === 'ar' ? 'التنبيه الصوتي (TTS)' : 'Voice Alert (TTS)'}
                            </p>
                            <p className="text-sm text-gray-500">
                                {i18n.language === 'ar'
                                    ? 'قراءة اسم العضو والمبلغ المتبقي'
                                    : 'Speak member name and remaining amount'}
                            </p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={alertSettings.enableVoiceAlerts}
                            onChange={(e) => setAlertSettings(prev => ({
                                ...prev,
                                enableVoiceAlerts: e.target.checked
                            }))}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                </div>

                {/* Max Spoken Per Batch */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-dark-700/50">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {i18n.language === 'ar' ? 'عدد التنبيهات لكل مرة' : 'Max Alerts Per Batch'}
                            </p>
                            <p className="text-sm text-gray-500">
                                {i18n.language === 'ar'
                                    ? 'الحد الأقصى للتنبيهات المقروءة في المرة الواحدة'
                                    : 'Maximum alerts to announce at once'}
                            </p>
                        </div>
                        <span className="text-2xl font-bold text-primary-500">
                            {alertSettings.maxSpokenPerBatch}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        value={alertSettings.maxSpokenPerBatch}
                        onChange={(e) => setAlertSettings(prev => ({
                            ...prev,
                            maxSpokenPerBatch: parseInt(e.target.value)
                        }))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>1</span>
                        <span>10</span>
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                    {i18n.language === 'ar' ? (
                        <>
                            <strong>ملاحظة:</strong> التنبيهات الصوتية تعمل تلقائياً عند تسجيل الدخول وكل 45 ثانية.
                            يتم قراءة اسم العضو والمبلغ المتبقي باللغة العربية.
                        </>
                    ) : (
                        <>
                            <strong>Note:</strong> Voice alerts run automatically on login and every 45 seconds.
                            Member names and amounts are announced in Arabic or English based on system language.
                        </>
                    )}
                </p>
            </div>

            {/* Save Button */}
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
                            {i18n.language === 'ar' ? 'حفظ' : 'Save'}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default AlertsRemindersSettings;
