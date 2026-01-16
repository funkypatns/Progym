import React from 'react';
import {
    Box,
    Card,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Grid,
    Chip
} from '@mui/material';
import { formatCurrency } from '../utils/numberFormatter';
import { ShoppingCart, TrendingUp, Package } from 'lucide-react';

const SalesProductReport = ({ data }) => {
    // Determine data source (handle different backend structures)
    const reportData = data?.rows || data?.report || [];
    const summary = data?.summary || { totalRevenue: 0, totalUnits: 0, uniqueProducts: 0 };

    return (
        <Box>
            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={4}>
                    <Card sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
                        <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'primary.50', color: 'primary.600' }}>
                            <TrendingUp size={24} />
                        </Box>
                        <Box>
                            <Typography variant="body2" color="text.secondary">Total Sales Revenue</Typography>
                            <Typography variant="h5" fontWeight="bold">
                                {formatCurrency(summary.totalRevenue)}
                            </Typography>
                        </Box>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                    <Card sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
                        <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'warning.50', color: 'warning.600' }}>
                            <ShoppingCart size={24} />
                        </Box>
                        <Box>
                            <Typography variant="body2" color="text.secondary">Units Sold</Typography>
                            <Typography variant="h5" fontWeight="bold">
                                {summary.totalUnits}
                            </Typography>
                        </Box>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                    <Card sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
                        <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'info.50', color: 'info.600' }}>
                            <Package size={24} />
                        </Box>
                        <Box>
                            <Typography variant="body2" color="text.secondary">Unique Products</Typography>
                            <Typography variant="h5" fontWeight="bold">
                                {summary.uniqueProducts}
                            </Typography>
                        </Box>
                    </Card>
                </Grid>
            </Grid>

            {/* Table */}
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
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
                        {reportData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                                    No detailed sales found for this period
                                </TableCell>
                            </TableRow>
                        ) : (
                            reportData.map((row, index) => (
                                <TableRow key={index} hover>
                                    <TableCell sx={{ color: 'text.secondary' }}>
                                        {new Date(row.date).toLocaleString()}
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: '600', color: 'text.primary' }}>{row.productName}</TableCell>
                                    <TableCell>
                                        <Chip label={row.sku || 'N/A'} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
                                    </TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{row.quantity}</TableCell>
                                    <TableCell align="right">{formatCurrency(row.unitPrice)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                        {formatCurrency(row.totalPrice)}
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'action.selected', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                                                {row.employeeName ? row.employeeName.charAt(0) : '?'}
                                            </Box>
                                            {row.employeeName}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default SalesProductReport;
