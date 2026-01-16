import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Global Audio instance to prevent multiple overlaps
const alertAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

export const useSubscriptionAlerts = () => {
    const { t, i18n } = useTranslation();

    // State
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadAlerts, setUnreadAlerts] = useState([]);
    const [isPolling, setIsPolling] = useState(false);

    // Sound preference from localStorage
    const [soundEnabled, setSoundEnabled] = useState(() => {
        const saved = localStorage.getItem('alerts.soundEnabled');
        return saved === null ? true : saved === 'true';
    });

    // Refs for comparison
    const prevCountRef = useRef(0);
    const isFirstLoadRef = useRef(true);

    // Save sound preference
    useEffect(() => {
        localStorage.setItem('alerts.soundEnabled', soundEnabled);
    }, [soundEnabled]);

    // Play Sound
    const playSound = useCallback(() => {
        if (!soundEnabled) return;

        // Reset and play
        alertAudio.currentTime = 0;
        alertAudio.play().catch(e => console.warn('Audio play blocked:', e));
    }, [soundEnabled]);

    // Fetch Unread Count
    const checkUnreadCount = useCallback(async (silent = true) => {
        if (!silent) setIsPolling(true);
        try {
            const response = await api.get('/subscription-alerts/unread-count');
            const newCount = response.data.data.count;

            setUnreadCount(newCount);

            // Play sound if count INCREASED (new alerts arrived)
            // Skip sound on very first load to avoid annoyance on refresh
            if (!isFirstLoadRef.current && newCount > prevCountRef.current) {
                playSound();
                toast(`⚠️ ${newCount - prevCountRef.current} ${i18n.language === 'ar' ? 'تنبيهات جديدة' : 'new alerts'}`, {
                    icon: '🔔',
                    duration: 4000
                });
            }

            prevCountRef.current = newCount;
        } catch (error) {
            console.error('Failed to check alerts:', error);
        } finally {
            if (!silent) setIsPolling(false);
            isFirstLoadRef.current = false;
        }
    }, [i18n.language, playSound]);

    // Fetch Actual List (when page opens)
    const fetchUnreadAlerts = useCallback(async () => {
        setIsPolling(true);
        try {
            const response = await api.get('/subscription-alerts/unread');
            setUnreadAlerts(response.data.data);
        } catch (error) {
            console.error('Failed to fetch unread list:', error);
        } finally {
            setIsPolling(false);
        }
    }, []);

    // Mark as Read
    const markAsRead = useCallback(async (ids = []) => {
        try {
            await api.post('/subscription-alerts/mark-read', { ids: ids.length ? ids : undefined });

            // Optimistic update
            if (ids.length > 0) {
                setUnreadAlerts(prev => prev.filter(a => !ids.includes(a.id)));
                setUnreadCount(prev => Math.max(0, prev - ids.length));
            } else {
                setUnreadAlerts([]);
                setUnreadCount(0);
            }

            prevCountRef.current = ids.length > 0 ? Math.max(0, prevCountRef.current - ids.length) : 0;

            toast.success(i18n.language === 'ar' ? 'تم تحديدها كمقروءة' : 'Marked as read');
        } catch (error) {
            toast.error('Failed to mark as read');
        }
    }, [i18n.language]);

    // Polling Effect (Global)
    useEffect(() => {
        checkUnreadCount(true); // Initial check

        const interval = setInterval(() => {
            checkUnreadCount(true);
        }, 30000); // Poll every 30s

        // Listen for manual updates (e.g. from other components)
        const handleManualUpdate = () => checkUnreadCount(true);
        window.addEventListener('alerts:updated', handleManualUpdate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('alerts:updated', handleManualUpdate);
        };
    }, [checkUnreadCount]);

    return {
        unreadCount,
        unreadAlerts,
        isPolling,
        fetchUnreadAlerts,
        markAsRead,
        checkUnreadCount,
        soundEnabled,
        setSoundEnabled
    };
};
