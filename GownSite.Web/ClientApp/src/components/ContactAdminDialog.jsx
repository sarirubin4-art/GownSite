import React, { useState } from 'react';
import axios from 'axios';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Typography, Alert
} from '@mui/material';
import useFullScreenDialog from '../hooks/useFullScreenDialog';

// Shared submit-a-message-to-the-admin dialog, used by every "contact the admin" entry
// point on the site (bulk discount inquiry, gemach free advertising, general Contact Us).
// All of them post to the same endpoint and only differ in title/topic/prompt copy.
const ContactAdminDialog = ({ open, onClose, topic, title, promptText }) => {
    const fullScreen = useFullScreenDialog();
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleClose = () => {
        onClose();
        setMessage('');
        setSending(false);
        setSent(false);
        setError('');
    };

    const onSend = async () => {
        if (!message.trim()) {
            setError('Please enter a message.');
            return;
        }
        setError('');
        setSending(true);
        try {
            await axios.post('/api/contact/business-inquiry', { message, topic });
            setSent(true);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not send your message.');
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                {sent ? (
                    <Alert severity="success" sx={{ mt: 1 }}>Thanks! We'll be in touch soon.</Alert>
                ) : (
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            {promptText}
                        </Typography>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label="Message" value={message} onChange={(e) => setMessage(e.target.value)}
                            fullWidth multiline rows={4} autoFocus
                        />
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                {sent ? (
                    <Button onClick={handleClose}>Close</Button>
                ) : (
                    <>
                        <Button onClick={handleClose}>Cancel</Button>
                        <Button variant="contained" onClick={onSend} disabled={sending}>
                            {sending ? 'Sending...' : 'Send'}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default ContactAdminDialog;
