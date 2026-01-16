/**
 * ============================================
 * UNIFIED THEME SYSTEM
 * ============================================
 * Premium SaaS-grade design tokens for MUI
 * Supports Light/Dark mode + RTL
 */

import { createTheme, alpha } from '@mui/material/styles';

// ============================================
// COLOR PALETTES
// ============================================

const lightPalette = {
    mode: 'light',
    primary: {
        main: '#2563eb',
        light: '#3b82f6',
        dark: '#1d4ed8',
        contrastText: '#ffffff',
    },
    secondary: {
        main: '#7c3aed',
        light: '#8b5cf6',
        dark: '#6d28d9',
        contrastText: '#ffffff',
    },
    success: {
        main: '#10b981',
        light: '#34d399',
        dark: '#059669',
        contrastText: '#ffffff',
    },
    warning: {
        main: '#f59e0b',
        light: '#fbbf24',
        dark: '#d97706',
        contrastText: '#000000',
    },
    error: {
        main: '#ef4444',
        light: '#f87171',
        dark: '#dc2626',
        contrastText: '#ffffff',
    },
    info: {
        main: '#0ea5e9',
        light: '#38bdf8',
        dark: '#0284c7',
        contrastText: '#ffffff',
    },
    background: {
        default: '#f8fafc',
        paper: '#ffffff',
        subtle: '#f1f5f9',
    },
    text: {
        primary: '#0f172a',
        secondary: '#475569',
        disabled: '#94a3b8',
    },
    divider: '#e2e8f0',
    action: {
        hover: 'rgba(0, 0, 0, 0.04)',
        selected: 'rgba(37, 99, 235, 0.08)',
        focus: 'rgba(37, 99, 235, 0.12)',
    },
};

const darkPalette = {
    mode: 'dark',
    primary: {
        main: '#3b82f6',
        light: '#60a5fa',
        dark: '#2563eb',
        contrastText: '#ffffff',
    },
    secondary: {
        main: '#8b5cf6',
        light: '#a78bfa',
        dark: '#7c3aed',
        contrastText: '#ffffff',
    },
    success: {
        main: '#22c55e',
        light: '#4ade80',
        dark: '#16a34a',
        contrastText: '#000000',
    },
    warning: {
        main: '#fbbf24',
        light: '#fcd34d',
        dark: '#f59e0b',
        contrastText: '#000000',
    },
    error: {
        main: '#f87171',
        light: '#fca5a5',
        dark: '#ef4444',
        contrastText: '#000000',
    },
    info: {
        main: '#38bdf8',
        light: '#7dd3fc',
        dark: '#0ea5e9',
        contrastText: '#000000',
    },
    background: {
        default: '#0f172a',
        paper: '#1e293b',
        subtle: '#334155',
    },
    text: {
        primary: '#f1f5f9',
        secondary: '#94a3b8',
        disabled: '#64748b',
    },
    divider: 'rgba(148, 163, 184, 0.12)',
    action: {
        hover: 'rgba(255, 255, 255, 0.05)',
        selected: 'rgba(59, 130, 246, 0.16)',
        focus: 'rgba(59, 130, 246, 0.24)',
    },
};

// ============================================
// TYPOGRAPHY
// ============================================

const typography = {
    fontFamily: '"Inter", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h1: {
        fontSize: '2.5rem',
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
    },
    h2: {
        fontSize: '2rem',
        fontWeight: 700,
        lineHeight: 1.25,
        letterSpacing: '-0.01em',
    },
    h3: {
        fontSize: '1.75rem',
        fontWeight: 600,
        lineHeight: 1.3,
    },
    h4: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.35,
    },
    h5: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.4,
    },
    h6: {
        fontSize: '1rem',
        fontWeight: 600,
        lineHeight: 1.5,
    },
    subtitle1: {
        fontSize: '1rem',
        fontWeight: 500,
        lineHeight: 1.5,
    },
    subtitle2: {
        fontSize: '0.875rem',
        fontWeight: 500,
        lineHeight: 1.5,
    },
    body1: {
        fontSize: '1rem',
        fontWeight: 400,
        lineHeight: 1.6,
    },
    body2: {
        fontSize: '0.875rem',
        fontWeight: 400,
        lineHeight: 1.6,
    },
    button: {
        fontSize: '0.875rem',
        fontWeight: 600,
        textTransform: 'none',
        letterSpacing: '0.01em',
    },
    caption: {
        fontSize: '0.75rem',
        fontWeight: 400,
        lineHeight: 1.5,
    },
    overline: {
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
    },
};

// ============================================
// SHAPE & SHADOWS
// ============================================

const shape = {
    borderRadius: 12,
};

const shadows = [
    'none',
    '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    ...Array(18).fill('0 25px 50px -12px rgba(0, 0, 0, 0.25)'),
];

// ============================================
// COMPONENT OVERRIDES
// ============================================

const getComponentOverrides = (palette) => ({
    MuiCssBaseline: {
        styleOverrides: {
            '*': {
                boxSizing: 'border-box',
            },
            html: {
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
            },
            body: {
                backgroundColor: palette.background.default,
                color: palette.text.primary,
            },
            // Unified scrollbar styling
            '::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
            },
            '::-webkit-scrollbar-track': {
                background: 'transparent',
            },
            '::-webkit-scrollbar-thumb': {
                background: palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                borderRadius: '4px',
                '&:hover': {
                    background: palette.mode === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
                },
            },
        },
    },
    MuiButton: {
        styleOverrides: {
            root: {
                borderRadius: 10,
                padding: '10px 20px',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': {
                    boxShadow: 'none',
                },
                '&:focus-visible': {
                    outline: `2px solid ${palette.primary.main}`,
                    outlineOffset: '2px',
                },
            },
            contained: {
                '&:hover': {
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                },
            },
            containedPrimary: {
                background: `linear-gradient(135deg, ${palette.primary.main} 0%, ${palette.primary.dark} 100%)`,
                '&:hover': {
                    background: `linear-gradient(135deg, ${palette.primary.light} 0%, ${palette.primary.main} 100%)`,
                },
            },
            outlined: {
                borderWidth: '1.5px',
                '&:hover': {
                    borderWidth: '1.5px',
                    backgroundColor: alpha(palette.primary.main, 0.04),
                },
            },
            sizeSmall: {
                padding: '6px 14px',
                fontSize: '0.8125rem',
            },
            sizeLarge: {
                padding: '14px 28px',
                fontSize: '1rem',
            },
        },
        defaultProps: {
            disableElevation: true,
        },
    },
    MuiIconButton: {
        styleOverrides: {
            root: {
                borderRadius: 10,
                '&:focus-visible': {
                    outline: `2px solid ${palette.primary.main}`,
                    outlineOffset: '2px',
                },
            },
        },
    },
    MuiTextField: {
        defaultProps: {
            variant: 'outlined',
            size: 'small',
        },
    },
    MuiOutlinedInput: {
        styleOverrides: {
            root: {
                borderRadius: 10,
                backgroundColor: palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                },
                '&.Mui-focused': {
                    backgroundColor: 'transparent',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: palette.primary.main,
                    borderWidth: '2px',
                    boxShadow: `0 0 0 3px ${alpha(palette.primary.main, 0.1)}`,
                },
            },
            notchedOutline: {
                borderColor: palette.divider,
                transition: 'all 0.2s ease',
            },
            input: {
                '&::placeholder': {
                    color: palette.text.secondary,
                    opacity: 0.7,
                },
            },
        },
    },
    MuiInputLabel: {
        styleOverrides: {
            root: {
                color: palette.text.secondary,
                '&.Mui-focused': {
                    color: palette.primary.main,
                },
            },
        },
    },
    MuiPaper: {
        styleOverrides: {
            root: {
                backgroundImage: 'none',
                borderRadius: 16,
            },
            elevation1: {
                boxShadow: palette.mode === 'dark'
                    ? '0 4px 20px rgba(0, 0, 0, 0.4)'
                    : '0 4px 20px rgba(0, 0, 0, 0.08)',
            },
        },
        defaultProps: {
            elevation: 0,
        },
    },
    MuiCard: {
        styleOverrides: {
            root: {
                borderRadius: 16,
                border: `1px solid ${palette.divider}`,
                backgroundImage: 'none',
                boxShadow: palette.mode === 'dark'
                    ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                    : '0 4px 20px rgba(0, 0, 0, 0.05)',
            },
        },
    },
    MuiTableContainer: {
        styleOverrides: {
            root: {
                borderRadius: 12,
                border: `1px solid ${palette.divider}`,
            },
        },
    },
    MuiTableCell: {
        styleOverrides: {
            root: {
                borderBottom: `1px solid ${palette.divider}`,
                padding: '14px 16px',
            },
            head: {
                fontWeight: 600,
                backgroundColor: palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                color: palette.text.secondary,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
            },
        },
    },
    MuiTableRow: {
        styleOverrides: {
            root: {
                '&:hover': {
                    backgroundColor: palette.action.hover,
                },
                '&:last-child td': {
                    borderBottom: 0,
                },
            },
        },
    },
    MuiChip: {
        styleOverrides: {
            root: {
                borderRadius: 8,
                fontWeight: 500,
            },
            filled: {
                backgroundColor: palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            },
        },
    },
    MuiDialog: {
        styleOverrides: {
            paper: {
                borderRadius: 20,
                backgroundImage: 'none',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            },
        },
    },
    MuiDialogTitle: {
        styleOverrides: {
            root: {
                fontSize: '1.25rem',
                fontWeight: 600,
                padding: '20px 24px',
            },
        },
    },
    MuiDialogContent: {
        styleOverrides: {
            root: {
                padding: '16px 24px',
            },
        },
    },
    MuiDialogActions: {
        styleOverrides: {
            root: {
                padding: '16px 24px 20px',
                gap: '12px',
            },
        },
    },
    MuiToggleButton: {
        styleOverrides: {
            root: {
                borderRadius: 10,
                textTransform: 'none',
                fontWeight: 500,
                '&.Mui-selected': {
                    backgroundColor: palette.primary.main,
                    color: palette.primary.contrastText,
                    '&:hover': {
                        backgroundColor: palette.primary.dark,
                    },
                },
            },
        },
    },
    MuiToggleButtonGroup: {
        styleOverrides: {
            root: {
                backgroundColor: palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                borderRadius: 12,
                padding: 4,
            },
            grouped: {
                border: 'none',
                '&:not(:first-of-type)': {
                    borderRadius: 10,
                    marginLeft: 4,
                },
                '&:first-of-type': {
                    borderRadius: 10,
                },
            },
        },
    },
    MuiTabs: {
        styleOverrides: {
            root: {
                minHeight: 44,
            },
            indicator: {
                height: 3,
                borderRadius: '3px 3px 0 0',
            },
        },
    },
    MuiTab: {
        styleOverrides: {
            root: {
                textTransform: 'none',
                fontWeight: 500,
                minHeight: 44,
                padding: '10px 16px',
            },
        },
    },
    MuiTooltip: {
        styleOverrides: {
            tooltip: {
                backgroundColor: palette.mode === 'dark' ? '#1e293b' : '#0f172a',
                color: '#f1f5f9',
                fontSize: '0.75rem',
                fontWeight: 500,
                borderRadius: 8,
                padding: '8px 12px',
            },
            arrow: {
                color: palette.mode === 'dark' ? '#1e293b' : '#0f172a',
            },
        },
    },
    MuiAlert: {
        styleOverrides: {
            root: {
                borderRadius: 12,
            },
        },
    },
    MuiAvatar: {
        styleOverrides: {
            root: {
                backgroundColor: palette.primary.main,
                color: palette.primary.contrastText,
            },
        },
    },
    MuiBreadcrumbs: {
        styleOverrides: {
            separator: {
                marginLeft: 8,
                marginRight: 8,
            },
        },
    },
    MuiMenu: {
        styleOverrides: {
            paper: {
                borderRadius: 12,
                marginTop: 8,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            },
        },
    },
    MuiMenuItem: {
        styleOverrides: {
            root: {
                borderRadius: 8,
                margin: '2px 6px',
                padding: '10px 14px',
            },
        },
    },
});

// ============================================
// THEME FACTORY
// ============================================

export const createAppTheme = (mode = 'dark', direction = 'ltr') => {
    const palette = mode === 'dark' ? darkPalette : lightPalette;

    return createTheme({
        palette,
        typography,
        shape,
        shadows,
        direction,
        components: getComponentOverrides(palette),
    });
};

// Default exports
export const lightTheme = createAppTheme('light');
export const darkTheme = createAppTheme('dark');

export default createAppTheme;
