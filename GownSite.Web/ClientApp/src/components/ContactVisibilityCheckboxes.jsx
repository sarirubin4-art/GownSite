import React from 'react';
import { FormControlLabel, Checkbox, FormGroup, Typography, Stack } from '@mui/material';

// Lets a gown/ad poster choose which contact channels show to someone who reaches out —
// reused across every posting form and edit dialog on the site so the control looks and
// behaves identically everywhere. At least one must stay checked; this only renders the
// inline warning — callers still need their own submit-time "at least one" guard.
const ContactVisibilityCheckboxes = ({ showName, showPhone, showEmail, onChange, subjectLabel = 'my' }) => {
    const toggle = (key) => (e) => {
        onChange({
            showName: key === 'showName' ? e.target.checked : !!showName,
            showPhone: key === 'showPhone' ? e.target.checked : !!showPhone,
            showEmail: key === 'showEmail' ? e.target.checked : !!showEmail
        });
    };
    const noneSelected = !showName && !showPhone && !showEmail;

    return (
        <Stack spacing={0.5}>
            <Typography variant="body2">
                When someone reaches out, show them {subjectLabel}:
            </Typography>
            <FormGroup row>
                <FormControlLabel control={<Checkbox checked={!!showName} onChange={toggle('showName')} />} label="Name" />
                <FormControlLabel control={<Checkbox checked={!!showPhone} onChange={toggle('showPhone')} />} label="Phone" />
                <FormControlLabel control={<Checkbox checked={!!showEmail} onChange={toggle('showEmail')} />} label="Email" />
            </FormGroup>
            {noneSelected && (
                <Typography variant="caption" color="error">
                    Choose at least one way for people to contact you.
                </Typography>
            )}
        </Stack>
    );
};

export default ContactVisibilityCheckboxes;
