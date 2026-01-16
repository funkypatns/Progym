/**
 * ============================================
 * AUTH LAYOUT
 * ============================================
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, useTheme } from '@mui/material';

const AuthLayout = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.default',
                position: 'relative',
                overflow: 'hidden',
                p: 2
            }}
        >
            {/* Background gradients */}
            <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                <Box sx={{
                    position: 'absolute',
                    top: '-50%',
                    left: '-50%',
                    width: '200%',
                    height: '200%',
                    background: isDark
                        ? 'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.08), transparent 70%)'
                        : 'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.05), transparent 70%)'
                }} />

                {/* Subtle Grid Pattern */}
                <Box sx={{
                    position: 'absolute',
                    inset: 0,
                    opacity: isDark ? 0.03 : 0.03,
                    backgroundImage: `linear-gradient(${isDark ? '#fff' : '#000'} 1px, transparent 1px),
                            linear-gradient(90deg, ${isDark ? '#fff' : '#000'} 1px, transparent 1px)`,
                    backgroundSize: '40px 40px'
                }} />
            </Box>

            {/* Content */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 10 }}
            >
                <Outlet />
            </motion.div>
        </Box>
    );
};

export default AuthLayout;
