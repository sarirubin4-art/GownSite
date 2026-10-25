import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, Button, Stack, Box, Paper } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import ContactAdminDialog from '../components/ContactAdminDialog';
import { formatUsd } from '../constants/gownOptions';

// Bulleted list styled like the original ad-terms.webp graphic this replaced.
const TermsList = ({ children }) => (
    <Box component="ul" sx={{ m: 0, mb: 1, pl: 3.5, '& li': { mb: 0.5, fontSize: '1.05rem', lineHeight: 1.45 } }}>
        {children}
    </Box>
);

// Pricing and how-it-works, as live text (it used to be a static image, ad-terms.webp)
// so the plan prices come straight from /api/payment/pricing and can't go stale.
const AdTermsCard = ({ pricing }) => {
    const monthly = pricing?.adMonthlyFee;
    return (
        <Paper elevation={1} sx={{ borderRadius: 3, mb: 3, bgcolor: 'background.paper', px: { xs: 2.5, sm: 3.5 }, py: { xs: 2.5, sm: 3 }, color: '#333' }}>
            <Typography sx={{ fontSize: '1.15rem' }}>
                Advertising your business costs just <strong>{monthly != null ? `${formatUsd(monthly)}/month` : '…'}</strong>!
            </Typography>
            {pricing && (
                <Typography sx={{ fontSize: '0.95rem', mt: 0.25 }}>
                    Or save by paying upfront: <strong>{formatUsd(pricing.adSixMonthFee)} for 6 months</strong> (save {formatUsd((monthly * 6 - pricing.adSixMonthFee).toFixed(2))})
                    {' '}or <strong>{formatUsd(pricing.adYearlyFee)} for a year</strong> (save {formatUsd((monthly * 12 - pricing.adYearlyFee).toFixed(2))}).
                </Typography>
            )}
            <Typography sx={{ fontSize: '0.95rem', mb: 1 }}>
                This minimal fee keeps your ad live and rotating across the site.
            </Typography>

            <Typography sx={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '1.05rem', letterSpacing: '0.04em', color: '#555', mb: 0.5 }}>
                HOW IT WORKS:
            </Typography>
            <TermsList>
                <li>You fill in the form, choose your plan, and enter your card info</li>
                <li>Your ad gets approved, and goes live on the site!</li>
                <li>ONLY THEN does your card get charged.</li>
            </TermsList>
            <Typography sx={{ fontSize: '0.95rem', mb: 1.5 }}>
                You can cancel a monthly ad at any time from My Listings. 6-month and yearly plans stay live until the end of the period you've paid for.
            </Typography>
            <TermsList>
                <li>
                    Ads should be relevant to simcha-related services — <strong>hair</strong>, <strong>makeup</strong>,{' '}
                    <strong>alterations</strong>, <strong>gown rental/sales</strong>, and similar.
                </li>
                <li>Please use an accurate title, image, and description so visitors know what your business offers.</li>
            </TermsList>
        </Paper>
    );
};

const AdvertiseTerms = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();

    const [gemachOpen, setGemachOpen] = useState(false);
    const [pricing, setPricing] = useState(null);

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/advertise/terms');
        }
    }, [loading, owner]);

    useEffect(() => {
        axios.get('/api/payment/pricing').then(({ data }) => setPricing(data)).catch(() => {});
    }, []);

    if (loading || !owner) return null;

    return (
        <Container maxWidth="sm" sx={{ py: 6 }}>
            <Typography variant="h4" gutterBottom>Before You Advertise</Typography>
            <AdTermsCard pricing={pricing} />

            <Typography variant="body2" sx={{ mb: 3 }}>
                <Button variant="text" size="small" onClick={() => setGemachOpen(true)} sx={{ px: 0 }}>
                    Are you a gemach? Advertise for free!
                </Button>
            </Typography>

            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
                <Button variant="text" onClick={() => navigate('/')}>Cancel</Button>
                <Button variant="contained" onClick={() => navigate('/advertise/form')}>Agree &amp; Continue</Button>
            </Stack>

            <ContactAdminDialog
                open={gemachOpen}
                onClose={() => setGemachOpen(false)}
                topic="Gemach free advertising inquiry"
                title="Free Gemach Advertising"
                promptText="Tell me a little about your gemach and how it works, to see if you qualify for free advertising — we'll follow up by email."
            />
        </Container>
    );
};

export default AdvertiseTerms;
