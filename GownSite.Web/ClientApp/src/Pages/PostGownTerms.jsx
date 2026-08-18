import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, Button, Stack, Box, Paper } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const PostGownTerms = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/postagown/terms');
        }
    }, [loading, owner]);

    if (loading || !owner) return null;

    return (
        <Container maxWidth="sm" sx={{ py: 6 }}>
            <Typography variant="h4" gutterBottom>Before You Post</Typography>
            <Paper elevation={1} sx={{ borderRadius: 3, mb: 3, bgcolor: 'background.paper', overflow: 'hidden' }}>
                <Box
                    component="img" src="/gown-terms.webp" alt="Before you post: pricing and how it works"
                    sx={{ width: '100%', display: 'block' }}
                />
            </Paper>
            <Typography variant="body2" sx={{ mb: 3 }}>
                <Button variant="text" size="small" onClick={() => navigate('/concierge/terms')} sx={{ px: 0 }}>
                    Too busy to fill this out yourself? Let our team do it for you
                </Button>
            </Typography>
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button variant="text" onClick={() => navigate('/')}>Cancel</Button>
                <Button variant="outlined" onClick={() => navigate('/postagown/bulk-form')}>Post Multiple Gowns</Button>
                <Button variant="contained" onClick={() => navigate('/postagown/form')}>Agree &amp; Continue</Button>
            </Stack>
        </Container>
    );
};

export default PostGownTerms;
