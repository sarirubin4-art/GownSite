import React, { useEffect, useState } from 'react';
import { TextField, MenuItem, Stack } from '@mui/material';
import { LOCATION_PRESETS } from '../constants/gownOptions';

const OTHER_VALUE = '__other__';

// A closed dropdown of common Jewish-community locations plus "Other," which reveals a
// blank text field for anything else — replaces free typing so listings don't end up
// with inconsistent variants of the same place (e.g. "Brooklyn" vs "Brooklyn, NY").
const LocationField = ({ value, onChange, label = 'Location (city/area)', size }) => {
    const isPreset = LOCATION_PRESETS.includes(value);
    const [otherActive, setOtherActive] = useState(!isPreset && !!value);

    // Reflects a value set from outside (loading an existing listing, resuming a draft,
    // switching which listing is being edited). While the user is actively typing into
    // the "Other" box the value is often '' mid-edit, so an empty value alone shouldn't
    // flip this back off.
    useEffect(() => {
        if (isPreset) setOtherActive(false);
        else if (value) setOtherActive(true);
    }, [value, isPreset]);

    const selectValue = isPreset ? value : (otherActive ? OTHER_VALUE : '');

    return (
        <Stack spacing={1}>
            <TextField
                select label={label} fullWidth size={size} value={selectValue}
                onChange={(e) => {
                    const next = e.target.value;
                    if (next === OTHER_VALUE) {
                        setOtherActive(true);
                        onChange('');
                    } else {
                        setOtherActive(false);
                        onChange(next);
                    }
                }}
            >
                {LOCATION_PRESETS.map((loc) => <MenuItem key={loc} value={loc}>{loc}</MenuItem>)}
                <MenuItem value={OTHER_VALUE}>Other</MenuItem>
            </TextField>
            {otherActive && (
                <TextField
                    label="Enter your location" fullWidth size={size} autoFocus
                    value={value} onChange={(e) => onChange(e.target.value)}
                />
            )}
        </Stack>
    );
};

export default LocationField;
