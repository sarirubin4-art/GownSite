import React, { useEffect, useState } from 'react';
import { Box, Typography, Stack, TextField, Button } from '@mui/material';

// Bordered "Apply a Promo Code" box, reused everywhere a promo can be applied to an
// already-created gown/ad (owner's My Listings/My Ads, admin's edit dialogs, and the
// checkout/payment-setup screens). Pre-fills from currentPromoCode whenever one is already
// applied, so it's immediately apparent rather than the box looking empty/unset.
const PromoApplyBox = ({ currentPromoCode, onApply, applying, message, title = 'Apply a Promo Code' }) => {
    const [input, setInput] = useState(currentPromoCode || '');

    // Re-sync when the caller's data reloads (e.g. right after a successful apply, or
    // when a different listing's dialog opens) — but not on every keystroke, since this
    // only re-runs when the prop itself changes.
    useEffect(() => {
        setInput(currentPromoCode || '');
    }, [currentPromoCode]);

    return (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
            <Typography variant="subtitle2">{title}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {currentPromoCode
                    ? 'A promo is already applied — entering a different code replaces it.'
                    : 'Have a code? Enter it here.'}
            </Typography>
            {message && (
                <Typography variant="caption" color={message.type === 'error' ? 'error' : 'primary.main'} sx={{ display: 'block', mb: 1 }}>
                    {message.text}
                </Typography>
            )}
            <Stack direction="row" spacing={1}>
                <TextField
                    size="small" label="Promo Code" value={input}
                    onChange={(e) => setInput(e.target.value)}
                    fullWidth
                />
                <Button
                    variant="outlined" disabled={applying || !input.trim()}
                    onClick={() => onApply(input.trim())}
                >
                    {applying ? 'Applying...' : 'Apply'}
                </Button>
            </Stack>
        </Box>
    );
};

export default PromoApplyBox;
