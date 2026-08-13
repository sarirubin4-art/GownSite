import React from 'react';
import { Box, Typography, Stack, Divider, Chip } from '@mui/material';
import { formatUsd } from '../constants/gownOptions';

// Shopping-cart-style price breakdown for the payment-setup pages.
// When a promo lowers the fee, the original price is struck through and the
// discounted price is highlighted in the brand accent color.
const PriceSummary = ({ label, fullFee, resolvedFee, quantity = 1, durationMonths, oneTimeFee = 0 }) => {
    if (fullFee == null || resolvedFee == null) return null;

    const hasPromo = resolvedFee < fullFee;
    const total = resolvedFee * quantity;
    const fullTotal = fullFee * quantity;
    const hasOneTimeFee = oneTimeFee > 0;

    return (
        <Box
            sx={{
                textAlign: 'left',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
                p: 2,
                mb: 3
            }}
        >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: quantity > 1 ? 0.5 : 0 }}>
                <Typography variant="body2" color="text.secondary">
                    {label}{quantity > 1 ? ` (${formatUsd(resolvedFee)} each)` : ''}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="baseline">
                    {hasPromo && (
                        <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                            {formatUsd(fullFee)}
                        </Typography>
                    )}
                    <Typography variant="body1" sx={{ fontWeight: 700, color: hasPromo ? 'primary.dark' : 'text.primary' }}>
                        {formatUsd(resolvedFee)}
                    </Typography>
                </Stack>
            </Stack>

            {quantity > 1 && (
                <Typography variant="caption" color="text.secondary" display="block">
                    × {quantity}
                </Typography>
            )}

            {hasOneTimeFee && (
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.75 }}>
                    <Typography variant="body2" color="text.secondary">One-Time Posting Fee</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>{formatUsd(oneTimeFee)}</Typography>
                </Stack>
            )}

            <Divider sx={{ my: 1.25 }} />

            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {hasOneTimeFee ? 'Total for Your First Month' : 'Total / month'}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="baseline">
                    {hasPromo && quantity > 1 && (
                        <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                            {formatUsd(fullTotal)}
                        </Typography>
                    )}
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: hasPromo ? 'primary.dark' : 'text.primary' }}>
                        {formatUsd(total + oneTimeFee)}
                    </Typography>
                </Stack>
            </Stack>

            {hasOneTimeFee && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    then {formatUsd(total)}/month after
                </Typography>
            )}

            {hasPromo && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25 }}>
                    <Chip label="Promo applied" size="small" color="primary" variant="outlined" />
                    {durationMonths ? (
                        <Typography variant="caption" color="text.secondary">
                            for your first {durationMonths} month{durationMonths === 1 ? '' : 's'}, then {formatUsd(fullFee)}/mo
                        </Typography>
                    ) : null}
                </Stack>
            )}

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.25 }}>
                You won't be charged until it's approved and goes live.
            </Typography>
        </Box>
    );
};

export default PriceSummary;
