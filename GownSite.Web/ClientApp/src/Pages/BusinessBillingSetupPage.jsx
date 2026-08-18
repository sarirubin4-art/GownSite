import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const BusinessBillingSetupPage = () => {
    const { owner, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState('');
    const [stripeUnavailable, setStripeUnavailable] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!authLoading && !owner) {
            navigate('/login?redirect=/business/billing-setup');
            return;
        }
        if (!authLoading && owner && !owner.isBusinessAccount) {
            navigate('/mylistings');
        }
    }, [authLoading, owner]);

    useEffect(() => {
        if (searchParams.get('canceled')) {
            setError('Setup was canceled. You can try again whenever you\'re ready.');
        }
    }, []);

    const onContinueClick = async () => {
        setError('');
        setLoading(true);
        try {
            const { data } = await axios.post('/api/business/create-setup-session');
            window.location.href = data.url;
        } catch (err) {
            if (err?.response?.status === 503) {
                setStripeUnavailable(true);
            } else {
                setError(err?.response?.data?.message || 'Could not start billing setup.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || !owner || !owner.isBusinessAccount) return null;

    return (
        <Container maxWidth="xs" sx={{ py: 8 }}>
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>Set Up Your Business Plan</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                    ${owner.businessMonthlyFeeUsd}/month covers up to {owner.businessGownAllowance} live gowns — no per-listing charges. Add a card to activate it.
                </Typography>
                {error && <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>{error}</Alert>}
                {stripeUnavailable ? (
                    <Alert severity="info" sx={{ textAlign: 'left' }}>
                        Payment isn't set up yet — add your Stripe test keys to <code>appsettings.Development.json</code> to enable real checkout.
                    </Alert>
                ) : (
                    <Button variant="contained" size="large" onClick={onContinueClick} disabled={loading} sx={{ px: 4 }}>
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Add Card & Activate Plan'}
                    </Button>
                )}
            </Paper>
        </Container>
    );
};

export default BusinessBillingSetupPage;
