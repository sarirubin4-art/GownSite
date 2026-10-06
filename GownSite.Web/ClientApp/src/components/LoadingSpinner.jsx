import React from 'react';
import { Box, CircularProgress } from '@mui/material';

// Shown in place of a list/page while its data is still loading, so an empty-state
// message ("Nothing live right now.", "You haven't posted any gowns yet.") never flashes
// up before the real data arrives. Same look as Browse Gowns' original search spinner.
const LoadingSpinner = ({ sx }) => (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, ...sx }}>
        <CircularProgress />
    </Box>
);

export default LoadingSpinner;
