/**
 * ============================================
 * NOTIFICATION BELL COMPONENT
 * ============================================
 * 
 * Header component showing notification badge with dropdown
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    BellRing,
    Check,
    CheckCheck,
    AlertTriangle,
    Clock,
    X,
    Volume2,
    VolumeX,
    Loader2
} from 'lucide-react';
import api from '../utils/api';
import { useSettingsStore, useAuthStore } from '../store';

// Notification sound (base64 encoded short beep)
const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleC8KEIQ+WFBQZG54d2uDkIpxTDIvKjo8Oz5BWF9pcXx+d2ttaVtIRxEULztBOzQzMj9KVFhdV09FREJBQkBCQ0ZJTVFVWFlaWldWVFJQT05NTk5PUVNVVldYWFlZWllYV1ZVVFRUVFRVVlZXWFhZWVhaWVlZWFhXV1ZWVVVVVVVVVVZWVldXWFhYWFhYWFhXV1dXVldXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXVw==';

const NotificationBell = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { getSetting } = useSettingsStore();
    const { isAuthenticated } = useAuthStore();

    const [isOpen, setIsOpen] = useState(false);
    const [unseenCount, setUnseenCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [hasPlayedInitial, setHasPlayedInitial] = useState(false);

    const dropdownRef = useRef(null);
    const audioRef = useRef(null);

    // Initialize audio
    useEffect(() => {
        audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
        audioRef.current.volume = 0.5;
    }, []);

    // Fetch unseen count on mount and every 30 seconds
    useEffect(() => {
        if (isAuthenticated) {
            fetchUnseenCount();
        }
        const interval = setInterval(() => {
            if (isAuthenticated) fetchUnseenCount();
        }, 30000);
        return () => clearInterval(interval);
    }, [isAuthenticated]);

    // Play sound on initial load if there are unseen notifications
    useEffect(() => {
        if (unseenCount > 0 && !hasPlayedInitial && soundEnabled) {
            playNotificationSound();
            setHasPlayedInitial(true);
        }
    }, [unseenCount, hasPlayedInitial, soundEnabled]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchUnseenCount = async () => {
        try {
            const response = await api.get('/notifications/unseen-count');
            if (response.data.success) {
                const newCount = response.data.data.count;

                // Play sound if count increased
                if (newCount > unseenCount && hasPlayedInitial && soundEnabled) {
                    playNotificationSound();
                }

                setUnseenCount(newCount);
            }
        } catch (error) {
            console.error('Failed to fetch notification count:', error);
        }
    };

    const fetchNotifications = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/notifications?limit=10');
            if (response.data.success) {
                setNotifications(response.data.data.notifications);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const playNotificationSound = () => {
        if (audioRef.current && soundEnabled) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {
                // Audio play failed (user hasn't interacted with page yet)
            });
        }
    };

    const handleBellClick = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            fetchNotifications();
        }
    };

    const handleMarkAsSeen = async (notificationId) => {
        try {
            await api.post(`/notifications/${notificationId}/seen`);
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, seenAt: new Date() } : n)
            );
            setUnseenCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark as seen:', error);
        }
    };

    const handleMarkAllSeen = async () => {
        try {
            await api.post('/notifications/mark-all-seen');
            setNotifications(prev => prev.map(n => ({ ...n, seenAt: new Date() })));
            setUnseenCount(0);
        } catch (error) {
            console.error('Failed to mark all as seen:', error);
        }
    };

    const handleViewAll = () => {
        setIsOpen(false);
        navigate('/payment-alerts');
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'PAYMENT_OVERDUE':
                return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case 'PAYMENT_DUE':
                return <Clock className="w-4 h-4 text-amber-500" />;
            default:
                return <Bell className="w-4 h-4 text-blue-500" />;
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'الآن';
        if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
        if (diffHours < 24) return `منذ ${diffHours} ساعة`;
        return `منذ ${diffDays} يوم`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={handleBellClick}
                className={`relative p-2 rounded-lg transition-colors ${isOpen
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'hover:bg-gray-100 dark:hover:bg-dark-800 text-gray-500 dark:text-gray-400'
                    }`}
            >
                {unseenCount > 0 ? (
                    <BellRing className="w-5 h-5 animate-pulse" />
                ) : (
                    <Bell className="w-5 h-5" />
                )}

                {/* Badge */}
                {unseenCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                        {unseenCount > 9 ? '9+' : unseenCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute left-0 mt-2 w-80 bg-white dark:bg-dark-800 rounded-xl shadow-xl border border-gray-200 dark:border-dark-700 overflow-hidden z-50"
                        style={{ right: 'auto' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-dark-700">
                            <h3 className="font-bold text-gray-900 dark:text-white">
                                الإشعارات
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSoundEnabled(!soundEnabled)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                                    title={soundEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
                                >
                                    {soundEnabled ? (
                                        <Volume2 className="w-4 h-4 text-gray-500" />
                                    ) : (
                                        <VolumeX className="w-4 h-4 text-gray-400" />
                                    )}
                                </button>
                                {unseenCount > 0 && (
                                    <button
                                        onClick={handleMarkAllSeen}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                                        title="تحديد الكل كمقروء"
                                    >
                                        <CheckCheck className="w-4 h-4 text-gray-500" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Notifications List */}
                        <div className="max-h-80 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                                    <Bell className="w-8 h-8 mb-2 opacity-50" />
                                    <p className="text-sm">لا توجد إشعارات</p>
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 border-b border-gray-50 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors cursor-pointer ${!notification.seenAt ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''
                                            }`}
                                        onClick={() => !notification.seenAt && handleMarkAsSeen(notification.id)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {formatTime(notification.createdAt)}
                                                </p>
                                            </div>
                                            {!notification.seenAt && (
                                                <div className="w-2 h-2 rounded-full bg-primary-500 mt-2" />
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-gray-100 dark:border-dark-700">
                            <button
                                onClick={handleViewAll}
                                className="w-full text-center text-sm text-primary-500 hover:text-primary-600 font-medium"
                            >
                                عرض جميع التنبيهات
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default NotificationBell;
