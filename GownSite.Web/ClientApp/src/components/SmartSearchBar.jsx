import React, { useEffect, useMemo, useState } from 'react';
import { Box, InputBase, Button, Typography, useMediaQuery } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { LOCATION_PRESETS } from '../constants/gownOptions';
import { parseSearchQuery, describeParsed } from '../utils/parseSearchQuery';
import { loadLocations } from '../utils/locations';

// Free-text gown search. As the shopper types, a quiet line underneath shows how their
// words are being read ("Blue · Size 2 · Sister of the Bride/Groom"), so there are no
// surprises when they land on the results. onSearch receives the parsed filters and the
// raw text.
const SmartSearchBar = ({ initialText = '', onSearch, large = false, placeholder }) => {
    const [text, setText] = useState(initialText);
    const [locations, setLocations] = useState(LOCATION_PRESETS);
    // The example placeholder gets cut off on a phone — use a short prompt there instead.
    const narrow = useMediaQuery((theme) => theme.breakpoints.down('sm'));

    // The parser needs the marketplace's real location values to recognize "lakewood"
    // as "Lakewood, NJ".
    useEffect(() => {
        loadLocations().then((data) => setLocations([...new Set([...data, ...LOCATION_PRESETS])]));
    }, []);
    useEffect(() => { setText(initialText); }, [initialText]);

    const parsed = useMemo(() => parseSearchQuery(text, locations), [text, locations]);
    const understood = text.trim() ? describeParsed(parsed) : [];

    const submit = (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        // Even with nothing recognizable ("pretty dress") the search still goes through —
        // it just lands on every gown rather than the button seeming to do nothing.
        onSearch(parsed, text.trim());
    };

    return (
        <Box component="form" onSubmit={submit} sx={{ width: '100%' }} role="search">
            <Box sx={{
                display: 'flex', alignItems: 'center',
                bgcolor: 'background.paper',
                border: '1px solid rgba(156, 78, 88, 0.25)',
                borderRadius: 999,
                pl: large ? 3 : 2, pr: 0.75, py: 0.75,
                boxShadow: large ? '0 10px 40px rgba(198, 113, 122, 0.16)' : 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                '&:focus-within': {
                    borderColor: 'primary.main',
                    boxShadow: large ? '0 10px 40px rgba(198, 113, 122, 0.24)' : '0 0 0 3px rgba(198, 113, 122, 0.12)'
                }
            }}>
                <SearchIcon sx={{ color: 'text.secondary', mr: 1.5, fontSize: large ? 24 : 20 }} />
                <InputBase
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={narrow || !placeholder ? 'Describe your dream dress' : placeholder}
                    inputProps={{ 'aria-label': 'Search gowns', enterKeyHint: 'search' }}
                    sx={{ flex: 1, fontSize: large ? { xs: '1rem', sm: '1.1rem' } : '0.95rem', py: large ? 0.75 : 0.25 }}
                />
                <Button
                    type="submit"
                    variant="contained"
                    disableElevation
                    sx={{ px: large ? { xs: 2.5, sm: 4 } : 2.5, py: large ? 1.25 : 0.75, flexShrink: 0 }}
                >
                    Search
                </Button>
            </Box>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                    mt: 1.25, minHeight: '1.5em', px: large ? 3 : 2, textAlign: 'left',
                    opacity: understood.length > 0 ? 1 : 0, transition: 'opacity 0.2s'
                }}
                aria-live="polite"
            >
                {understood.length > 0 && (
                    <>
                        <Box component="span" sx={{ letterSpacing: 1.5, textTransform: 'uppercase', fontSize: '0.7rem', mr: 1 }}>
                            Searching for
                        </Box>
                        {understood.join('  ·  ')}
                    </>
                )}
            </Typography>
        </Box>
    );
};

export default SmartSearchBar;
