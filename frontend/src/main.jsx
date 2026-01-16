/**
 * ============================================
 * MAIN ENTRY POINT
 * ============================================
 * With MUI Theme Provider and RTL Support
 */

import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';
import App from './App';
import './i18n';
import './styles/index.css';
import { useThemeStore } from './store';
import { createAppTheme } from './theme';
import { useTranslation } from 'react-i18next';

// Create RTL cache
const cacheRtl = createCache({
    key: 'muirtl',
    // stylisPlugins: [prefixer, rtlPlugin], // Disabled to prevent crash
});

// Create LTR cache
const cacheLtr = createCache({
    key: 'mui',
});

// Themed App wrapper
const ThemedApp = () => {
    const { theme: themeMode } = useThemeStore();
    const { i18n } = useTranslation();

    const isRtl = i18n.dir() === 'rtl';
    const direction = isRtl ? 'rtl' : 'ltr';

    // Create theme based on mode and direction
    const theme = useMemo(() => {
        return createAppTheme(themeMode, direction);
    }, [themeMode, direction]);

    // Select appropriate cache
    const cache = isRtl ? cacheRtl : cacheLtr;

    return (
        <CacheProvider value={cache}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <App />
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: themeMode === 'dark' ? '#1e293b' : '#ffffff',
                            color: themeMode === 'dark' ? '#f1f5f9' : '#0f172a',
                            borderRadius: '12px',
                            border: themeMode === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                            padding: '12px 16px',
                            fontSize: '14px',
                            fontWeight: 500,
                        },
                        success: {
                            iconTheme: {
                                primary: '#10b981',
                                secondary: themeMode === 'dark' ? '#1e293b' : '#ffffff',
                            },
                        },
                        error: {
                            iconTheme: {
                                primary: '#ef4444',
                                secondary: themeMode === 'dark' ? '#1e293b' : '#ffffff',
                            },
                        },
                    }}
                />
            </ThemeProvider>
        </CacheProvider>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <ThemedApp />
        </BrowserRouter>
    </React.StrictMode>
);
