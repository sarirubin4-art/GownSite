import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, Button, Paper, Alert, Stack, CircularProgress } from '@mui/material';
import PriceSummary from '../components/PriceSummary';

const BulkPaymentSetupPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [stripeUnavailable, setStripeUnavailable] = useState(false);
    const [loading, setLoading] = useState(false);
    const [perGownFee, setPerGownFee] = useState(null);
    const [fullFee, setFullFee] = useState(null);
    const [durationMonths, setDurationMonths] = useState(null);

    const ids = (searchParams.get('ids') || '').split(',').filter(Boolean).map(Number);

    useEffect(() => {
        if (searchParams.get('canceled')) {
            setError('Card setup was canceled. You can try again whenever you\'re ready.');
        }
    }, []);

    useEffect(() => {
        const loadFee = async () => {
            try {
                const [{ data: pricing }, { data: listings }] = await Promise.all([
                    axios.get('/api/payment/pricing'),
                    axios.get('/api/gown/mylistings')
                ]);
                const firstPosting = listings.find((g) => g.id === ids[0]);
                setPerGownFee(firstPosting?.monthlyFeeOverride ?? pricing.gownMonthlyFee);
                setFullFee(pricing.gownMonthlyFee);
                setDurationMonths(firstPosting?.promoDurationMonths ?? null);
            } catch {
                // leave perGownFee null; the fallback copy still reads fine without a number
            }
        };
        if (ids.length > 0) loadFee();
    }, []);

    const onContinueClick = async () => {
        setError('');
        setLoading(true);
        try {
            const { data } = await axios.post('/api/payment/create-batch-setup-session', { gownPostingIds: ids });
            window.location.href = data.url;
        } catch (err) {
            if (err?.response?.status === 503) {
                setStripeUnavailable(true);
            } else {
                setError(err?.response?.data?.message || 'Could not start card setup.');
            }
        } finally {
            setLoading(false);
        }
    };

    const onSkipForTesting = async () => {
        setLoading(true);
        try {
            for (const id of ids) {
                await axios.post('/api/gown/activate-test', { id });
            }
            navigate('/search', { state: { posted: true } });
        } catch {
            setError('Could not activate the listings.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="xs" sx={{ py: 8 }}>
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>One Last Step</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                    Every listing is reviewed before it goes live. Add a card once to hold your spot for all {ids.length} gown{ids.length === 1 ? '' : 's'} — here's what you'll be charged once they're approved:
                </Typography>
                <PriceSummary
                    label="Monthly Listing Fee"
                    fullFee={fullFee}
                    resolvedFee={perGownFee}
                    quantity={ids.length}
                    durationMonths={durationMonths}
                />
                {error && <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>{error}</Alert>}
                {stripeUnavailable ? (
                    <Stack spacing={2}>
                        <Alert severity="info" sx={{ textAlign: 'left' }}>
                            Payment isn't set up yet — add your Stripe test keys to <code>appsettings.Development.json</code> to enable real checkout.
                        </Alert>
                        <Button variant="contained" onClick={onSkipForTesting} disabled={loading}>
                            Skip Setup (Test Mode) &amp; Publish Listings
                        </Button>
                    </Stack>
                ) : (
                    <Button variant="contained" size="large" onClick={onContinueClick} disabled={loading || ids.length === 0} sx={{ px: 4 }}>
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Add Card & Submit for Review'}
                    </Button>
                )}
            </Paper>
        </Container>
    );
};

export default BulkPaymentSetupPage;
