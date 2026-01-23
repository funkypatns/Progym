/**
 * ============================================
 * WHATSAPP BUTTON COMPONENT
 * ============================================
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageCircle,
    X,
    Send,
    RefreshCw,
    Bell,
    Gift,
    UserX,
    MessageSquare
} from 'lucide-react';
import { openWhatsApp, MESSAGE_TEMPLATES, getTemplateMessage } from '../utils/whatsapp';
import { useSettingsStore } from '../store';

// Simple WhatsApp Icon Button
export const WhatsAppButton = ({ phone, className = '' }) => {
    if (!phone) return null;

    return (
        <button
            onClick={() => openWhatsApp(phone)}
            className={`p-2 rounded-lg bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-colors ${className}`}
            title="Open WhatsApp"
        >
            <MessageCircle className="w-4 h-4" />
        </button>
    );
};

// WhatsApp Button with Template Modal
export const WhatsAppButtonWithTemplates = ({
    phone,
    memberName,
    daysRemaining,
    isInactive = false,
    className = ''
}) => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const gymName = getSetting('gym_name', 'النادي');

    const [showModal, setShowModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState('general');
    const [customMessage, setCustomMessage] = useState('');

    // -- Effects for Scroll Lock & ESC Key --
    useEffect(() => {
        if (showModal) {
            // Lock scrolling
            document.body.style.overflow = 'hidden';

            // Handle ESC key
            const handleEsc = (e) => {
                if (e.key === 'Escape') setShowModal(false);
            };
            window.addEventListener('keydown', handleEsc);

            return () => {
                document.body.style.overflow = 'unset';
                window.removeEventListener('keydown', handleEsc);
            };
        }
    }, [showModal]);

    if (!phone) return null;

    const handleTemplateSelect = (templateId) => {
        setSelectedTemplate(templateId);
        const message = getTemplateMessage(templateId, {
            memberName,
            gymName,
            daysRemaining
        }, i18n.language);
        setCustomMessage(message);
    };

    const handleSend = () => {
        openWhatsApp(phone, customMessage);
        setShowModal(false);
        setCustomMessage('');
    };

    const templateIcons = {
        renewal: Bell,
        inactive: UserX,
        offer: Gift,
        general: MessageSquare
    };

    // -- Render Modal via Portal --
    const modalContent = (
        <AnimatePresence>
            {showModal && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowModal(false)}
                        className="absolute inset-0 bg-gray-900/80 dark:bg-dark-950/90 backdrop-blur-md"
                        style={{ zIndex: -1 }}
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative bg-white dark:bg-dark-800 rounded-[2rem] w-full max-w-lg shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] overflow-hidden max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-800/50 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 shadow-sm ring-1 ring-emerald-500/20">
                                    <MessageCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight">
                                        {i18n.language === 'ar' ? 'إرسال عبر واتساب' : 'WhatsApp Contact'}
                                    </h3>
                                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{memberName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-xl transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scrollable Content Body */}
                        <div className="overflow-y-auto custom-scrollbar">
                            {/* Templates */}
                            <div className="p-6 border-b border-gray-100 dark:border-dark-700">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
                                    {i18n.language === 'ar' ? 'اختر قالب الرسالة' : 'Choose Message Template'}
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries(MESSAGE_TEMPLATES).map(([id, template]) => {
                                        const Icon = templateIcons[id];
                                        return (
                                            <button
                                                key={id}
                                                onClick={() => handleTemplateSelect(id)}
                                                className={`flex items-center gap-3 p-4 rounded-2xl text-sm transition-all border-2 ${selectedTemplate === id
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500 shadow-lg shadow-emerald-500/10'
                                                    : 'bg-gray-50 dark:bg-dark-700/50 text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-700 border-transparent'
                                                    }`}
                                            >
                                                <div className={`p-2 rounded-lg ${selectedTemplate === id ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-dark-800 text-gray-400'}`}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <span className="font-bold">{i18n.language === 'ar' ? template.nameAr : template.nameEn}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Message Editor */}
                            <div className="p-6">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">
                                    {i18n.language === 'ar' ? 'محتوى الرسالة' : 'Message Content'}
                                </label>
                                <textarea
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    placeholder={i18n.language === 'ar' ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
                                    className="w-full min-h-[120px] p-4 bg-gray-50 dark:bg-dark-900 border border-gray-100 dark:border-dark-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none shadow-inner"
                                    dir="auto"
                                />
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="flex items-center justify-between p-6 bg-gray-50/50 dark:bg-dark-800/50 border-t border-gray-100 dark:border-dark-700 shrink-0">
                            <button
                                onClick={() => handleTemplateSelect(selectedTemplate)}
                                className="flex items-center gap-2 text-xs font-black text-gray-400 hover:text-emerald-500 uppercase tracking-widest transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                {i18n.language === 'ar' ? 'إعادة تعيين' : 'Reset'}
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors"
                                >
                                    {i18n.language === 'ar' ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button
                                    onClick={handleSend}
                                    className="flex items-center gap-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
                                >
                                    <Send className="w-4 h-4" />
                                    {i18n.language === 'ar' ? 'إرسال' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            <button
                onClick={() => {
                    if (isInactive) {
                        handleTemplateSelect('inactive');
                    }
                    setShowModal(true);
                }}
                className={`p-2 rounded-lg bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-colors ${className}`}
                title="Send WhatsApp Message"
            >
                <MessageCircle className="w-4 h-4" />
            </button>

            {/* Portal Rendering */}
            {typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : null}
        </>
    );
};

export default WhatsAppButton;
