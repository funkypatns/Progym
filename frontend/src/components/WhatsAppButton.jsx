/**
 * ============================================
 * WHATSAPP BUTTON COMPONENT
 * ============================================
 */

import React, { useState } from 'react';
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

            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 bg-gray-900/60 dark:bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-dark-800 rounded-2xl w-full max-w-lg shadow-2xl"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-green-500/20">
                                        <MessageCircle className="w-5 h-5 text-green-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white">
                                            WhatsApp - واتساب
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-dark-400">{memberName}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Templates */}
                            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
                                <p className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-3">
                                    قوالب الرسائل / Message Templates
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(MESSAGE_TEMPLATES).map(([id, template]) => {
                                        const Icon = templateIcons[id];
                                        return (
                                            <button
                                                key={id}
                                                onClick={() => handleTemplateSelect(id)}
                                                className={`flex items-center gap-2 p-3 rounded-xl text-sm transition-colors ${selectedTemplate === id
                                                        ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-2 border-green-500'
                                                        : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300 hover:bg-gray-200 dark:hover:bg-dark-600 border-2 border-transparent'
                                                    }`}
                                            >
                                                <Icon className="w-4 h-4" />
                                                <span className="font-medium">{template.nameAr}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Message Editor */}
                            <div className="p-4">
                                <textarea
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    placeholder="اكتب رسالتك هنا... / Write your message..."
                                    className="input min-h-[150px] resize-none"
                                    dir="auto"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-dark-700">
                                <button
                                    onClick={() => handleTemplateSelect(selectedTemplate)}
                                    className="btn-ghost"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Reset
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="btn-secondary"
                                    >
                                        إلغاء / Cancel
                                    </button>
                                    <button
                                        onClick={handleSend}
                                        className="btn bg-green-600 text-white hover:bg-green-700"
                                    >
                                        <Send className="w-4 h-4" />
                                        إرسال / Send
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};

export default WhatsAppButton;
