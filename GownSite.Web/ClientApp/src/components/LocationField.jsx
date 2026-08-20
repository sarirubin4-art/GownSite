import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { TextField, MenuItem, Stack } from '@mui/material';
import { LOCATION_PRESETS } from '../constants/gownOptions';

const OTHER_VALUE = '__other__';

// A closed dropdown of common Jewish-community locations plus "Other," which reveals a
// blank text field for anything else — replaces free typing so listings don't end up
// with inconsistent variants of the same place (e.g. "Brooklyn" vs "Brooklyn, NY"). Also
// pulls in every location anyone has already typed into "Other" on a real listing, so a
// custom location only ever needs to be typed once — everyone after that just picks it.
const LocationField = ({ value, onChange, label = 'Location (city/area)', size }) => {
    const [options, setOptions] = useState(LOCATION_PRESETS);

    useEffect(() => {
        axios.get('/api/gown/locations').then(({ data }) => {
            setOptions((prev) => Array.from(new Set([...LOCATION_PRESETS, ...data])).sort());
        }).catch(() => {});
    }, []);

    const isPreset = options.includes(value);
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
                {options.map((loc) => <MenuItem key={loc} value={loc}>{loc}</MenuItem>)}
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
