import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, Paper, Button, Stack, List, ListItem, ListItemText } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { formatUsd } from '../constants/gownOptions';

const AdvertiseTerms = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();
    const [adFee, setAdFee] = useState(null);

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/advertise/terms');
        }
    }, [loading, owner]);

    useEffect(() => {
        axios.get('/api/payment/pricing').then(({ data }) => setAdFee(data.adMonthlyFee)).catch(() => {});
    }, []);

    if (loading || !owner) return null;

    return (
        <Container maxWidth="sm" sx={{ py: 6 }}>
            <Typography variant="h4" gutterBottom>Before You Advertise</Typography>
            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <List dense>
                    <ListItem>
                        <ListItemText primary={
                            adFee != null
                                ? `Advertising your business costs ${formatUsd(adFee)}/month to keep your ad live and rotating across the site.`
                                : 'Advertising your business requires a small monthly fee to keep your ad live and rotating across the site.'
                        } />
                    </ListItem>
                    <ListItem>
                        <ListItemText primary="Your ad goes live once payment is confirmed, and you can take it down and cancel the subscription at any time from My Ads." />
                    </ListItem>
                    <ListItem>
                        <ListItemText primary="Ads should be relevant to simcha-related services — hair, makeup, alterations, gown rental/sales, and similar." />
                    </ListItem>
                    <ListItem>
                        <ListItemText primary="Please use an accurate title, image, and description so visitors know what your business offers." />
                    </ListItem>
                </List>
            </Paper>
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
                <Button variant="text" onClick={() => navigate('/')}>Cancel</Button>
                <Button variant="contained" onClick={() => navigate('/advertise/form')}>Agree &amp; Continue</Button>
            </Stack>
        </Container>
    );
};

export default AdvertiseTerms;
