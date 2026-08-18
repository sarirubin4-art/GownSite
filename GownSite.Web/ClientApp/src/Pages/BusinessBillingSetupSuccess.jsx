import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, Paper, CircularProgress, Alert, Button } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const BusinessBillingSetupSuccess = () => {
    const [searchParams] = useSearchParams();
    const { refresh } = useAuth();
    const [error, setError] = useState('');
    const [confirmed, setConfirmed] = useState(false);

    useEffect(() => {
        const confirm = async () => {
            const sessionId = searchParams.get('session_id');
            if (!sessionId) {
                setError('Missing confirmation details.');
                return;
            }
            try {
                await axios.post('/api/business/confirm-setup-session', { sessionId });
                await refresh();
                setConfirmed(true);
            } catch (err) {
                setError(err?.response?.data?.message || 'Could not confirm your billing setup.');
            }
        };
        confirm();
    }, []);

    return (
        <Container maxWidth="xs" sx={{ py: 8, textAlign: 'center' }}>
            <Paper variant="outlined" sx={{ p: 4 }}>
                {error ? (
                    <Alert severity="error">{error}</Alert>
                ) : confirmed ? (
                    <>
                        <Typography variant="h5" gutterBottom>Your business plan is active!</Typography>
                        <Typography color="text.secondary" sx={{ mb: 3 }}>
                            You can now post gowns without a per-listing card step — each one still goes through moderation review before going live.
                        </Typography>
                        <Button variant="contained" component={Link} to="/postagown/form">
                            Post a Gown
                        </Button>
                    </>
                ) : (
                    <>
                        <CircularProgress sx={{ mb: 2 }} />
                        <Typography>Confirming your billing setup...</Typography>
                    </>
                )}
            </Paper>
        </Container>
    );
};

export default BusinessBillingSetupSuccess;
