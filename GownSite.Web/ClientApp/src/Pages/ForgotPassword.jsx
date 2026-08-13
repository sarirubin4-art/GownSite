import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, TextField, Button, Typography, Alert, Stack } from '@mui/material';
import axios from 'axios';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const onSubmit = async () => {
        if (!email.trim()) return;
        setSubmitting(true);
        setError('');
        try {
            await axios.post('/api/owner/forgot-password', { email: email.trim() });
            setSent(true);
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Container maxWidth="xs" sx={{ py: 6 }}>
            <Typography variant="h4" gutterBottom>Forgot Password</Typography>
            {sent ? (
                <Alert severity="success">
                    If that email is registered, we've sent a link to reset your password. Check your inbox.
                </Alert>
            ) : (
                <>
                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                        Enter your account email and we'll send you a link to reset your password.
                    </Typography>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <Stack spacing={2}>
                        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
                        <Button variant="contained" size="large" disabled={submitting || !email.trim()} onClick={onSubmit}>
                            {submitting ? 'Sending...' : 'Send Reset Link'}
                        </Button>
                    </Stack>
                </>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
                <Link to="/login">Back to Log In</Link>
            </Typography>
        </Container>
    );
};

export default ForgotPassword;
