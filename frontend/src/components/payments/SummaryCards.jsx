import React from 'react';
import { Grid, Paper, Box, Typography, Stack, Chip, useTheme, alpha } from '@mui/material';
import { DollarSign, Banknote, CreditCard, Building, TrendingUp, TrendingDown } from 'lucide-react';

const SummaryCards = ({ stats, currencySymbol = '$' }) => {
    const theme = useTheme();

    // Helper for safe number formatting
    const fmt = (val) => val ? val.toFixed(2) : '0.00';

    const Card = ({ title, icon: Icon, color, data }) => (
        <Paper
            elevation={0}
            sx={{
                p: 2.5,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 3,
                height: '100%',
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(theme.palette[color].main, 0.05)} 100%)`,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[4],
                    borderColor: theme.palette[color].main
                }
            }}
        >
            <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                <Box
                    p={1}
                    borderRadius={2}
                    bgcolor={alpha(theme.palette[color].main, 0.1)}
                    color={`${color}.main`}
                >
                    <Icon size={20} />
                </Box>
                <Typography variant="caption" fontWeight="bold" sx={{ textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 1 }}>
                    {title}
                </Typography>
            </Stack>

            <Typography variant="h4" fontWeight="bold" gutterBottom>
                {currencySymbol}{fmt(data?.net)}
            </Typography>

            {/* Breakdown */}
            <Box mt={2} pt={2} borderTop={`1px solid ${theme.palette.divider}`}>
                <Stack direction="row" spacing={1} justifyContent="space-between">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <TrendingUp size={14} color={theme.palette.success.main} />
                        <Typography variant="caption" fontWeight="bold" color="success.main">
                            {currencySymbol}{fmt(data?.paid)}
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <TrendingDown size={14} color={theme.palette.error.main} />
                        <Typography variant="caption" fontWeight="bold" color="error.main">
                            {currencySymbol}{fmt(data?.refunded)}
                        </Typography>
                    </Stack>
                </Stack>
            </Box>
        </Paper>
    );

    return (
        <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6} lg={3}>
                <Card
                    title="Total Revenue"
                    icon={DollarSign}
                    color="success" // Emerald
                    data={stats?.total}
                />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
                <Card
                    title="Cash"
                    icon={Banknote}
                    color="info" // Blue/Cyan
                    data={stats?.cash}
                />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
                <Card
                    title="Card / Visa"
                    icon={CreditCard}
                    color="primary" // Blue
                    data={stats?.card}
                />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
                <Card
                    title="Transfer"
                    icon={Building}
                    color="warning" // Orange
                    data={stats?.transfer}
                />
            </Grid>
        </Grid>
    );
};

export default SummaryCards;
