import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, Button, Paper, Alert, Stack, CircularProgress } from '@mui/material';
import PriceSummary from '../components/PriceSummary';
import PromoApplyBox from '../components/PromoApplyBox';

const PaymentSetupPage = () => {
    const { postingId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [stripeUnavailable, setStripeUnavailable] = useState(false);
    const [loading, setLoading] = useState(false);
    const [gownFee, setGownFee] = useState(null);
    const [fullFee, setFullFee] = useState(null);
    const [durationMonths, setDurationMonths] = useState(null);
    const [oneTimeFee, setOneTimeFee] = useState(0);
    const [currentPromoCode, setCurrentPromoCode] = useState(null);
    const [promoApplying, setPromoApplying] = useState(false);
    const [promoMessage, setPromoMessage] = useState(null);

    useEffect(() => {
        if (searchParams.get('canceled')) {
            setError('Card setup was canceled. You can try again whenever you\'re ready.');
        }
    }, []);

    const loadFee = async () => {
        try {
            const [{ data: pricing }, { data: listings }] = await Promise.all([
                axios.get('/api/payment/pricing'),
                axios.get('/api/gown/mylistings')
            ]);
            const posting = listings.find((g) => g.id === Number(postingId));
            setGownFee(posting?.monthlyFeeOverride ?? pricing.gownMonthlyFee);
            setFullFee(pricing.gownMonthlyFee);
            setDurationMonths(posting?.promoDurationMonths ?? null);
            // The one-time setup fee only applies to a solo listing with no promo/batch
            // pricing already discounting it — matches the backend's charge-time logic.
            const isSoloDefaultPricing = !posting?.batchId && posting?.monthlyFeeOverride == null;
            setOneTimeFee(isSoloDefaultPricing ? pricing.gownPostingSetupFee : 0);
            setCurrentPromoCode(posting?.promoCode?.code ?? null);
        } catch {
            // leave gownFee null; the fallback copy still reads fine without a number
        }
    };

    useEffect(() => {
        loadFee();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onApplyPromo = async (promoCode) => {
        setPromoApplying(true);
        setPromoMessage(null);
        try {
            await axios.post('/api/payment/apply-gown-promo-draft', { id: Number(postingId), promoCode });
            setPromoMessage({ type: 'success', text: 'Promo applied!' });
            await loadFee();
        } catch (err) {
            setPromoMessage({ type: 'error', text: err?.response?.data?.message || 'Could not apply promo code.' });
        } finally {
            setPromoApplying(false);
        }
    };

    const onContinueClick = async () => {
        setError('');
        setLoading(true);
        try {
            const { data } = await axios.post('/api/payment/create-setup-session', { gownPostingId: Number(postingId) });
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
                <Typography variant="h5" gutterBottom>One Last Step</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                    Every listing is reviewed before it goes live. Add a card to hold your spot — here's what you'll be charged once it's approved:
                </Typography>
                <PriceSummary label="Monthly Listing Fee" fullFee={fullFee} resolvedFee={gownFee} durationMonths={durationMonths} oneTimeFee={oneTimeFee} />
                <Stack sx={{ mb: 3, textAlign: 'left' }}>
                    <PromoApplyBox
                        currentPromoCode={currentPromoCode}
                        onApply={onApplyPromo}
                        applying={promoApplying}
                        message={promoMessage}
                    />
                </Stack>
                {error && <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>{error}</Alert>}
                {stripeUnavailable ? (
                    <Stack spacing={2}>
                        <Alert severity="info" sx={{ textAlign: 'left' }}>
                            Payment isn't set up yet — add your Stripe test keys to <code>appsettings.Development.json</code> to enable real checkout.
                        </Alert>
                        <Button variant="contained" onClick={onSkipForTesting} disabled={loading}>
                            Skip Setup (Test Mode) &amp; Publish Listing
                        </Button>
                    </Stack>
                ) : (
                    <Button variant="contained" size="large" onClick={onContinueClick} disabled={loading} sx={{ px: 4 }}>
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Add Card & Submit for Review'}
                    </Button>
                )}
            </Paper>
        </Container>
    );
};

export default PaymentSetupPage;
