import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, Button, Stack, Box, Paper, Grid } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import ContactAdminDialog from '../components/ContactAdminDialog';

const ConciergePostingTerms = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();

    const [visitOpen, setVisitOpen] = useState(false);

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/concierge/terms');
        }
    }, [loading, owner]);

    if (loading || !owner) return null;

    return (
        <Container maxWidth="md" sx={{ py: 6 }}>
            <Typography variant="h4" gutterBottom>Let Us Post It For You</Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
                Too busy to fill out the posting form yourself? Send us the basics and we'll draft the listing for you.
                Both options are add-ons on top of the normal $9.99/month per-gown listing fee once your gown is live.
            </Typography>

            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <Paper variant="outlined" sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h6" gutterBottom>Remote Drafting</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
                            Send us at least one photo, the size, price, and location for each gown — anything else is
                            optional. We'll fill in the rest and let you know when it's ready to review.
                        </Typography>
                        <Typography variant="h5" sx={{ mb: 2 }}>$7/gown</Typography>
                        <Button variant="contained" onClick={() => navigate('/concierge/form')}>
                            Start Remote Drafting
                        </Button>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <Paper variant="outlined" sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h6" gutterBottom>On-Site Business Visit</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
                            For Lakewood, NJ businesses only — we'll come to you and draft your gowns in person.
                            The hourly rate covers the drafting, so there's no separate per-gown fee for this option.
                        </Typography>
                        <Typography variant="h5" sx={{ mb: 2 }}>$50/hour</Typography>
                        <Button variant="outlined" onClick={() => setVisitOpen(true)}>
                            Request an On-Site Visit
                        </Button>
                    </Paper>
                </Grid>
            </Grid>

            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                <Button variant="text" onClick={() => navigate('/')}>Cancel</Button>
            </Stack>

            <ContactAdminDialog
                open={visitOpen}
                onClose={() => setVisitOpen(false)}
                topic="On-site business visit request"
                title="Request an On-Site Visit"
                promptText="Tell us your business address in Lakewood, roughly how many gowns you'd like drafted, and any scheduling preferences — we'll follow up by email to set up a time."
            />
        </Container>
    );
};

export default ConciergePostingTerms;
