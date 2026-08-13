import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, Paper, Button, Stack, List, ListItem, ListItemText } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { formatUsd } from '../constants/gownOptions';

const PostGownTerms = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();
    const [gownFee, setGownFee] = useState(null);
    const [setupFee, setSetupFee] = useState(0);

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/postagown/terms');
        }
    }, [loading, owner]);

    useEffect(() => {
        axios.get('/api/payment/pricing').then(({ data }) => {
            setGownFee(data.gownMonthlyFee);
            setSetupFee(data.gownPostingSetupFee || 0);
        }).catch(() => {});
    }, []);

    if (loading || !owner) return null;

    return (
        <Container maxWidth="sm" sx={{ py: 6 }}>
            <Typography variant="h4" gutterBottom>Before You Post</Typography>
            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <List dense>
                    <ListItem>
                        <ListItemText primary={
                            gownFee != null
                                ? `Posting a single gown costs ${formatUsd(gownFee + setupFee)} for your first month, then ${formatUsd(gownFee)}/month after — this keeps your posting live and supports the upkeep of the site.`
                                : 'Listing a gown requires a small monthly fee to keep your posting live and support the upkeep of the site.'
                        } />
                    </ListItem>
                    <ListItem>
                        <ListItemText primary="Posting multiple gowns at once? You'll automatically get a lower per-gown rate the more you post in one batch — no promo code needed." />
                    </ListItem>
                    <ListItem>
                        <ListItemText primary="Most gowns take about 5 minutes to post if you have your photos ready — just fill in the basics, and add extra details later if you'd like." />
                    </ListItem>
                    <ListItem>
                        <ListItemText primary="After you add a card, your listing is reviewed before it goes live — you won't be charged unless it's approved. Once live, you can take it down and cancel the subscription any time from My Listings." />
                    </ListItem>
                    <ListItem>
                        <ListItemText primary="Your contact info is only shown to people who click 'I'm interested' on your listing — you choose whether your name is shown publicly." />
                    </ListItem>
                    <ListItem>
                        <ListItemText primary="Please post accurate photos and details so buyers and renters know what they're getting." />
                    </ListItem>
                </List>
            </Paper>
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button variant="text" onClick={() => navigate('/')}>Cancel</Button>
                <Button variant="outlined" onClick={() => navigate('/postagown/bulk-form')}>Post Multiple Gowns</Button>
                <Button variant="contained" onClick={() => navigate('/postagown/form')}>Agree &amp; Continue</Button>
            </Stack>
        </Container>
    );
};

export default PostGownTerms;
