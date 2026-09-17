import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, Button, Paper, Alert, Stack, CircularProgress } from '@mui/material';
import PriceSummary from '../components/PriceSummary';
import PromoApplyBox from '../components/PromoApplyBox';

const AdPaymentSetupPage = () => {
    const { adId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [stripeUnavailable, setStripeUnavailable] = useState(false);
    const [loading, setLoading] = useState(false);
    const [adFee, setAdFee] = useState(null);
    const [fullFee, setFullFee] = useState(null);
    const [durationMonths, setDurationMonths] = useState(null);
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
            const [{ data: pricing }, { data: ads }] = await Promise.all([
                axios.get('/api/payment/pricing'),
                axios.get('/api/ad/myads')
            ]);
            const ad = ads.find((a) => a.id === Number(adId));
            setAdFee(ad?.monthlyFeeOverride ?? pricing.adMonthlyFee);
            setFullFee(pricing.adMonthlyFee);
            setDurationMonths(ad?.promoDurationMonths ?? null);
            setCurrentPromoCode(ad?.promoCode?.code ?? null);
        } catch {
            // leave adFee null; the fallback copy still reads fine without a number
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
            await axios.post('/api/payment/apply-ad-promo-draft', { id: Number(adId), promoCode });
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
            const { data } = await axios.post('/api/payment/create-ad-setup-session', { adId: Number(adId) });
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
            await axios.post('/api/ad/activate-test', { id: Number(adId) });
            navigate('/myads', { state: { posted: true } });
        } catch {
            setError('Could not activate the ad.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="xs" sx={{ py: 8 }}>
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>One Last Step</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                    Every ad is reviewed before it goes live. Add a card to hold your spot — here's what you'll be charged once it's approved:
                </Typography>
                <PriceSummary label="Monthly Ad Fee" fullFee={fullFee} resolvedFee={adFee} durationMonths={durationMonths} />
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
                            Skip Setup (Test Mode) &amp; Publish Ad
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

export default AdPaymentSetupPage;
