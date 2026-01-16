/**
 * ============================================
 * LOGIN PAGE (Enterprise Redesign)
 * ============================================
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Dumbbell, Eye, EyeOff } from 'lucide-react';
import {
    Paper, Typography, TextField, Button, Box,
    InputAdornment, IconButton, Checkbox, FormControlLabel,
    Alert, Zoom
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store';

const Login = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { login, isLoading } = useAuthStore();

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        rememberMe: false,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const result = await login(formData.username, formData.password);

        if (result.success) {
            toast.success(t('auth.loginSuccess'));
            navigate('/', { replace: true });
        } else {
            setError(result.message || t('auth.loginError'));
        }
    };

    return (
        <Box>
            {/* Logo Section */}
            <Box sx={{ textAlign: 'center', mb: 5 }}>
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <Box sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)',
                        mb: 3
                    }}>
                        <Dumbbell size={32} color="white" />
                    </Box>
                    <Typography variant="h4" fontWeight="700" color="text.primary" gutterBottom>
                        {t('app.name')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {t('app.tagline')}
                    </Typography>
                </motion.div>
            </Box>

            {/* Login Card */}
            <Paper elevation={0} sx={{ p: 4, borderRadius: 3 }}>
                <Typography variant="h5" fontWeight="600" mb={3}>
                    {t('auth.login')}
                </Typography>

                <form onSubmit={handleSubmit} noValidate>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                        {/* Error Alert */}
                        {error && (
                            <Zoom in>
                                <Alert severity="error" onClose={() => setError(null)}>
                                    {error}
                                </Alert>
                            </Zoom>
                        )}

                        <TextField
                            label={t('auth.username')}
                            fullWidth
                            required
                            autoFocus
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="admin"
                        />

                        <TextField
                            label={t('auth.password')}
                            type={showPassword ? 'text' : 'password'}
                            fullWidth
                            required
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowPassword(!showPassword)}
                                            edge="end"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={formData.rememberMe}
                                        onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                                        color="primary"
                                    />
                                }
                                label={
                                    <Typography variant="body2" color="text.secondary">
                                        {t('auth.rememberMe')}
                                    </Typography>
                                }
                            />
                        </Box>

                        <LoadingButton
                            type="submit"
                            variant="contained"
                            fullWidth
                            size="large"
                            loading={isLoading}
                            sx={{ py: 1.5, fontSize: '1rem' }}
                        >
                            {t('auth.loginButton')}
                        </LoadingButton>

                        {/* Demo Credentials Hint */}
                        <Box sx={{
                            p: 2,
                            borderRadius: 2,
                            bgcolor: 'background.default',
                            border: '1px border.default',
                            textAlign: 'center'
                        }}>
                            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                Demo Application
                            </Typography>
                            <Typography variant="caption" fontWeight="600" color="text.primary">
                                Admin: admin / admin123
                            </Typography>
                        </Box>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
};

export default Login;
