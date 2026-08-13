import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, Paper, CircularProgress, Alert } from '@mui/material';

const AdPaymentSuccess = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    useEffect(() => {
        const confirm = async () => {
            const sessionId = searchParams.get('session_id');
            if (!sessionId) {
                setError('Missing payment confirmation details.');
                return;
            }
            try {
                await axios.post('/api/payment/confirm-ad-session', { sessionId });
                navigate('/myads', { state: { posted: true } });
            } catch (err) {
                setError(err?.response?.data?.message || 'Could not confirm your payment.');
            }
        };
        confirm();
    }, []);

    return (
        <Container maxWidth="xs" sx={{ py: 8, textAlign: 'center' }}>
            <Paper variant="outlined" sx={{ p: 4 }}>
                {error ? (
                    <Alert severity="error">{error}</Alert>
                ) : (
                    <>
                        <CircularProgress sx={{ mb: 2 }} />
                        <Typography>Confirming your payment...</Typography>
                    </>
                )}
            </Paper>
        </Container>
    );
};

export default AdPaymentSuccess;
