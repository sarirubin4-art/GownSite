import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Box, Typography, Button, Stack, Snackbar, Alert } from '@mui/material';
import usePageTitle from '../hooks/usePageTitle';

const Home = () => {
    usePageTitle(null, "Buy, sell, and rent gowns for every event. Find the perfect dress nearby, or give one you love a beautiful second life.");
    const [searchParams] = useSearchParams();
    const verified = searchParams.get('verified');
    const [noticeOpen, setNoticeOpen] = useState(!!verified);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 10 }}>
            <Box
                component="img"
                src="/logo.webp"
                alt="Regowned"
                sx={{ width: { xs: '80%', sm: 420 }, maxWidth: 500, height: 'auto', mb: 2 }}
            />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 5, maxWidth: 560 }}>
                Buy, sell, and rent gowns for every event. Find the perfect dress nearby,
                or give one you love a beautiful second life.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button component={Link} to="/search" variant="contained" size="large" sx={{ px: 4, py: 1.5 }}>
                    Start Your Search
                </Button>
                <Button component={Link} to="/postagown" variant="outlined" size="large" sx={{ px: 4, py: 1.5 }}>
                    Post a Gown
                </Button>
            </Stack>

            <Snackbar
                open={noticeOpen}
                autoHideDuration={6000}
                onClose={() => setNoticeOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setNoticeOpen(false)}
                    severity={verified === '1' ? 'success' : 'warning'}
                    variant="filled"
                >
                    {verified === '1'
                        ? 'Email verified! Your account is fully active.'
                        : 'That verification link is invalid or has expired.'}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Home;
