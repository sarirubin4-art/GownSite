import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, Paper, CircularProgress, Alert, Button } from '@mui/material';

const PaymentSetupSuccess = () => {
    const [searchParams] = useSearchParams();
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
                await axios.post('/api/payment/confirm-setup-session', { sessionId });
                setConfirmed(true);
            } catch (err) {
                setError(err?.response?.data?.message || 'Could not confirm your card setup.');
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
                        <Typography variant="h5" gutterBottom>Your post is under review!</Typography>
                        <Typography color="text.secondary" sx={{ mb: 3 }}>
                            We'll email you as soon as it's approved — your card won't be charged until then.
                        </Typography>
                        <Button variant="contained" component={Link} to="/mylistings">
                            View My Listings
                        </Button>
                    </>
                ) : (
                    <>
                        <CircularProgress sx={{ mb: 2 }} />
                        <Typography>Confirming your card details...</Typography>
                    </>
                )}
            </Paper>
        </Container>
    );
};

export default PaymentSetupSuccess;
