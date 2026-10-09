import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, TextField, Button, Stack, Paper, Alert } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import useFormError from '../hooks/useFormError';

// Where ConfirmEmailChange (OwnerController) sends the patron back after they click the
// link in their confirmation email, keyed by the ?emailChange= value it adds.
const EMAIL_CHANGE_OUTCOMES = {
    done: { severity: 'success', text: (owner) => `Your email has been changed to ${owner.email}. Use it the next time you log in.` },
    invalid: { severity: 'error', text: () => 'That confirmation link is invalid or has expired. Please request a new one below.' },
    taken: { severity: 'error', text: () => 'That email address is already used by another account.' }
};

// Each section is its own small form with its own Save button and messages, so saving a
// new phone number never also tries to change the password, and an error in one section
// doesn't hide or block the others. No Enter-to-submit here, on purpose — account changes
// should only happen on an explicit button click.
const Account = () => {
    usePageTitle('My Account');
    const { owner, loading, refresh } = useAuth();
    const navigate = useNavigate();
    const routerLocation = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [emailChangeOutcome] = useState(searchParams.get('emailChange'));

    const [details, setDetails] = useState({ name: '', number: '' });
    const [detailsError, setDetailsError, detailsErrorRef] = useFormError();
    const [detailsSaved, setDetailsSaved] = useState(false);
    const [detailsSaving, setDetailsSaving] = useState(false);

    const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' });
    const [emailError, setEmailError, emailErrorRef] = useFormError();
    const [emailSentTo, setEmailSentTo] = useState('');
    const [emailSending, setEmailSending] = useState(false);

    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordError, setPasswordError, passwordErrorRef] = useFormError();
    const [passwordSaved, setPasswordSaved] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);

    useEffect(() => {
        if (!loading && !owner) {
            // Keeps ?emailChange=... so someone who clicks their confirmation link while
            // logged out still sees the outcome after logging in.
            navigate(`/login?redirect=${encodeURIComponent(routerLocation.pathname + routerLocation.search)}`);
        }
    }, [loading, owner]);

    useEffect(() => {
        if (owner) setDetails({ name: owner.name || '', number: owner.number || '' });
    }, [owner?.id]);

    // The outcome is captured in state above, so the query string can be cleaned up
    // without losing the message — a reload or bookmark shouldn't replay it. Waits until
    // logged in: when logged out, the redirect above needs it to carry through to login.
    useEffect(() => {
        if (owner && searchParams.get('emailChange')) setSearchParams({}, { replace: true });
    }, [owner?.id]);

    if (loading || !owner) return null;

    const onSaveDetails = async () => {
        setDetailsError('');
        setDetailsSaved(false);
        if (!details.name.trim() || !details.number.trim()) {
            setDetailsError('Name and phone number are required.');
            return;
        }
        if ((details.number.match(/\d/g) || []).length < 10) {
            setDetailsError('Please enter a valid phone number.');
            return;
        }
        setDetailsSaving(true);
        try {
            await axios.post('/api/owner/update-profile', { name: details.name, number: details.number });
            await refresh();
            setDetailsSaved(true);
        } catch (err) {
            setDetailsError(err?.response?.data?.message || 'Could not save your details.');
        } finally {
            setDetailsSaving(false);
        }
    };

    const onSendEmailChange = async () => {
        setEmailError('');
        setEmailSentTo('');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailForm.newEmail.trim())) {
            setEmailError('Please enter a valid email address.');
            return;
        }
        if (!emailForm.currentPassword) {
            setEmailError('Please enter your current password.');
            return;
        }
        setEmailSending(true);
        try {
            await axios.post('/api/owner/change-email', { newEmail: emailForm.newEmail.trim(), currentPassword: emailForm.currentPassword });
            setEmailSentTo(emailForm.newEmail.trim());
            setEmailForm({ newEmail: '', currentPassword: '' });
        } catch (err) {
            setEmailError(err?.response?.data?.message || 'Could not send the confirmation email.');
        } finally {
            setEmailSending(false);
        }
    };

    const onChangePassword = async () => {
        setPasswordError('');
        setPasswordSaved(false);
        if (!passwordForm.currentPassword) {
            setPasswordError('Please enter your current password.');
            return;
        }
        if (passwordForm.newPassword.length < 8) {
            setPasswordError('New password must be at least 8 characters.');
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError('New passwords do not match.');
            return;
        }
        setPasswordSaving(true);
        try {
            await axios.post('/api/owner/change-password', {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setPasswordSaved(true);
        } catch (err) {
            setPasswordError(err?.response?.data?.message || 'Could not change your password.');
        } finally {
            setPasswordSaving(false);
        }
    };

    const outcome = EMAIL_CHANGE_OUTCOMES[emailChangeOutcome];

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom>My Account</Typography>
            {outcome && <Alert severity={outcome.severity} sx={{ mb: 2 }}>{outcome.text(owner)}</Alert>}
            {!owner.emailVerified && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Your email isn't verified yet. If <strong>{owner.email}</strong> is wrong, change it below —
                    confirming the new address also verifies your account.
                </Alert>
            )}

            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Your Details</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Your name and phone number are what interested buyers, renters, and customers see
                    when they reach out about your listings (if you've chosen to show them).
                </Typography>
                <Stack spacing={2}>
                    {detailsError && <Alert ref={detailsErrorRef} severity="error">{detailsError}</Alert>}
                    {detailsSaved && <Alert severity="success">Your details have been saved.</Alert>}
                    <TextField label="Name" value={details.name} fullWidth
                        onChange={(e) => { setDetailsSaved(false); setDetails({ ...details, name: e.target.value }); }} />
                    <TextField label="Phone Number" value={details.number} fullWidth
                        onChange={(e) => { setDetailsSaved(false); setDetails({ ...details, number: e.target.value }); }} />
                    <Button variant="contained" onClick={onSaveDetails} disabled={detailsSaving} sx={{ alignSelf: 'flex-start' }}>
                        {detailsSaving ? 'Saving...' : 'Save Details'}
                    </Button>
                </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Email</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Current email: <strong>{owner.email}</strong>. We'll send a confirmation link to the new
                    address — your email only changes once you click it.
                </Typography>
                <Stack spacing={2}>
                    {emailError && <Alert ref={emailErrorRef} severity="error">{emailError}</Alert>}
                    {emailSentTo && (
                        <Alert severity="success">
                            We sent a confirmation link to <strong>{emailSentTo}</strong>. Click it within 24 hours to finish changing your email.
                        </Alert>
                    )}
                    <TextField label="New Email" type="email" value={emailForm.newEmail} fullWidth
                        onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })} />
                    <TextField label="Current Password" type="password" value={emailForm.currentPassword} fullWidth
                        autoComplete="current-password"
                        onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })} />
                    <Button variant="contained" onClick={onSendEmailChange} disabled={emailSending} sx={{ alignSelf: 'flex-start' }}>
                        {emailSending ? 'Sending...' : 'Send Confirmation Link'}
                    </Button>
                </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Password</Typography>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {passwordError && <Alert ref={passwordErrorRef} severity="error">{passwordError}</Alert>}
                    {passwordSaved && <Alert severity="success">Your password has been changed.</Alert>}
                    <TextField label="Current Password" type="password" value={passwordForm.currentPassword} fullWidth
                        autoComplete="current-password"
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
                    <TextField label="New Password" type="password" value={passwordForm.newPassword} fullWidth
                        autoComplete="new-password" helperText="At least 8 characters."
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
                    <TextField label="Confirm New Password" type="password" value={passwordForm.confirmPassword} fullWidth
                        autoComplete="new-password"
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
                    <Button variant="contained" onClick={onChangePassword} disabled={passwordSaving} sx={{ alignSelf: 'flex-start' }}>
                        {passwordSaving ? 'Saving...' : 'Change Password'}
                    </Button>
                </Stack>
            </Paper>
        </Container>
    );
};

export default Account;
