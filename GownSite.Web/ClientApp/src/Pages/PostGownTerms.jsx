import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, Button, Stack, Box } from '@mui/material';
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
            <Box component="img" src="/gown-terms.png" alt="Before you post: pricing and how it works" sx={{ width: '100%', borderRadius: 2, mb: 3, display: 'block' }} />
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button variant="text" onClick={() => navigate('/')}>Cancel</Button>
                <Button variant="outlined" onClick={() => navigate('/postagown/bulk-form')}>Post Multiple Gowns</Button>
                <Button variant="contained" onClick={() => navigate('/postagown/form')}>Agree &amp; Continue</Button>
            </Stack>
        </Container>
    );
};

export default PostGownTerms;
