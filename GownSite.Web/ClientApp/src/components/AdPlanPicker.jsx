import React from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { AD_PLANS } from '../constants/adPlans';
import { formatUsd } from '../constants/gownOptions';

// Monthly / 6-Month / Yearly choice for an ad, shown on the payment-setup and reactivation
// pages. `pricing` is the /api/payment/pricing response.
const AdPlanPicker = ({ pricing, value, onChange, disabled }) => {
    if (!pricing) return null;
    const monthly = pricing.adMonthlyFee;
    return (
        <Stack spacing={1.25} sx={{ mb: 3, textAlign: 'left' }} role="radiogroup" aria-label="Billing plan">
            {AD_PLANS.map((plan) => {
                const price = pricing[plan.priceKey];
                const selected = plan.value === value;
                const savings = monthly * plan.months - price;
                return (
                    <Box
                        key={plan.value}
                        role="radio"
                        aria-checked={selected}
                        tabIndex={0}
                        onClick={() => !disabled && onChange(plan.value)}
                        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onChange(plan.value); } }}
                        sx={{
                            p: 1.75, borderRadius: 2, cursor: disabled ? 'default' : 'pointer',
                            border: '2px solid', borderColor: selected ? 'primary.main' : 'divider',
                            bgcolor: selected ? 'background.default' : 'background.paper',
                            opacity: disabled && !selected ? 0.6 : 1
                        }}
                    >
                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{plan.label}</Typography>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {formatUsd(price)}
                                <Typography component="span" variant="body2" color="text.secondary">
                                    {plan.months === 1 ? '/month' : plan.months === 12 ? '/year' : ' / 6 months'}
                                </Typography>
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 0.25 }}>
                            <Typography variant="body2" color="text.secondary">
                                {plan.pitch}
                                {plan.months > 1 && ` · about ${formatUsd((price / plan.months).toFixed(2))}/mo, paid upfront`}
                            </Typography>
                            {savings > 0.005 && <Chip size="small" color="primary" label={`Save ${formatUsd(savings.toFixed(2))}`} />}
                        </Stack>
                    </Box>
                );
            })}
        </Stack>
    );
};

export default AdPlanPicker;
