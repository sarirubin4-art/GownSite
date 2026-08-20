import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

export const MAX_MORE_PICTURES = 5;

const Thumb = ({ src, onRemove }) => (
    <Box sx={{ position: 'relative' }}>
        <Box component="img" src={src} alt="" sx={{
            width: 64, height: 64, borderRadius: 1, objectFit: 'cover',
            border: '1px solid', borderColor: 'divider'
        }} />
        <IconButton
            size="small"
            onClick={onRemove}
            sx={{
                position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper',
                border: '1px solid', borderColor: 'divider',
                '&:hover': { bgcolor: 'error.main', color: 'error.contrastText' }
            }}
        >
            <DeleteIcon fontSize="inherit" />
        </IconButton>
    </Box>
);

// Additional-photos picker used everywhere a gown's MorePictures can be edited (new
// listing forms, bulk posting, post-for-patron, and the owner/admin edit dialogs).
// New files are additive (picking more never drops what's already staged) and every
// photo — staged or already-saved — gets its own X to remove just that one, the same
// interaction style as the Style Tags checkboxes.
//
// `files` / `onFilesChange`: staged File objects not yet uploaded (always used).
// `existing` / `onRemoveExisting`: already-saved pictures ({id, url}), only passed by
// edit dialogs — omitted entirely for brand-new listings, which have none yet.
const MorePicturesInput = ({ files, onFilesChange, existing = [], onRemoveExisting, max = MAX_MORE_PICTURES }) => {
    const [error, setError] = useState('');
    const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
    useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

    const totalCount = existing.length + files.length;

    const onInputChange = (e) => {
        const chosen = Array.from(e.target.files);
        const room = Math.max(max - totalCount, 0);
        const accepted = chosen.slice(0, room);
        if (chosen.length > accepted.length) {
            setError(`You can have up to ${max} additional photos total — only ${accepted.length} more were added.`);
        } else {
            setError('');
        }
        if (accepted.length > 0) onFilesChange([...files, ...accepted]);
        e.target.value = '';
    };

    const removeNewFile = (index) => {
        onFilesChange(files.filter((_, i) => i !== index));
    };

    return (
        <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Additional Photos</Typography>
            {(existing.length > 0 || files.length > 0) && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                    {existing.map((p) => (
                        <Thumb key={`existing-${p.id}`} src={p.url} onRemove={() => onRemoveExisting(p.id)} />
                    ))}
                    {previews.map((src, i) => (
                        <Thumb key={`new-${i}`} src={src} onRemove={() => removeNewFile(i)} />
                    ))}
                </Stack>
            )}
            <Button variant="outlined" component="label" size="small" disabled={totalCount >= max}>
                {totalCount > 0 ? `Add More Pictures (${totalCount}/${max})` : `Add More Pictures (up to ${max}, optional)`}
                <input type="file" accept="image/*" multiple hidden onChange={onInputChange} />
            </Button>
            {error && <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>{error}</Typography>}
        </Box>
    );
};

export default MorePicturesInput;
