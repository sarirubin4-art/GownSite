import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, Paper, CircularProgress, Alert, Button } from '@mui/material';

const BulkPaymentSetupSuccess = () => {
    const [searchParams] = useSearchParams();
    const [error, setError] = useState('');
    const [count, setCount] = useState(0);
    const [confirmed, setConfirmed] = useState(false);

    useEffect(() => {
        const confirm = async () => {
            const sessionId = searchParams.get('session_id');
            if (!sessionId) {
                setError('Missing confirmation details.');
                return;
            }
            try {
                const { data } = await axios.post('/api/payment/confirm-batch-setup-session', { sessionId });
                setCount(data.postingIds?.length || 0);
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
                        <Typography variant="h5" gutterBottom>Your {count} gown{count === 1 ? '' : 's'} {count === 1 ? 'is' : 'are'} under review!</Typography>
                        <Typography color="text.secondary" sx={{ mb: 3 }}>
                            We'll email you as each one is approved — your card won't be charged until then.
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

export default BulkPaymentSetupSuccess;
