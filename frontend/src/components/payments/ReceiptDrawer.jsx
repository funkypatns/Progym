import React from 'react';
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    Stack,
    Divider,
    Avatar,
    Button,
    useTheme,
    alpha,
    Chip,
    Grid,
    Paper
} from '@mui/material';
import {
    X,
    Printer,
    ArrowRightLeft,
    User,
    CreditCard,
    Banknote,
    Building
} from 'lucide-react';

const ReceiptDrawer = ({ payment, onClose, onRefund, onDownload, currencySymbol = '$' }) => {
    const theme = useTheme();

    if (!payment) return null;

    const totalRefunded = payment.refunds?.reduce((sum, r) => sum + r.amount, 0) || 0;
    const remaining = payment.amount - totalRefunded;
    const isFullyRefunded = remaining <= 0;

    const getMethodIcon = (method) => {
        switch (method) {
            case 'cash': return <Banknote size={16} />;
            case 'card': return <CreditCard size={16} />;
            case 'transfer': return <Building size={16} />;
            default: return <CreditCard size={16} />;
        }
    };

    return (
        <Drawer
            anchor="right"
            open={!!payment}
            onClose={onClose}
            PaperProps={{
                sx: { width: '100%', maxWidth: 450, bgcolor: 'background.default' }
            }}
        >
            {/* Header */}
            <Box p={3} borderBottom={`1px solid ${theme.palette.divider}`} display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                    <Typography variant="h6" fontWeight="bold">Receipt Details</Typography>
                    <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                        {payment.receiptNumber}
                    </Typography>
                </Box>
                <IconButton onClick={onClose} edge="end">
                    <X size={24} />
                </IconButton>
            </Box>

            {/* Content */}
            <Box flex={1} overflow="auto" p={3}>
                <Stack spacing={4}>
                    {/* Member Info */}
                    <Paper
                        variant="outlined"
                        sx={{
                            p: 2,
                            bgcolor: alpha(theme.palette.background.paper, 0.5),
                            borderRadius: 3
                        }}
                    >
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Avatar sx={{ bgcolor: 'action.selected', color: 'text.primary', fontWeight: 'bold' }}>
                                {payment.member.firstName[0]}
                            </Avatar>
                            <Box>
                                <Typography variant="subtitle1" fontWeight="bold">
                                    {payment.member.firstName} {payment.member.lastName}
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
                                    <User size={12} />
                                    <Typography variant="caption" fontFamily="monospace">
                                        #{payment.member.memberId}
                                    </Typography>
                                    {payment.member.phone && (
                                        <>
                                            <Typography variant="caption">•</Typography>
                                            <Typography variant="caption">{payment.member.phone}</Typography>
                                        </>
                                    )}
                                </Stack>
                            </Box>
                        </Stack>
                    </Paper>

                    {/* Transaction Details */}
                    <Box>
                        <Typography variant="subtitle2" textTransform="uppercase" color="text.secondary" gutterBottom>
                            Transaction
                        </Typography>
                        <Stack spacing={2} divider={<Divider />}>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">Date</Typography>
                                <Typography variant="body2" fontFamily="monospace">
                                    {new Date(payment.paidAt).toLocaleString()}
                                </Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">Paid By</Typography>
                                <Typography variant="body2">
                                    {payment.collectorName || 'System'}
                                </Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" color="text.secondary">Method</Typography>
                                <Chip
                                    icon={getMethodIcon(payment.method)}
                                    label={payment.method}
                                    size="small"
                                    sx={{ textTransform: 'capitalize' }}
                                />
                            </Box>
                            {payment.subscription && (
                                <Box display="flex" justifyContent="space-between">
                                    <Typography variant="body2" color="text.secondary">Plan</Typography>
                                    <Typography variant="body2" color="primary.main" fontWeight="medium">
                                        {payment.subscription.plan.name}
                                    </Typography>
                                </Box>
                            )}
                        </Stack>
                    </Box>

                    {/* Visit Stats */}
                    <Box>
                        <Typography variant="subtitle2" textTransform="uppercase" color="text.secondary" gutterBottom>
                            Visit Stats
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Paper variant="outlined" sx={{ p: 2, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                                    <Typography variant="caption" color="text.secondary" display="block">During Plan</Typography>
                                    <Typography variant="h6" fontWeight="bold">{payment.stats?.subVisits || 0}</Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={6}>
                                <Paper variant="outlined" sx={{ p: 2, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                                    <Typography variant="caption" color="text.secondary" display="block">All Time</Typography>
                                    <Typography variant="h6" fontWeight="bold" color="text.secondary">
                                        {payment.stats?.allTimeVisits || 0}
                                    </Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Box>

                    {/* Financial Summary */}
                    <Box>
                        <Typography variant="subtitle2" textTransform="uppercase" color="text.secondary" gutterBottom>
                            Financials
                        </Typography>
                        <Paper sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper' }} elevation={0} variant="outlined">
                            <Stack spacing={2}>
                                <Box display="flex" justifyContent="space-between">
                                    <Typography variant="body2" color="text.secondary">Original Paid</Typography>
                                    <Typography variant="body2" fontWeight="bold" color="success.main">
                                        {currencySymbol}{(payment.amount || 0).toFixed(2)}
                                    </Typography>
                                </Box>
                                {payment.refundedTotal > 0 && (
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Total Refunded</Typography>
                                        <Typography variant="body2" fontWeight="bold" color="error.main">
                                            -{currencySymbol}{(payment.refundedTotal || 0).toFixed(2)}
                                        </Typography>
                                    </Box>
                                )}
                                <Divider />
                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Typography variant="subtitle2">Net Total</Typography>
                                    <Typography variant="h6" fontWeight="bold">
                                        {currencySymbol}{Math.max(0, (payment.remainingRefundable !== undefined ? payment.remainingRefundable : remaining)).toFixed(2)}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Paper>
                    </Box>

                    {/* Refund History - If existing */}
                    {payment.refunds && payment.refunds.length > 0 && (
                        <Box>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography variant="subtitle2" textTransform="uppercase" color="text.secondary">
                                    Refund History
                                </Typography>
                                <Typography variant="caption" fontFamily="monospace">
                                    ({payment.refunds.length} events)
                                </Typography>
                            </Stack>

                            <Stack spacing={2}>
                                {payment.refunds.map(refund => (
                                    <Paper
                                        key={refund.id}
                                        variant="outlined"
                                        sx={{
                                            p: 2,
                                            bgcolor: alpha(theme.palette.error.main, 0.05),
                                            borderColor: alpha(theme.palette.error.main, 0.1)
                                        }}
                                    >
                                        <Box display="flex" justifyContent="space-between" mb={1}>
                                            <Box>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {refund.user?.firstName || 'Admin'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(refund.createdAt).toLocaleString()}
                                                </Typography>
                                            </Box>
                                            <Typography variant="body2" fontWeight="bold" color="error.main">
                                                -{currencySymbol}{refund.amount.toFixed(2)}
                                            </Typography>
                                        </Box>
                                        {refund.reason && (
                                            <Typography variant="caption" fontStyle="italic" color="text.secondary">
                                                "{refund.reason}"
                                            </Typography>
                                        )}
                                        <Button
                                            size="small"
                                            startIcon={<Printer size={14} />}
                                            onClick={() => onDownload(payment.id, refund.id)}
                                            sx={{ mt: 1, ml: -1 }}
                                            color="inherit"
                                        >
                                            Print Receipt
                                        </Button>
                                    </Paper>
                                ))}
                            </Stack>
                        </Box>
                    )}
                </Stack>
            </Box>

            {/* Footer */}
            <Paper
                elevation={3}
                sx={{
                    p: 2,
                    borderTop: `1px solid ${theme.palette.divider}`,
                    borderRadius: 0
                }}
            >
                <Stack spacing={2}>
                    <Button
                        variant="outlined"
                        fullWidth
                        startIcon={<Printer />}
                        onClick={() => onDownload(payment.id)}
                    >
                        Print Payment Receipt
                    </Button>

                    {!isFullyRefunded && onRefund && (
                        <Button
                            variant="contained"
                            color="error"
                            fullWidth
                            startIcon={<ArrowRightLeft />}
                            onClick={() => onRefund(payment)}
                        >
                            Process Refund
                        </Button>
                    )}
                </Stack>
            </Paper>
        </Drawer>
    );
};

export default ReceiptDrawer;
