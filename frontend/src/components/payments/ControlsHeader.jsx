import React from 'react';
import {
    Paper,
    Stack,
    TextField,
    InputAdornment,
    Button,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    IconButton,
    Box,
    Divider,
    useTheme,
    alpha
} from '@mui/material';
import {
    Search,
    Plus,
    X,
    Filter,
    CreditCard,
    Banknote,
    Building,
    RotateCcw,
    ArrowRightLeft
} from 'lucide-react';

const ControlsHeader = ({
    scope,
    onScopeChange,
    searchQuery,
    onSearchChange,
    onSearchSubmit,
    onClear,
    onAddPayment,
    isAdmin,
    canCreate,
    methodFilter,
    onMethodFilterChange,
    refundFilter,
    onRefundFilterChange,
    t
}) => {
    const theme = useTheme();

    const handleMethodChange = (event, newMethod) => {
        if (newMethod !== null) {
            onMethodFilterChange(newMethod);
        }
    };

    const handleRefundChange = (event, newStatus) => {
        if (newStatus !== null) {
            onRefundFilterChange(newStatus);
        }
    };

    const handleScopeChange = (event, newScope) => {
        if (newScope !== null) {
            onScopeChange(newScope);
        }
    };

    return (
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
            {/* Row 1: Main Controls */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" mb={2}>

                {/* 1. Scope Control (Admin Only) */}
                {isAdmin ? (
                    <ToggleButtonGroup
                        value={scope}
                        exclusive
                        onChange={handleScopeChange}
                        size="small"
                        sx={{ height: 40 }}
                    >
                        <ToggleButton value="currentShift">Current Shift</ToggleButton>
                        <ToggleButton value="all">All Shifts</ToggleButton>
                    </ToggleButtonGroup>
                ) : (
                    <Box
                        px={1.5} py={0.5}
                        borderRadius={1}
                        bgcolor={alpha(theme.palette.background.default, 0.5)}
                        border={`1px solid ${theme.palette.divider}`}
                    >
                        <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                            Current Shift Only
                        </Typography>
                    </Box>
                )}

                {/* 2. Search Bar */}
                <TextField
                    fullWidth
                    placeholder="Search Receipt (RCP-...) or Member"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search size={20} className="text-gray-400" />
                            </InputAdornment>
                        ),
                        endAdornment: searchQuery && (
                            <InputAdornment position="end">
                                <IconButton size="small" onClick={onClear}>
                                    <X size={16} />
                                </IconButton>
                            </InputAdornment>
                        )
                    }}
                    size="small"
                />

                {/* 3. Actions */}
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="outlined"
                        onClick={onSearchSubmit}
                        disabled={!searchQuery.trim()}
                    >
                        Search
                    </Button>

                    {canCreate && (
                        <Button
                            variant="contained"
                            startIcon={<Plus size={18} />}
                            onClick={onAddPayment}
                            sx={{ minWidth: 160 }}
                        >
                            {t('payments.recordPayment')}
                        </Button>
                    )}
                </Stack>
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* Row 2: Filters */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
                <Stack direction="row" spacing={1} alignItems="center">
                    <Filter size={14} className="text-gray-500" />
                    <Typography variant="caption" fontWeight="bold" textTransform="uppercase" color="text.secondary">
                        Filters
                    </Typography>
                </Stack>

                {/* Method Filter */}
                <ToggleButtonGroup
                    value={methodFilter}
                    exclusive
                    onChange={handleMethodChange}
                    size="small"
                    sx={{ height: 32 }}
                >
                    <ToggleButton value="all">All</ToggleButton>
                    <ToggleButton value="cash">
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <Banknote size={14} />
                            <span>Cash</span>
                        </Stack>
                    </ToggleButton>
                    <ToggleButton value="card">
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <CreditCard size={14} />
                            <span>Card</span>
                        </Stack>
                    </ToggleButton>
                    <ToggleButton value="transfer">
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <ArrowRightLeft size={14} />
                            <span>Transfer</span>
                        </Stack>
                    </ToggleButton>
                </ToggleButtonGroup>

                {/* Refund Filter */}
                <ToggleButtonGroup
                    value={refundFilter}
                    exclusive
                    onChange={handleRefundChange}
                    size="small"
                    sx={{ height: 32 }}
                >
                    <ToggleButton value="all">All Payments</ToggleButton>
                    <ToggleButton value="refunded">Refunded Only</ToggleButton>
                    <ToggleButton value="not_refunded">Not Refunded</ToggleButton>
                </ToggleButtonGroup>

                {/* Reset */}
                {(methodFilter !== 'all' || refundFilter !== 'all') && (
                    <Button
                        size="small"
                        startIcon={<RotateCcw size={14} />}
                        onClick={() => {
                            onMethodFilterChange('all');
                            onRefundFilterChange('all');
                        }}
                        sx={{ textTransform: 'none' }}
                    >
                        Reset
                    </Button>
                )}
            </Stack>
        </Paper>
    );
};

export default ControlsHeader;
