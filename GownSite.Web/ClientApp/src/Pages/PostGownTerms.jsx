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

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/postagown/terms');
        }
    }, [loading, owner]);

    useEffect(() => {
        axios.get('/api/payment/pricing').then(({ data }) => setGownFee(data.gownMonthlyFee)).catch(() => {});
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
                                ? `Listing a gown costs ${formatUsd(gownFee)}/month to keep your posting live and support the upkeep of the site.`
                                : 'Listing a gown requires a small monthly fee to keep your posting live and support the upkeep of the site.'
                        } />
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
