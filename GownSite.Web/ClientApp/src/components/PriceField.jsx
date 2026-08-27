import React, { useState } from 'react';
import { Box, Stack, TextField, Button } from '@mui/material';

// A single price field by default — an exact price is the common case. Clicking "Use a
// price range" reveals a second field for owners who haven't settled on one number yet;
// deliberately opt-in (not the default) since a range is the unusual case, not the norm.
const PriceField = ({ price, priceMax, onPriceChange, onPriceMaxChange, size, label = 'Price' }) => {
    const [isRange, setIsRange] = useState(!!priceMax);

    const toggleRange = () => {
        if (isRange) onPriceMaxChange('');
        setIsRange((prev) => !prev);
    };

    return (
        <Box>
            <Stack direction={{ xs: 'column', sm: isRange ? 'row' : 'column' }} spacing={1}>
                <TextField
                    label={isRange ? `${label} From` : label} type="number" fullWidth size={size}
                    value={price} onChange={(e) => onPriceChange(e.target.value)}
                    slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                />
                {isRange && (
                    <TextField
                        label={`${label} To`} type="number" fullWidth size={size}
                        value={priceMax} onChange={(e) => onPriceMaxChange(e.target.value)}
                        slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                    />
                )}
            </Stack>
            <Button size="small" onClick={toggleRange} sx={{ mt: 0.5, ml: -1 }}>
                {isRange ? 'Use an exact price instead' : "Not sure yet? Use a price range"}
            </Button>
        </Box>
    );
};

export default PriceField;
