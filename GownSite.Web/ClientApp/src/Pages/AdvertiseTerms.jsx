import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Container, Typography, Button, Stack, Box, Paper,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import useFullScreenDialog from '../hooks/useFullScreenDialog';

const AdvertiseTerms = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();
    const fullScreen = useFullScreenDialog();

    const [gemachOpen, setGemachOpen] = useState(false);
    const [gemachMessage, setGemachMessage] = useState('');
    const [gemachSending, setGemachSending] = useState(false);
    const [gemachSent, setGemachSent] = useState(false);
    const [gemachError, setGemachError] = useState('');

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/advertise/terms');
        }
    }, [loading, owner]);

    const onOpenGemach = () => {
        setGemachMessage('');
        setGemachError('');
        setGemachSent(false);
        setGemachOpen(true);
    };

    const onSendGemach = async () => {
        if (!gemachMessage.trim()) {
            setGemachError('Please enter a message.');
            return;
        }
        setGemachError('');
        setGemachSending(true);
        try {
            await axios.post('/api/contact/business-inquiry', {
                message: gemachMessage,
                topic: 'Gemach free advertising inquiry'
            });
            setGemachSent(true);
        } catch (err) {
            setGemachError(err?.response?.data?.message || 'Could not send your message.');
        } finally {
            setGemachSending(false);
        }
    };

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
                <Button variant="text" size="small" onClick={onOpenGemach} sx={{ px: 0 }}>
                    Are you a gemach? Advertise for free!
                </Button>
            </Typography>

            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
                <Button variant="text" onClick={() => navigate('/')}>Cancel</Button>
                <Button variant="contained" onClick={() => navigate('/advertise/form')}>Agree &amp; Continue</Button>
            </Stack>

            <Dialog open={gemachOpen} onClose={() => setGemachOpen(false)} maxWidth="sm" fullWidth fullScreen={fullScreen}>
                <DialogTitle>Free Gemach Advertising</DialogTitle>
                <DialogContent>
                    {gemachSent ? (
                        <Alert severity="success" sx={{ mt: 1 }}>Thanks! We'll be in touch soon.</Alert>
                    ) : (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                Tell me a little about your gemach and how it works, to see if you qualify for free advertising — we'll follow up by email.
                            </Typography>
                            {gemachError && <Alert severity="error">{gemachError}</Alert>}
                            <TextField
                                label="Message" value={gemachMessage} onChange={(e) => setGemachMessage(e.target.value)}
                                fullWidth multiline rows={4} autoFocus
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setGemachOpen(false)}>{gemachSent ? 'Close' : 'Cancel'}</Button>
                    {!gemachSent && (
                        <Button variant="contained" onClick={onSendGemach} disabled={gemachSending}>
                            {gemachSending ? 'Sending...' : 'Send'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default AdvertiseTerms;
