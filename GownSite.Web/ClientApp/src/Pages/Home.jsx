import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, Button, Stack } from '@mui/material';

const Home = () => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 10 }}>
            <Box
                component="img"
                src="/logo.png"
                alt="Regowned"
                sx={{ width: { xs: '80%', sm: 420 }, maxWidth: 500, height: 'auto', mb: 2 }}
            />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 5, maxWidth: 560 }}>
                Buy, sell, and rent gowns for every simcha. Find the perfect dress nearby,
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
        </Box>
    );
};

export default Home;
