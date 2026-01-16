/**
 * ============================================
 * REPORTS SHELL - Premium Template
 * ============================================
 * 
 * Unified layout for all report detail pages:
 * - Full viewport height
 * - Header with title/actions
 * - Filter bar
 * - Content area (KPI cards, charts, tables)
 * - Internal scrolling only
 */

import React from 'react';
import { Box, Paper, Typography, Breadcrumbs, useTheme, alpha } from '@mui/material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Home, BarChart3 } from 'lucide-react';

const ReportsShell = ({
    title,
    subtitle,
    children,
    actions,
    filters,
    kpiCards,
    chart,
    maxWidth = 'full'
}) => {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const isRtl = i18n.dir() === 'rtl';

    return (
        <Box sx={{
            height: 'calc(100vh - 140px)',
            display: 'flex',
            flexDirection: 'column',
            direction: isRtl ? 'rtl' : 'ltr',
            px: { xs: 2, md: 3 },
            pb: 2
        }}>
            {/* Header Section - Fixed */}
            <Box sx={{ flexShrink: 0, mb: 3 }}>
                {/* Breadcrumbs */}
                <Breadcrumbs
                    separator={
                        <ChevronRight
                            size={14}
                            style={{
                                transform: isRtl ? 'rotate(180deg)' : 'none',
                                opacity: 0.5
                            }}
                        />
                    }
                    aria-label="breadcrumb"
                    sx={{ mb: 2 }}
                >
                    <Link
                        to="/reports"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: theme.palette.text.secondary,
                            textDecoration: 'none',
                            fontSize: '0.8rem',
                            fontWeight: 500
                        }}
                    >
                        <Home size={14} />
                        {t('nav.reports')}
                    </Link>
                    <Typography
                        color="text.primary"
                        fontSize="0.8rem"
                        fontWeight={600}
                    >
                        {title}
                    </Typography>
                </Breadcrumbs>

                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', md: 'center' },
                    gap: 2
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <BarChart3 size={24} color={theme.palette.primary.main} />
                        </Box>
                        <Box>
                            <Typography
                                variant="h5"
                                component="h1"
                                fontWeight={800}
                                sx={{
                                    color: theme.palette.text.primary,
                                    letterSpacing: '-0.02em'
                                }}
                            >
                                {title}
                            </Typography>
                            {subtitle && (
                                <Typography variant="body2" color="text.secondary">
                                    {subtitle}
                                </Typography>
                            )}
                        </Box>
                    </Box>

                    {actions && (
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                            {actions}
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Filters Section - Fixed */}
            {filters && (
                <Paper
                    elevation={0}
                    sx={{
                        p: 2.5,
                        mb: 3,
                        flexShrink: 0,
                        borderRadius: 3,
                        bgcolor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                    }}
                >
                    {filters}
                </Paper>
            )}

            {/* KPI Cards Row - Fixed */}
            {kpiCards && (
                <Box sx={{ mb: 3, flexShrink: 0 }}>
                    {kpiCards}
                </Box>
            )}

            {/* Chart Area - Fixed Height if provided */}
            {chart && (
                <Paper
                    elevation={0}
                    sx={{
                        p: 3,
                        mb: 3,
                        flexShrink: 0,
                        borderRadius: 3,
                        bgcolor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        minHeight: 280
                    }}
                >
                    {chart}
                </Paper>
            )}

            {/* Main Content - Scrollable with proper table overflow */}
            <Paper
                elevation={0}
                sx={{
                    flex: 1,
                    minHeight: 0,
                    borderRadius: 3,
                    bgcolor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <Box sx={{
                    flex: 1,
                    overflow: 'auto',
                    // Table container styles for horizontal scroll
                    '& .MuiTableContainer-root': {
                        maxHeight: '100%',
                        overflowX: 'auto',
                        // Safe inline-end padding so last column is not clipped
                        paddingInlineEnd: 2,
                        paddingBlockEnd: 1
                    },
                    // Sticky header
                    '& .MuiTableHead-root': {
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        bgcolor: theme.palette.mode === 'dark'
                            ? theme.palette.background.paper
                            : '#f8fafc'
                    },
                    // Consistent cell padding and nowrap for numeric values
                    '& .MuiTableCell-root': {
                        paddingBlock: 1.5, // 12px vertical
                        paddingInline: 2,  // 16px horizontal
                        whiteSpace: 'nowrap'
                    },
                    '& .MuiTableCell-head': {
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    },
                    // Ensure table minimum width prevents column compression
                    '& .MuiTable-root': {
                        minWidth: 600
                    }
                }}>
                    {children}
                </Box>
            </Paper>
        </Box>
    );
};

export default ReportsShell;
