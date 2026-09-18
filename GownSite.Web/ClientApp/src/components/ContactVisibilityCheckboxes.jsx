import React from 'react';
import { FormControlLabel, Checkbox, FormGroup, Typography, Stack } from '@mui/material';

// Lets a gown/ad poster choose which contact channels show to someone who reaches out —
// reused across every posting form and edit dialog on the site so the control looks and
// behaves identically everywhere. Name alone isn't a way to actually reach someone, so
// requireReachableChannel (ads only — gowns keep the original "any of the three" rule)
// requires phone or email specifically; Name can still be checked alongside them, it just
// doesn't satisfy the requirement by itself. This only renders the inline warning —
// callers still need their own submit-time guard using the same condition.
const ContactVisibilityCheckboxes = ({ showName, showPhone, showEmail, onChange, subjectLabel = 'my', requireReachableChannel = false }) => {
    const toggle = (key) => (e) => {
        onChange({
            showName: key === 'showName' ? e.target.checked : !!showName,
            showPhone: key === 'showPhone' ? e.target.checked : !!showPhone,
            showEmail: key === 'showEmail' ? e.target.checked : !!showEmail
        });
    };
    const noneSelected = requireReachableChannel ? (!showPhone && !showEmail) : (!showName && !showPhone && !showEmail);

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
                    {requireReachableChannel
                        ? 'Choose a phone number or email so people can actually reach you.'
                        : 'Choose at least one way for people to contact you.'}
                </Typography>
            )}
        </Stack>
    );
};

export default ContactVisibilityCheckboxes;
