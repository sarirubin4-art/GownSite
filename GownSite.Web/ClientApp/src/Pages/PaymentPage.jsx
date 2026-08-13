import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, Button, Paper, Alert, Stack, CircularProgress } from '@mui/material';

const PaymentPage = () => {
    const { postingId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [stripeUnavailable, setStripeUnavailable] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (searchParams.get('canceled')) {
            setError('Checkout was canceled. You can try again whenever you\'re ready.');
        }
    }, []);

    const onPayClick = async () => {
        setError('');
        setLoading(true);
        try {
            const { data } = await axios.post('/api/payment/create-checkout-session', { gownPostingId: Number(postingId) });
            window.location.href = data.url;
        } catch (err) {
            if (err?.response?.status === 503) {
                setStripeUnavailable(true);
            } else {
                setError(err?.response?.data?.message || 'Could not start checkout.');
            }
        } finally {
            setLoading(false);
        }
    };

    const onSkipForTesting = async () => {
        setLoading(true);
        try {
            await axios.post('/api/gown/activate-test', { id: Number(postingId) });
            navigate('/search', { state: { posted: true } });
        } catch {
            setError('Could not activate the listing.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="xs" sx={{ py: 8 }}>
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>Almost There!</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                    A small monthly fee keeps your listing live and helps cover the upkeep of the site.
                </Typography>
                {error && <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>{error}</Alert>}
                {stripeUnavailable ? (
                    <Stack spacing={2}>
                        <Alert severity="info" sx={{ textAlign: 'left' }}>
                            Payment isn't set up yet — add your Stripe test keys to <code>appsettings.Development.json</code> to enable real checkout.
                        </Alert>
                        <Button variant="contained" onClick={onSkipForTesting} disabled={loading}>
                            Skip Payment (Test Mode) &amp; Publish Listing
                        </Button>
                    </Stack>
                ) : (
                    <Button variant="contained" size="large" onClick={onPayClick} disabled={loading} sx={{ px: 4 }}>
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Continue to Payment'}
                    </Button>
                )}
            </Paper>
        </Container>
    );
};

export default PaymentPage;
