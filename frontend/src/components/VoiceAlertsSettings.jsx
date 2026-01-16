/**
 * ============================================
 * VOICE ALERTS SETTINGS COMPONENT
 * ============================================
 * 
 * Standalone settings section for TTS voice alerts
 */

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Bell, Settings as SettingsIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTTSSettings, saveTTSSettings } from '../utils/tts';

const VoiceAlertsSettings = () => {
    const [settings, setSettings] = useState({
        enableSound: true,
        enableVoice: true,
        maxSpokenPerBatch: 3,
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0
    });

    useEffect(() => {
        const loaded = getTTSSettings();
        setSettings(loaded);
    }, []);

    const handleSave = () => {
        const success = saveTTSSettings(settings);
        if (success) {
            toast.success('Voice alerts settings saved');
        } else {
            toast.error('Failed to save settings');
        }
    };

    const handleChange = (field, value) => {
        setSettings(prev => {
            const updated = { ...prev, [field]: value };
            saveTTSSettings(updated); // Auto-save
            return updated;
        });
    };

    return (
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-gray-100 dark:border-dark-700 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Volume2 className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        التنبيهات الصوتية (TTS)
                    </h2>
                    <p className="text-sm text-gray-500">
                        إعدادات التنبيهات الصوتية للمدفوعات المتأخرة
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Enable Sound */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-dark-700/50">
                    <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-gray-500" />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                صوت التنبيه
                            </p>
                            <p className="text-sm text-gray-500">
                                تشغيل صوت قصير عند ظهور تنبيه جديد
                            </p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.enableSound}
                            onChange={(e) => handleChange('enableSound', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                </div>

                {/* Enable Voice */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-dark-700/50">
                    <div className="flex items-center gap-3">
                        <Volume2 className="w-5 h-5 text-gray-500" />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                التنبيه الصوتي (TTS)
                            </p>
                            <p className="text-sm text-gray-500">
                                قراءة اسم العضو والمبلغ المتبقي
                            </p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.enableVoice}
                            onChange={(e) => handleChange('enableVoice', e.target.checked)}
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
                                عدد التنبيهات لكل مرة
                            </p>
                            <p className="text-sm text-gray-500">
                                الحد الأقصى للتنبيهات المقروءة في المرة الواحدة
                            </p>
                        </div>
                        <span className="text-2xl font-bold text-primary-500">
                            {settings.maxSpokenPerBatch}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        value={settings.maxSpokenPerBatch}
                        onChange={(e) => handleChange('maxSpokenPerBatch', parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>1</span>
                        <span>10</span>
                    </div>
                </div>

                {/* Voice Speed */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-dark-700/50">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                سرعة الصوت
                            </p>
                            <p className="text-sm text-gray-500">
                                تعديل سرعة قراءة التنبيهات
                            </p>
                        </div>
                        <span className="text-lg font-bold text-primary-500">
                            {settings.rate.toFixed(1)}x
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={settings.rate}
                        onChange={(e) => handleChange('rate', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>أبطأ (0.5x)</span>
                        <span>أسرع (2.0x)</span>
                    </div>
                </div>

                {/* Volume */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-dark-700/50">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                مستوى الصوت
                            </p>
                            <p className="text-sm text-gray-500">
                                ضبط ارتفاع الصوت
                            </p>
                        </div>
                        <span className="text-lg font-bold text-primary-500">
                            {Math.round(settings.volume * 100)}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.volume}
                        onChange={(e) => handleChange('volume', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>صامت (0%)</span>
                        <span>عالي (100%)</span>
                    </div>
                </div>

                {/* Info Box */}
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                        <strong>ملاحظة:</strong> التنبيهات الصوتية تعمل تلقائياً عند تسجيل الدخول وكل 45 ثانية.
                        يتم قراءة اسم العضو والمبلغ المتبقي باللغة العربية.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VoiceAlertsSettings;
