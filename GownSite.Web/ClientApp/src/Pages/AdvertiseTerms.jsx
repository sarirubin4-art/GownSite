import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, Button, Stack, Box, Paper } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import ContactAdminDialog from '../components/ContactAdminDialog';

const AdvertiseTerms = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();

    const [gemachOpen, setGemachOpen] = useState(false);

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/advertise/terms');
        }
    }, [loading, owner]);

    if (loading || !owner) return null;

    return (
        <Container maxWidth="sm" sx={{ py: 6 }}>
            <Typography variant="h4" gutterBottom>Before You Advertise</Typography>
            <Paper elevation={1} sx={{ borderRadius: 3, mb: 3, bgcolor: 'background.paper', overflow: 'hidden' }}>
                <Box
                    component="img" src="/ad-terms.webp" alt="Before you advertise: pricing and how it works"
                    sx={{ width: '100%', display: 'block' }}
                />
            </Paper>

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
