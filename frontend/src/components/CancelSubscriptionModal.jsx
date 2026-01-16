import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Divider,
    CircularProgress,
    Stack,
    Alert,
    useTheme,
    alpha
} from '@mui/material';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { formatCurrency } from '../utils/numberFormatter';
import { useSettingsStore } from '../store';

const CancelSubscriptionModal = ({ isOpen, onClose, subscription, onConfirm }) => {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const { getSetting } = useSettingsStore();
    const [isLoading, setIsLoading] = useState(true);
    const [previewData, setPreviewData] = useState(null);
    const [error, setError] = useState(null);

    const currencyConf = {
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    };

    useEffect(() => {
        if (isOpen && subscription) {
            fetchPreview();
        }
    }, [isOpen, subscription]);

    const fetchPreview = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get(`/subscriptions/${subscription.id}/preview-cancel`);
            if (res.data.success) {
                setPreviewData(res.data.data);
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to load preview');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
        setPreviewData(null);
        setError(null);
    };

    return (
        <Dialog
            open={isOpen}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 3 }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AlertTriangle className="text-amber-400" size={24} />
                <Typography variant="h6" fontWeight="bold">
                    {t('subscriptions.cancelTitle', 'Cancel Subscription')}
                </Typography>
            </DialogTitle>

            <DialogContent dividers>
                {isLoading ? (
                    <Box display="flex" justifyContent="center" py={4}>
                        <CircularProgress size={32} />
                    </Box>
                ) : error ? (
                    <Alert severity="error" action={
                        <Button color="inherit" size="small" onClick={fetchPreview}>
                            Retry
                        </Button>
                    }>
                        {error}
                    </Alert>
                ) : previewData ? (
                    <Stack spacing={2}>
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                            <Stack spacing={1}>
                                <Box display="flex" justifyContent="space-between">
                                    <Typography variant="body2" color="text.secondary">Total Price:</Typography>
                                    <Typography variant="body2" fontWeight="600">
                                        {formatCurrency(subscription.totalPrice || subscription.plan.price, i18n.language, currencyConf)}
                                    </Typography>
                                </Box>
                                <Box display="flex" justifyContent="space-between">
                                    <Typography variant="body2" color="text.secondary">Paid Amount:</Typography>
                                    <Typography variant="body2" fontWeight="600">
                                        {formatCurrency(previewData.paidTotal, i18n.language, currencyConf)}
                                    </Typography>
                                </Box>
                                <Divider sx={{ borderStyle: 'dashed' }} />
                                <Box display="flex" justifyContent="space-between">
                                    <Typography variant="body2" color="text.secondary">
                                        Used Days ({previewData.usedDays}/{previewData.totalDuration}):
                                    </Typography>
                                    <Typography variant="body2" fontWeight="bold" color="warning.main">
                                        {formatCurrency(previewData.usedAmount, i18n.language, currencyConf)}
                                    </Typography>
                                </Box>
                                <Box display="flex" justifyContent="space-between">
                                    <Typography variant="body2" color="text.secondary">Non-Refundable (Consumed):</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {formatCurrency(previewData.usedAmount, i18n.language, currencyConf)}
                                    </Typography>
                                </Box>

                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        bgcolor: theme.palette.background.paper,
                                        p: 1.5,
                                        borderRadius: 1,
                                        mt: 1,
                                        border: `1px solid ${theme.palette.divider}`
                                    }}
                                >
                                    <Typography variant="subtitle1" fontWeight="bold" color={previewData.refundableAmount > 0 ? "success.main" : "text.secondary"}>
                                        Estimated Refund:
                                    </Typography>
                                    <Typography variant="subtitle1" fontWeight="bold" color={previewData.refundableAmount > 0 ? "success.main" : "text.secondary"}>
                                        {formatCurrency(previewData.refundableAmount, i18n.language, currencyConf)}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Paper>

                        <Typography variant="caption" color="text.secondary" textAlign="center">
                            This action will immediately end the subscription.
                            {previewData.refundableAmount > 0
                                ? " A refund will be created for the remaining balance."
                                : " No refund will be issued as the balance is consumed."}
                        </Typography>
                    </Stack>
                ) : null}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={handleClose} variant="outlined" color="inherit">
                    Keep Subscription
                </Button>
                <Button
                    onClick={() => onConfirm(subscription.id)}
                    variant="contained"
                    color="error"
                    disabled={isLoading || !!error}
                >
                    Confirm Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CancelSubscriptionModal;
