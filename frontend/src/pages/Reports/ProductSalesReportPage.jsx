import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Paper,
    Typography,
    Button,
    TextField,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    CircularProgress,
    Alert,
    useTheme
} from '@mui/material';
import { FileSpreadsheet, RefreshCw, Download, ShoppingCart, TrendingUp, Package } from 'lucide-react';
import apiClient from '../../utils/api';
import { formatCurrency } from '../../utils/numberFormatter';
import { toast } from 'react-hot-toast';
import ReportsShell from '../../components/ReportsShell';

const ProductSalesReportPage = () => {
    const { t, i18n } = useTranslation();
    const theme = useTheme();

    // State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [dateRange, setDateRange] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [search, setSearch] = useState('');

    // Fetch report data
    const fetchReport = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (dateRange.startDate) params.append('from', dateRange.startDate);
            if (dateRange.endDate) params.append('to', dateRange.endDate);
            if (search) params.append('search', search);

            const response = await apiClient.get(`/reports/sales/detailed?${params}`);
            setReportData(response.data.data);
        } catch (err) {
            console.error('Failed to fetch product sales report:', err);
            setError(err.response?.data?.message || 'Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    // Export to Excel
    const exportToExcel = async () => {
        try {
            const params = new URLSearchParams();
            params.append('format', 'excel');
            if (dateRange.startDate) params.append('from', dateRange.startDate);
            if (dateRange.endDate) params.append('to', dateRange.endDate);
            if (search) params.append('search', search);

            const response = await apiClient.get(`/reports/sales/detailed?${params}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `product-sales-${dateRange.startDate}-${dateRange.endDate}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('Report exported successfully');
        } catch (err) {
            toast.error('Failed to export report');
        }
    };

    // Auto-fetch on mount with today's date
    useEffect(() => {
        fetchReport();
    }, []);

    const rows = reportData?.rows || [];
    const summary = reportData?.summary || { totalRevenue: 0, totalUnits: 0, uniqueProducts: 0 };

    const filtersNode = (
        <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={3}>
                <TextField
                    label="Start Date"
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
                    label="End Date"
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
                    label="Search (Product/SKU)"
                    size="small"
                    fullWidth
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                />
            </Grid>
            <Grid item xs={12} sm={3}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="contained"
                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshCw size={16} />}
                        onClick={fetchReport}
                        disabled={loading}
                        fullWidth
                    >
                        Generate
                    </Button>
                </Box>
            </Grid>
        </Grid>
    );

    const actionsNode = (
        <Button
            variant="outlined"
            startIcon={<Download size={16} />}
            onClick={exportToExcel}
            disabled={loading || rows.length === 0}
            size="small"
        >
            Export
        </Button>
    );

    return (
        <ReportsShell
            title={i18n.language === 'ar' ? 'مبيعات المنتجات' : 'Product Sales Report'}
            subtitle="Detailed breakdown of all product sales with line items"
            filters={filtersNode}
            actions={actionsNode}
            disableContentPaper={true}
        >
            {/* Error State */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 3,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            borderRadius: 3,
                            border: `1px solid ${theme.palette.divider}`
                        }}
                    >
                        <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'primary.100', color: 'primary.600' }}>
                            <TrendingUp size={24} />
                        </Box>
                        <Box>
                            <Typography variant="body2" color="text.secondary">Total Revenue</Typography>
                            <Typography variant="h5" fontWeight="bold">
                                {formatCurrency(summary.totalRevenue)}
                            </Typography>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 3,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            borderRadius: 3,
                            border: `1px solid ${theme.palette.divider}`
                        }}
                    >
                        <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'warning.100', color: 'warning.600' }}>
                            <ShoppingCart size={24} />
                        </Box>
                        <Box>
                            <Typography variant="body2" color="text.secondary">Units Sold</Typography>
                            <Typography variant="h5" fontWeight="bold">
                                {summary.totalUnits}
                            </Typography>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 3,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            borderRadius: 3,
                            border: `1px solid ${theme.palette.divider}`
                        }}
                    >
                        <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'info.100', color: 'info.600' }}>
                            <Package size={24} />
                        </Box>
                        <Box>
                            <Typography variant="body2" color="text.secondary">Unique Products</Typography>
                            <Typography variant="h5" fontWeight="bold">
                                {summary.uniqueProducts}
                            </Typography>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Data Table */}
            <Paper
                elevation={0}
                sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: `1px solid ${theme.palette.divider}`
                }}
            >
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                                <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>SKU</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Qty</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Price</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Sold By</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={32} />
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                            Loading report...
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                                        <FileSpreadsheet size={48} style={{ opacity: 0.3, marginBottom: 8 }} />
                                        <Typography>No sales found for this period</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row, index) => (
                                    <TableRow key={row.id || index} hover>
                                        <TableCell sx={{ color: 'text.secondary' }}>
                                            {new Date(row.date).toLocaleString()}
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: '600' }}>{row.productName}</TableCell>
                                        <TableCell>
                                            <Chip label={row.sku || 'N/A'} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
                                        </TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>{row.quantity}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.unitPrice)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                            {formatCurrency(row.total)}
                                        </TableCell>
                                        <TableCell>{row.soldBy || '-'}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </ReportsShell>
    );
};

export default ProductSalesReportPage;
