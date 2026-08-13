import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Container, TextField, Button, Typography, Alert, Stack, IconButton, InputAdornment
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import axios from 'axios';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const onSubmit = async () => {
        setError('');
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        setSubmitting(true);
        try {
            await axios.post('/api/owner/reset-password', { token, newPassword: password });
            setDone(true);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not reset your password.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!token) {
        return (
            <Container maxWidth="xs" sx={{ py: 6 }}>
                <Typography variant="h4" gutterBottom>Reset Password</Typography>
                <Alert severity="error">This reset link is missing its token. Please request a new one from the login page.</Alert>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
                    <Link to="/forgot-password">Request a new link</Link>
                </Typography>
            </Container>
        );
    }

    if (done) {
        return (
            <Container maxWidth="xs" sx={{ py: 6 }}>
                <Typography variant="h4" gutterBottom>Reset Password</Typography>
                <Alert severity="success" sx={{ mb: 2 }}>Your password has been reset.</Alert>
                <Button variant="contained" size="large" fullWidth onClick={() => navigate('/login')}>
                    Log In
                </Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="xs" sx={{ py: 6 }}>
            <Typography variant="h4" gutterBottom>Reset Password</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                Choose a new password for your account.
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2}>
                <TextField
                    label="New Password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)} fullWidth
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" size="small">
                                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                    </IconButton>
                                </InputAdornment>
                            )
                        }
                    }}
                />
                <TextField
                    label="Confirm New Password" type={showPassword ? 'text' : 'password'} value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} fullWidth
                />
                <Button variant="contained" size="large" disabled={submitting} onClick={onSubmit}>
                    {submitting ? 'Saving...' : 'Reset Password'}
                </Button>
            </Stack>
        </Container>
    );
};

export default ResetPassword;
