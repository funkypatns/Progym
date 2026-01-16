import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box, Typography, Button, Grid,
    TextField, MenuItem, CircularProgress,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper,
    useTheme
} from '@mui/material';
import { BarChart3, FileSpreadsheet } from 'lucide-react';
import apiClient from '../../utils/api';
import { formatCurrency, formatNumber } from '../../utils/numberFormatter';
import { useSettingsStore } from '../../store';
import ReportsShell from '../../components/ReportsShell';

const EmployeeCollectionsPage = () => {
    const { t, i18n } = useTranslation();
    const { getSetting } = useSettingsStore();
    const theme = useTheme();

    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [dateRange, setDateRange] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');

    const currencyConf = {
        code: getSetting('currency_code', 'USD'),
        symbol: getSetting('currency_symbol', '$')
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await apiClient.get('/users/list');
            setEmployees(res.data.data);
        } catch (e) {
            console.error("Failed to fetch employees");
        }
    };

    const fetchReport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('type', 'employeeCollections');
            params.append('startDate', dateRange.startDate);
            params.append('endDate', dateRange.endDate);
            if (selectedEmployee) params.append('employeeId', selectedEmployee);
            if (paymentMethod) params.append('method', paymentMethod);

            const response = await apiClient.get(`/reports/employee-collections?${params}`);
            setReportData(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Aggregate Data
    const aggregatedData = useMemo(() => {
        if (!reportData || !Array.isArray(reportData.report)) return [];
        return reportData.report;
    }, [reportData]);

    const filtersNode = (
        <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={3}>
                <TextField
                    label={t('reports.from')}
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
                    label={t('reports.to')}
                    type="date"
                    size="small"
                    fullWidth
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                />
            </Grid>
            <Grid item xs={12} sm={3}>
                <TextField
                    select
                    label="الموظف"
                    size="small"
                    fullWidth
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                >
                    <MenuItem value="">{t('common.all')}</MenuItem>
                    {employees.map(emp => (
                        <MenuItem key={emp.id} value={emp.id}>
                            {emp.firstName} {emp.lastName}
                        </MenuItem>
                    ))}
                </TextField>
            </Grid>
            <Grid item xs={12} sm={3}>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={fetchReport}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <BarChart3 size={16} />}
                >
                    {t('reports.generate')}
                </Button>
            </Grid>
        </Grid>
    );

    return (
        <ReportsShell
            title="تحصيل الموظفين"
            subtitle="ملخص تحصيل الموظفين في الفترة المحددة"
            filters={filtersNode}
        >
            {reportData && (
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                                <TableCell>الموظف</TableCell>
                                <TableCell align="center">عدد العمليات</TableCell>
                                <TableCell align="right">نقدي</TableCell>
                                <TableCell align="right">بطاقة/غير نقدي</TableCell>
                                <TableCell align="right">الإجمالي</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {aggregatedData.map((row, index) => (
                                <TableRow key={index} hover>
                                    <TableCell sx={{ fontWeight: 'bold' }}>{row.name}</TableCell>
                                    <TableCell align="center">{formatNumber(row.count, i18n.language)}</TableCell>
                                    <TableCell align="right" sx={{ color: 'success.main', fontFamily: 'monospace' }}>
                                        {formatCurrency(row.cash, i18n.language, currencyConf)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: 'info.main', fontFamily: 'monospace' }}>
                                        {formatCurrency(row.nonCash, i18n.language, currencyConf)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: '900', fontFamily: 'monospace' }}>
                                        {formatCurrency(row.total, i18n.language, currencyConf)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {aggregatedData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                        لا توجد بيانات تحصيل في هذه الفترة
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </ReportsShell>
    );
};

export default EmployeeCollectionsPage;
