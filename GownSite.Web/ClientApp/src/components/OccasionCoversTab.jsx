import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Box, Typography, Paper, Chip, Button, CircularProgress, Alert, Stack } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { styleLabel } from '../constants/gownOptions';

// Admin "Home Page" tab: choose which gown's photo represents each "Shop by occasion" tile
// on the home page. Only live, unsold gowns tagged with that occasion are offered. A pick
// that later sells or is removed quietly falls back to the automatic newest-gown photo.
const OccasionCoversTab = ({ laneSx }) => {
    const [choices, setChoices] = useState(null);
    const [savingStyle, setSavingStyle] = useState(null);
    const [error, setError] = useState('');

    const load = () => axios.get('/api/admin/occasion-covers')
        .then(({ data }) => setChoices(data))
        .catch(() => setError('Couldn’t load the occasion photos.'));

    useEffect(() => { load(); }, []);

    const setCover = async (style, gownId) => {
        setSavingStyle(style);
        setError('');
        try {
            await axios.post('/api/admin/occasion-covers', { style, gownId });
            await load();
        } catch (err) {
            setError(err?.response?.data?.message || 'Couldn’t save that choice.');
            await load();
        } finally {
            setSavingStyle(null);
        }
    };

    if (!choices) {
        return error
            ? <Alert severity="error" sx={{ mr: laneSx }}>{error}</Alert>
            : <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ mr: laneSx }}>
            <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
                Choose the photo shown for each occasion in the home page’s “Shop by” section. Click a gown to
                use its photo. On “Automatic”, the newest gown in that occasion is shown, and a chosen gown that
                sells or is taken down goes back to automatic on its own.
            </Typography>
            {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
            {choices.length === 0 && (
                <Typography color="text.secondary">No occasion has any available gowns right now.</Typography>
            )}
            <Stack spacing={2.5}>
                {choices.map((c) => (
                    <Paper key={c.style} variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, opacity: savingStyle === c.style ? 0.6 : 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
                            <Typography variant="h6" sx={{ fontFamily: `'Playfair Display', serif` }}>{styleLabel(c.style)}</Typography>
                            <Chip
                                size="small"
                                label={c.isPicked ? 'Your pick' : 'Automatic'}
                                color={c.isPicked ? 'primary' : 'default'}
                                variant={c.isPicked ? 'filled' : 'outlined'}
                            />
                            <Typography variant="body2" color="text.secondary">
                                {c.candidates.length} {c.candidates.length === 1 ? 'gown' : 'gowns'}
                            </Typography>
                            <Box sx={{ flexGrow: 1 }} />
                            {c.isPicked && (
                                <Button size="small" onClick={() => setCover(c.style, null)} disabled={savingStyle === c.style}>
                                    Go back to automatic
                                </Button>
                            )}
                        </Box>
                        {/* Padding keeps the selected photo's offset outline from being clipped
                            by the scrolling row's edges. */}
                        <Box sx={{ display: 'flex', gap: 1.75, overflowX: 'auto', p: 0.75, pb: 1, mx: -0.75 }}>
                            {c.candidates.map((g) => {
                                const shown = g.gownId === c.shownGownId;
                                return (
                                    <Box
                                        key={g.gownId}
                                        component="button"
                                        type="button"
                                        title={[g.brand, g.description].filter(Boolean).join(' · ')}
                                        disabled={savingStyle === c.style}
                                        onClick={() => { if (!(shown && c.isPicked)) setCover(c.style, g.gownId); }}
                                        sx={{
                                            position: 'relative', flex: '0 0 auto', width: 104, p: 0, border: 0, background: 'none',
                                            cursor: 'pointer', textAlign: 'left'
                                        }}
                                    >
                                        <Box sx={{
                                            width: 104, height: 130, borderRadius: 2, overflow: 'hidden', bgcolor: 'background.default',
                                            outline: shown ? '3px solid' : '1px solid',
                                            outlineColor: shown ? 'primary.main' : 'divider',
                                            outlineOffset: shown ? 2 : 0,
                                            transition: 'outline-color 0.15s',
                                            '&:hover': { outlineColor: 'primary.light' }
                                        }}>
                                            <Box component="img" src={g.imageUrl} alt="" loading="lazy" sx={{
                                                width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', display: 'block'
                                            }} />
                                        </Box>
                                        {shown && (
                                            <CheckCircleIcon sx={{
                                                position: 'absolute', top: 6, right: 6, color: 'primary.main',
                                                bgcolor: '#fff', borderRadius: '50%', fontSize: 22
                                            }} />
                                        )}
                                        <Typography variant="caption" color="text.secondary" sx={{
                                            display: 'block', mt: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                        }}>
                                            {g.brand || g.description || `Gown #${g.gownId}`}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Paper>
                ))}
            </Stack>
        </Box>
    );
};

export default OccasionCoversTab;
