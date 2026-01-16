/**
 * ============================================
 * STANDARD REPORT PAGE - Premium Redesign
 * ============================================
 * 
 * Reusable page template for standard table-based reports.
 * Uses ReportsShell for consistent layout.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
    Box,
    Typography,
    Button,
    Grid,
    CircularProgress,
    Alert,
    TextField,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    useTheme,
    alpha,
    Skeleton
} from '@mui/material';
import { BarChart3, FileSpreadsheet, TrendingUp, TrendingDown, DollarSign, Users, Calendar, Loader2 } from 'lucide-react';
import apiClient from '../../utils/api';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../../utils/numberFormatter';
import { REPORTS_REGISTRY } from '../../config/reportsRegistry';
import ReportsShell from '../../components/ReportsShell';

// KPI Card Component
const KPICard = ({ label, value, icon: Icon, color = 'primary', isCurrency = false }) => {
    const theme = useTheme();
    const colorMap = {
        primary: theme.palette.primary.main,
        success: theme.palette.success.main,
        warning: theme.palette.warning.main,
        error: theme.palette.error.main,
        info: theme.palette.info.main
    };
    const cardColor = colorMap[color] || colorMap.primary;

    return (
        <Box sx={{
            p: 2.5,
            borderRadius: 3,
            bgcolor: alpha(cardColor, 0.08),
            border: `1px solid ${alpha(cardColor, 0.2)}`,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            minWidth: 0
        }}>
            <Box sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: alpha(cardColor, 0.15),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}>
                {Icon && <Icon size={24} color={cardColor} />}
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {label}
                </Typography>
                <Typography variant="h5" fontWeight={700} color={cardColor} noWrap>
                    {isCurrency ? formatCurrency(value) : (typeof value === 'number' ? value.toLocaleString() : value)}
                </Typography>
            </Box>
        </Box>
    );
};

const StandardReportPage = ({ type }) => {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const theme = useTheme();

    // Identify current report
    const pathId = location.pathname.split('/').pop();
    const config = REPORTS_REGISTRY.find(r => r.id === (type || pathId));

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reportData, setReportData] = useState(null);

    // Filters
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [paymentMethod, setPaymentMethod] = useState('');

    const reportTitle = i18n.language === 'ar' ? config?.titleAr : config?.titleEn;
    const reportDesc = i18n.language === 'ar' ? config?.descriptionAr : config?.descriptionEn;

    const fetchReport = async () => {
        if (!config?.endpoint) {
            setError('Report endpoint configuration missing');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            params.append('from', dateRange.startDate);
            params.append('to', dateRange.endDate);
            if (paymentMethod) params.append('method', paymentMethod);

            const response = await apiClient.get(`/reports${config.endpoint}?${params}`);
            setReportData(response.data);
        } catch (err) {
            console.error(`Failed to fetch report:`, err);
            setError(err.response?.data?.message || 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const exportExcel = async () => {
        if (!config?.endpoint) return;
        try {
            const params = new URLSearchParams();
            params.append('from', dateRange.startDate);
            params.append('to', dateRange.endDate);
            params.append('format', 'excel');

            const response = await apiClient.get(`/reports${config.endpoint}?${params}`, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${config.id}-report.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(i18n.language === 'ar' ? 'تم التصدير بنجاح' : 'Exported successfully');
        } catch (err) {
            toast.error(i18n.language === 'ar' ? 'فشل التصدير' : 'Export failed');
        }
    };

    useEffect(() => {
        if (config) fetchReport();
    }, [config?.id]);

    if (!config) return <Alert severity="error">Report not found</Alert>;

    // RENDER KPI CARDS
    const renderKPICards = () => {
        if (!reportData?.data?.summary) return null;
        const s = reportData.data.summary;

        const kpiItems = Object.entries(s)
            .filter(([key, value]) => key !== 'currency' && typeof value !== 'object')
            .slice(0, 6) // Max 6 KPIs
            .map(([key, value], idx) => {
                const isCurrency = key.toLowerCase().includes('total') ||
                    key.toLowerCase().includes('revenue') ||
                    key.toLowerCase().includes('amount') ||
                    key.toLowerCase().includes('paid') ||
                    key.toLowerCase().includes('refund');

                const colors = ['primary', 'success', 'info', 'warning', 'error', 'primary'];
                const icons = [DollarSign, TrendingUp, Users, Calendar, TrendingDown, DollarSign];

                return (
                    <Grid item xs={12} sm={6} md={4} lg={2} key={key}>
                        <KPICard
                            label={key.replace(/([A-Z])/g, ' $1').trim()}
                            value={value}
                            icon={icons[idx % icons.length]}
                            color={colors[idx % colors.length]}
                            isCurrency={isCurrency}
                        />
                    </Grid>
                );
            });

        return (
            <Grid container spacing={2}>
                {kpiItems}
            </Grid>
        );
    };

    // RENDER TABLE
    const renderTable = () => {
        const rows = reportData?.data?.rows || reportData?.data?.report || [];

        if (!loading && (!rows || rows.length === 0)) {
            return (
                <Box sx={{
                    py: 10,
                    textAlign: 'center',
                    color: 'text.secondary'
                }}>
                    <Calendar size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <Typography variant="h6" color="text.secondary">
                        {i18n.language === 'ar' ? 'لا توجد بيانات لهذه الفترة' : 'No data available for this period'}
                    </Typography>
                    <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                        {i18n.language === 'ar' ? 'حاول تغيير نطاق التاريخ' : 'Try adjusting the date range'}
                    </Typography>
                </Box>
            );
        }

        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        return (
            <TableContainer sx={{ maxHeight: '100%' }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            {columns.map(col => (
                                <TableCell
                                    key={col}
                                    sx={{
                                        fontWeight: 700,
                                        textTransform: 'capitalize',
                                        whiteSpace: 'nowrap',
                                        bgcolor: theme.palette.mode === 'dark'
                                            ? theme.palette.background.paper
                                            : '#f8fafc'
                                    }}
                                >
                                    {col.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row, idx) => (
                            <TableRow key={idx} hover>
                                {columns.map(col => (
                                    <TableCell key={col} sx={{ whiteSpace: 'nowrap' }}>
                                        {typeof row[col] === 'number' &&
                                            (col.toLowerCase().includes('amount') ||
                                                col.toLowerCase().includes('price') ||
                                                col.toLowerCase().includes('total'))
                                            ? formatCurrency(row[col])
                                            : (row[col] ?? '-')}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    // FILTERS NODE
    const filtersNode = (
        <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
                <TextField
                    label={i18n.language === 'ar' ? 'من' : 'From'}
                    type="date"
                    size="small"
                    fullWidth
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                />
            </Grid>
            <Grid item xs={12} sm={3}>
                <TextField
                    label={i18n.language === 'ar' ? 'إلى' : 'To'}
                    type="date"
                    size="small"
                    fullWidth
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                />
            </Grid>

            {(config.id === 'revenue' || config.id === 'subscriptions' || config.id === 'payments-summary') && (
                <Grid item xs={12} sm={2}>
                    <TextField
                        select
                        label={i18n.language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
                        size="small"
                        fullWidth
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                        <MenuItem value="">{i18n.language === 'ar' ? 'الكل' : 'All'}</MenuItem>
                        <MenuItem value="cash">{i18n.language === 'ar' ? 'نقدي' : 'Cash'}</MenuItem>
                        <MenuItem value="card">{i18n.language === 'ar' ? 'بطاقة' : 'Card'}</MenuItem>
                        <MenuItem value="transfer">{i18n.language === 'ar' ? 'تحويل' : 'Transfer'}</MenuItem>
                    </TextField>
                </Grid>
            )}

            <Grid item xs={12} sm="auto">
                <Button
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <BarChart3 size={16} />}
                    onClick={fetchReport}
                    disabled={loading}
                    sx={{ minWidth: 140 }}
                >
                    {i18n.language === 'ar' ? 'تحديث' : 'Generate'}
                </Button>
            </Grid>
        </Grid>
    );

    // ACTIONS NODE
    const actionsNode = (
        <Button
            variant="outlined"
            startIcon={<FileSpreadsheet size={16} />}
            onClick={exportExcel}
            disabled={loading || !reportData}
            size="small"
        >
            {i18n.language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
        </Button>
    );

    return (
        <ReportsShell
            title={reportTitle}
            subtitle={reportDesc}
            filters={filtersNode}
            actions={actionsNode}
            kpiCards={!loading && reportData ? renderKPICards() : null}
        >
            {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

            {loading ? (
                <Box sx={{ p: 4 }}>
                    <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
                    {[...Array(8)].map((_, i) => (
                        <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 0.5, borderRadius: 1 }} />
                    ))}
                </Box>
            ) : (
                renderTable()
            )}
        </ReportsShell>
    );
};

export default StandardReportPage;
