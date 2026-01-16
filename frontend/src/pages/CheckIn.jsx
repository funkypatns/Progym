import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../utils/api';
import toast from 'react-hot-toast';
import {
    Grid, Box, Card, CardContent, Typography, Button,
    TextField, Stack, Chip, InputAdornment, Alert, CircularProgress,
    IconButton, Avatar, List, ListItem, ListItemText, ListItemAvatar,
    useTheme, LinearProgress
} from '@mui/material';
import {
    BadgeRounded, SearchRounded,
    QrCode2Rounded, HistoryRounded,
    TrendingUpRounded, RefreshRounded,
    VerifiedUserRounded, ShieldRounded, BoltRounded, TimerRounded, CalendarMonthRounded
} from '@mui/icons-material';
import { QrCode, ScanFace } from 'lucide-react';

const CheckIn = () => {
    const { t } = useTranslation();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    // --- Translation Helper (Critical: Prevents raw keys) ---
    const tr = (key, fallback) => {
        const result = t(key);
        // If translation is missing (returns key) or empty, use fallback
        return (!result || result === key) ? fallback : result;
    };

    // --- State (Preserved) ---
    const [mode, setMode] = useState('manual'); // manual, scan
    const [memberId, setMemberId] = useState('');
    const [checkIns, setCheckIns] = useState([]);
    const [stats, setStats] = useState({ active: 0, today: 0 });
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const inputRef = useRef(null);

    // --- Effects (Preserved) ---
    useEffect(() => {
        fetchActivity();
        const interval = setInterval(fetchActivity, 30000);
        if (inputRef.current) inputRef.current.focus();
        return () => clearInterval(interval);
    }, []);

    const fetchActivity = async () => {
        try {
            const [todayRes, activeRes] = await Promise.all([
                apiClient.get('/checkin/today'),
                apiClient.get('/checkin/active')
            ]);
            if (todayRes.data.success) {
                setCheckIns(todayRes.data.data.checkIns);
                setStats(s => ({ ...s, today: todayRes.data.data.checkIns.length }));
            }
            if (activeRes.data.success) {
                setStats(s => ({ ...s, active: activeRes.data.data.count }));
            }
        } catch (e) {
            console.error("Sync activity failed", e);
        }
    };

    // --- Handlers (Preserved) ---
    const handleCheckIn = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!memberId) return;

        setLoading(true);
        setErrorMessage('');
        try {
            await apiClient.post('/checkin', { memberId, method: mode });
            toast.success(tr('checkin.success', 'تم تسجيل الدخول بنجاح'));
            setMemberId('');
            fetchActivity();
            if (inputRef.current) inputRef.current.focus();
        } catch (error) {
            const msg = error.response?.data?.message || 'فشل تسجيل الدخول';
            setErrorMessage(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleModeChange = (event, newMode) => {
        if (newMode) {
            setMode(newMode);
            setErrorMessage('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleBiometric = async () => {
        if (!window.PublicKeyCredential) {
            toast.error(tr('checkin.biometricError', 'الجهاز لا يدعم Face ID'));
            return;
        }
        setLoading(true);
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            await navigator.credentials.get({
                publicKey: {
                    challenge,
                    timeout: 60000,
                    userVerification: 'preferred',
                }
            });
            toast.success(tr('checkin.biometricScan', 'تم التحقق من Face ID'));
        } catch (err) {
            if (err.name !== 'NotAllowedError') {
                toast.error(tr('checkin.biometricFailed', 'فشلت المصادقة'));
            }
        } finally {
            setLoading(false);
        }
    };

    // --- UX Components ---
    const GlassCard = ({ children, sx, ...props }) => (
        <Card
            elevation={0}
            sx={{
                bgcolor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(255, 255, 255, 0.75)',
                backdropFilter: 'blur(20px)',
                borderRadius: 4,
                border: '1px solid',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                boxShadow: isDark ? '0 8px 32px 0 rgba(0, 0, 0, 0.3)' : '0 8px 32px 0 rgba(100, 100, 111, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                ...sx
            }}
            {...props}
        >
            {children}
        </Card>
    );

    return (
        <Box
            sx={{
                height: '100%', // Fills MainLayout content wrapper
                width: '100%',  // Fills MainLayout content wrapper
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                // Detailed gradient background
                background: isDark
                    ? 'radial-gradient(circle at 50% 0%, rgba(30, 41, 59, 0.5) 0%, transparent 70%)'
                    : 'radial-gradient(circle at 50% 0%, rgba(241, 245, 249, 0.8) 0%, transparent 70%)'
            }}
        >
            {/* 
               LAYOUT FIX: No maxWidth="xl" or rigid pixel widths. 
               This box simply takes 100% of the available space provided by MainLayout.
            */}
            <Box sx={{ flex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

                <Grid
                    container
                    spacing={3}
                    sx={{ width: '100%', m: 0, height: '100%', flex: 1 }}
                >

                    {/* --- LEFT (Desktop): RECENT ACTIVITY --- */}
                    <Grid item xs={12} lg={3} sx={{ height: '100%', pl: '0 !important', pb: '0 !important', order: { xs: 3, lg: 1 } }}>
                        <GlassCard sx={{ maxHeight: '100%', overflow: 'hidden' }}>
                            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
                                <Box display="flex" alignItems="center" gap={1.5}>
                                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.soft', color: 'primary.main' }}>
                                        <HistoryRounded fontSize="small" />
                                    </Avatar>
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        {tr('checkin.feed', 'سجل النشاط')}
                                    </Typography>
                                </Box>
                                <IconButton size="small" onClick={fetchActivity}>
                                    <RefreshRounded fontSize="small" />
                                </IconButton>
                            </Box>

                            <List sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
                                {!checkIns.length ? (
                                    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5, p: 2, textAlign: 'center' }}>
                                        <HistoryRounded sx={{ fontSize: 48, mb: 1, color: 'text.disabled' }} />
                                        <Typography variant="body2" fontWeight={600} color="text.secondary">
                                            {tr('checkin.noData', 'لا يوجد نشاط حتى الآن')}
                                        </Typography>
                                    </Box>
                                ) : (
                                    checkIns.map((log, index) => (
                                        <ListItem
                                            key={log.id || index}
                                            alignItems="flex-start"
                                            sx={{
                                                mb: 1, borderRadius: 3,
                                                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'white',
                                                border: '1px solid', borderColor: 'divider'
                                            }}
                                        >
                                            <ListItemAvatar>
                                                <Avatar
                                                    src={log.member?.photoUrl}
                                                    sx={{
                                                        fontWeight: 700,
                                                        width: 40, height: 40,
                                                        bgcolor: log.checkOutTime ? 'action.hover' : 'primary.main',
                                                        color: log.checkOutTime ? 'text.secondary' : 'white',
                                                        fontSize: '0.9rem'
                                                    }}
                                                >
                                                    {log.member?.firstName?.[0]}
                                                </Avatar>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={
                                                    <Typography variant="subtitle2" fontWeight={700}>
                                                        {log.member?.firstName} {log.member?.lastName}
                                                    </Typography>
                                                }
                                                secondary={
                                                    <Stack direction="row" alignItems="center" justifyContent="space-between" mt={0.5}>
                                                        <Chip
                                                            label={log.checkOutTime ? 'خروج' : 'دخول'}
                                                            size="small"
                                                            color={log.checkOutTime ? 'default' : 'success'}
                                                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800 }}
                                                        />
                                                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                                            {new Date(log.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Typography>
                                                    </Stack>
                                                }
                                            />
                                        </ListItem>
                                    ))
                                )}
                            </List>
                        </GlassCard>
                    </Grid>

                    {/* --- CENTER (Desktop): MAIN INPUT --- */}
                    <Grid item xs={12} lg={6} sx={{ height: '100%', pb: '0 !important', order: { xs: 1, lg: 2 } }}>
                        <GlassCard sx={{ position: 'relative', overflow: 'hidden', height: '100%', justifyContent: 'center' }}>
                            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: { xs: 2, md: 6 } }}>

                                <Box mb={5} textAlign="center">
                                    <Box
                                        sx={{
                                            display: 'inline-flex', alignItems: 'center', gap: 1,
                                            px: 2, py: 0.8, borderRadius: 20,
                                            bgcolor: 'primary.soft', color: 'primary.main', mb: 3
                                        }}
                                    >
                                        <VerifiedUserRounded fontSize="small" color="inherit" />
                                        <Typography variant="caption" fontWeight={800} letterSpacing={0.5}>
                                            SMART ACCESS POINT
                                        </Typography>
                                    </Box>
                                    <Typography variant="h3" fontWeight={900} letterSpacing="-0.5px" gutterBottom>
                                        {tr('checkin.welcome', 'أهلاً بك في النادي')}
                                    </Typography>
                                    <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500, opacity: 0.8 }}>
                                        {mode === 'manual' ? tr('checkin.instructionManual', 'سجل دخولك برقم العضوية') : tr('checkin.instructionScan', 'امسح رمز QR للمتابعة')}
                                    </Typography>
                                </Box>

                                {/* Tabs */}
                                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 5 }}>
                                    <Box sx={{ p: 0.6, bgcolor: 'background.default', borderRadius: 4, display: 'flex', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                                        <Button
                                            onClick={() => handleModeChange(null, 'manual')}
                                            variant={mode === 'manual' ? 'contained' : 'text'}
                                            sx={{
                                                px: 4, py: 1.2, borderRadius: 3.5, fontWeight: 800, fontSize: '1rem',
                                                bgcolor: mode === 'manual' ? 'primary.main' : 'transparent',
                                                color: mode === 'manual' ? 'white' : 'text.secondary',
                                                boxShadow: mode === 'manual' ? 4 : 0,
                                                minWidth: 140
                                            }}
                                            startIcon={<BadgeRounded />}
                                        >
                                            {tr('checkin.manual', 'رقم العضو')}
                                        </Button>
                                        <Button
                                            onClick={() => handleModeChange(null, 'scan')}
                                            variant={mode === 'scan' ? 'contained' : 'text'}
                                            sx={{
                                                px: 4, py: 1.2, borderRadius: 3.5, fontWeight: 800, fontSize: '1rem',
                                                bgcolor: mode === 'scan' ? 'primary.main' : 'transparent',
                                                color: mode === 'scan' ? 'white' : 'text.secondary',
                                                boxShadow: mode === 'scan' ? 4 : 0,
                                                minWidth: 140
                                            }}
                                            startIcon={<QrCode2Rounded />}
                                        >
                                            {tr('checkin.scanner', 'الماسح')}
                                        </Button>
                                    </Box>
                                </Box>

                                {/* Input Area with internal maxWidth only to keep form nice */}
                                <Box sx={{ width: '100%', maxWidth: 520 }}>
                                    {mode === 'manual' ? (
                                        <Stack spacing={2.5}>
                                            <TextField
                                                inputRef={inputRef}
                                                fullWidth
                                                variant="outlined"
                                                placeholder="ـــ ـــ ـــ ـــ"
                                                value={memberId}
                                                onChange={(e) => setMemberId(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleCheckIn(e); }}
                                                dir="rtl"
                                                InputProps={{
                                                    startAdornment: <InputAdornment position="start"><SearchRounded color="action" /></InputAdornment>,
                                                    sx: {
                                                        fontSize: '1.4rem', fontWeight: 700, textAlign: 'center', py: 1.5, px: 2,
                                                        borderRadius: 4,
                                                        bgcolor: 'background.paper',
                                                        '& fieldset': { border: 'none' },
                                                        boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
                                                    }
                                                }}
                                            />
                                            <Button
                                                variant="contained"
                                                size="large"
                                                fullWidth
                                                onClick={handleCheckIn}
                                                disabled={loading || !memberId}
                                                sx={{
                                                    py: 2, borderRadius: 4, fontSize: '1.1rem', fontWeight: 800,
                                                    boxShadow: '0 8px 25px rgba(59, 130, 246, 0.35)',
                                                    transition: 'transform 0.2s',
                                                    '&:hover': { transform: 'translateY(-2px)' }
                                                }}
                                            >
                                                {loading ? <CircularProgress size={26} color="inherit" /> : tr('checkin.action', 'تسجيل الدخول')}
                                            </Button>

                                            <Button
                                                onClick={handleBiometric}
                                                startIcon={<ScanFace />}
                                                sx={{
                                                    py: 1.5, borderRadius: 3, fontWeight: 700,
                                                    color: 'text.secondary',
                                                    '&:hover': { color: 'primary.main', bgcolor: 'primary.soft' }
                                                }}
                                            >
                                                {tr('checkin.useFaceId', 'استخدام Face ID للسرعة')}
                                            </Button>
                                        </Stack>
                                    ) : (
                                        <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16/10', borderRadius: 5, overflow: 'hidden', boxShadow: theme.shadows[4], border: '4px solid', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                                            <Box sx={{ width: '100%', height: '100%', bgcolor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <QrCode size={80} color="white" style={{ opacity: 0.8 }} />
                                            </Box>

                                            {/* Radar Scan Effect */}
                                            <Box sx={{
                                                position: 'absolute', inset: 0,
                                                background: 'conic-gradient(from 0deg at 50% 50%, transparent 0%, rgba(34, 197, 94, 0.3) 25%, transparent 50%)',
                                                animation: 'radar 3s infinite linear',
                                                borderRadius: '50%',
                                                width: '140%', height: '140%', top: '-20%', left: '-20%'
                                            }} />
                                            <style>{`@keyframes radar { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>

                                            <TextField
                                                value={memberId}
                                                onChange={(e) => setMemberId(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleCheckIn(e); }}
                                                sx={{ opacity: 0, position: 'absolute', inset: 0 }}
                                                autoFocus
                                            />
                                        </Box>
                                    )}
                                </Box>

                                {/* Error Toast Area */}
                                {errorMessage && (
                                    <Alert
                                        severity="error"
                                        sx={{ mt: 3, borderRadius: 3, fontWeight: 600, border: '1px solid', borderColor: 'error.main' }}
                                        onClose={() => setErrorMessage('')}
                                    >
                                        {errorMessage}
                                    </Alert>
                                )}

                            </CardContent>
                        </GlassCard>
                    </Grid>

                    {/* --- RIGHT (Desktop): STATS --- */}
                    <Grid item xs={12} lg={3} sx={{ height: '100%', pb: '0 !important', order: { xs: 2, lg: 3 } }}>
                        <Stack spacing={3} sx={{ height: '100%' }}>

                            {/* Live Stats */}
                            <GlassCard sx={{ justifyContent: 'space-between', p: 3, position: 'relative', overflow: 'hidden', minHeight: 180 }}>
                                <Box sx={{ position: 'absolute', right: -20, top: -20, opacity: 0.05, transform: 'rotate(-15deg)' }}>
                                    <BoltRounded sx={{ fontSize: 160 }} />
                                </Box>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Avatar variant="rounded" sx={{ bgcolor: 'success.soft', color: 'success.main', borderRadius: 3 }}>
                                        <TrendingUpRounded />
                                    </Avatar>
                                    <Chip label="ONLINE" color="success" size="small" sx={{ fontWeight: 800, borderRadius: 1.5 }} />
                                </Stack>
                                <Box mt={3}>
                                    <Typography variant="h3" fontWeight={900} color="text.primary" sx={{ lineHeight: 1 }}>
                                        {stats.active ?? 0}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" fontWeight={700} mt={1}>
                                        {tr('checkin.activeNow', 'متواجدون الآن')}
                                    </Typography>
                                </Box>
                                <LinearProgress variant="determinate" value={Math.min((stats.active / 50) * 100, 100)} color="success" sx={{ height: 6, borderRadius: 3, mt: 3, bgcolor: 'success.soft' }} />
                            </GlassCard>

                            {/* Today Stats */}
                            <GlassCard sx={{ justifyContent: 'space-between', p: 3, position: 'relative', overflow: 'hidden', minHeight: 180 }}>
                                <Box sx={{ position: 'absolute', right: -20, top: -20, opacity: 0.05, transform: 'rotate(-15deg)' }}>
                                    <TimerRounded sx={{ fontSize: 160 }} />
                                </Box>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Avatar variant="rounded" sx={{ bgcolor: 'primary.soft', color: 'primary.main', borderRadius: 3 }}>
                                        <CalendarMonthRounded />
                                    </Avatar>
                                    <Chip label="TODAY" color="primary" size="small" sx={{ fontWeight: 800, borderRadius: 1.5 }} />
                                </Stack>
                                <Box mt={3}>
                                    <Typography variant="h3" fontWeight={900} color="text.primary" sx={{ lineHeight: 1 }}>
                                        {stats.today ?? 0}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" fontWeight={700} mt={1}>
                                        {tr('checkin.todayVisits', 'إجمالي الزيارات')}
                                    </Typography>
                                </Box>
                                <LinearProgress variant="determinate" value={Math.min((stats.today / 100) * 100, 100)} color="primary" sx={{ height: 6, borderRadius: 3, mt: 3, bgcolor: 'primary.soft' }} />
                            </GlassCard>

                            {/* Status Tip */}
                            <GlassCard sx={{ bgcolor: 'primary.main', color: 'white', justifyContent: 'center', p: 3, flex: 1, maxHeight: 150 }}>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <ShieldRounded fontSize="medium" />
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight={800}>
                                            {tr('checkin.statusOK', 'النظام محمي')}
                                        </Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 500 }}>
                                            {tr('checkin.syncing', 'يعمل بكفاءة 100%')}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </GlassCard>

                        </Stack>
                    </Grid>

                </Grid>
            </Box>
        </Box>
    );
};

export default CheckIn;
