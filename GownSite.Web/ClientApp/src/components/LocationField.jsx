import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { TextField, MenuItem, Stack, Box, Typography } from '@mui/material';
import { LOCATION_PRESETS } from '../constants/gownOptions';

const OTHER_VALUE = '__other__';
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Loads the Google Maps JS SDK (places library) at most once per page, regardless of
// how many LocationFields mount. Resolves immediately if it's already loaded/loading.
let mapsLoadPromise = null;
const loadGoogleMaps = () => {
    if (!MAPS_API_KEY) return Promise.reject(new Error('No Maps API key configured'));
    if (window.google?.maps?.places?.PlaceAutocompleteElement) return Promise.resolve();
    if (mapsLoadPromise) return mapsLoadPromise;

    mapsLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places&loading=async`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Maps'));
        document.head.appendChild(script);
    });
    return mapsLoadPromise;
};

// Turns a Google Place result into the same "City, ST" shorthand as our existing
// presets (e.g. "Brooklyn, NY", "Toronto, ON") instead of a full street address, since
// this field is deliberately city/area-level, not a precise address.
const formatPlace = (place) => {
    const comps = place.addressComponents || [];
    const find = (type) => comps.find((c) => c.types.includes(type));
    const city = find('locality') || find('postal_town') || find('sublocality');
    const state = find('administrative_area_level_1');
    const country = find('country');
    if (city && state) return `${city.longText}, ${state.shortText}`;
    if (city && country) return `${city.longText}, ${country.shortText}`;
    return place.formattedAddress || '';
};

// A closed dropdown of common Jewish-community locations plus "Other," which reveals a
// real address search (Google Places) for anything else, so a custom location comes out
// correctly spelled and consistently formatted instead of however someone happened to
// type it — falls back to plain free typing if a Maps key isn't configured or the script
// fails to load. Also pulls in every location anyone has already resolved via "Other" on
// a real listing, so a custom location only ever needs to be resolved once — everyone
// after that just picks it from the dropdown.
const LocationField = ({ value, onChange, label = 'Location (city/area)', size }) => {
    const [options, setOptions] = useState(LOCATION_PRESETS);
    const [placesReady, setPlacesReady] = useState(false);
    const otherContainerRef = useRef(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

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

    // Builds and mounts the Places search widget into otherContainerRef once it's on
    // screen. It's a self-contained custom element (own shadow DOM), so it's created
    // imperatively rather than through JSX.
    useEffect(() => {
        if (!otherActive || !otherContainerRef.current) return;
        let cancelled = false;
        let element = null;
        let listener = null;

        loadGoogleMaps().then(() => {
            if (cancelled || !otherContainerRef.current) return;
            element = new window.google.maps.places.PlaceAutocompleteElement({
                includedPrimaryTypes: ['locality', 'postal_town', 'administrative_area_level_3']
            });
            element.style.width = '100%';
            if (value) element.placeholder = value;
            otherContainerRef.current.appendChild(element);

            listener = element.addEventListener('gmp-select', async ({ placePrediction }) => {
                const place = placePrediction.toPlace();
                await place.fetchFields({ fields: ['addressComponents', 'formattedAddress'] });
                const formatted = formatPlace(place);
                if (formatted) onChangeRef.current(formatted);
            });
            setPlacesReady(true);
        }).catch(() => {
            // No key configured, or the script failed to load — the field just stays a
            // plain text box below, same as before Places was wired in.
        });

        return () => {
            cancelled = true;
            setPlacesReady(false);
            if (element?.parentNode) element.parentNode.removeChild(element);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [otherActive]);

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
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Search for your city
                    </Typography>
                    <Box
                        ref={otherContainerRef}
                        sx={{
                            '& gmp-place-autocomplete': {
                                width: '100%',
                                '--gmpx-font-family': 'inherit',
                                '--gmpx-font-size': '16px'
                            }
                        }}
                    />
                    <TextField
                        label={placesReady ? "Not in the list above? Type it manually" : "Enter your location"}
                        fullWidth size={size} sx={{ mt: 1 }}
                        value={value} onChange={(e) => onChange(e.target.value)}
                        helperText={placesReady ? undefined : "Loading location search... you can also just type it in."}
                    />
                </Box>
            )}
        </Stack>
    );
};

export default LocationField;
