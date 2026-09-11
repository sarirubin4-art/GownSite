import React from 'react';
import { Autocomplete, TextField } from '@mui/material';

// Multi-select field: stays open after each pick (instead of closing and forcing
// you to reopen it for the next selection), and shows "All"/helper text as a
// placeholder once the label shrinks out of the way, so it's clear multiple
// values can be chosen. Used for every Color/Size/filter dropdown in the app.
const FilterAutocomplete = ({ label, options, value, onChange, getOptionLabel, size = 'small', placeholder, helperText, ...rest }) => (
    <Autocomplete
        multiple size={size} disableCloseOnSelect
        options={options} value={value} onChange={onChange}
        getOptionLabel={getOptionLabel}
        renderInput={(params) => (
            <TextField
                {...params}
                label={label}
                helperText={helperText}
                placeholder={value.length === 0 ? (placeholder ?? 'All') : undefined}
                slotProps={{ ...params.slotProps, inputLabel: { ...params.slotProps?.inputLabel, shrink: true } }}
            />
        )}
        {...rest}
    />
);

export default FilterAutocomplete;
