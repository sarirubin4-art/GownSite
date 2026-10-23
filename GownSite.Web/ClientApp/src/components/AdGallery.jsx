import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import ImageZoomDialog from './ImageZoomDialog';

// An ad's optional Photo Gallery (Ad.MorePictures) — a grid of square thumbnails that
// open full-size on click. Used on the ad details page and the posting form's preview.
const AdGallery = ({ urls }) => {
    const [zoomIndex, setZoomIndex] = useState(null);
    return (
        <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 1.5 }}>Photo Gallery</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1 }}>
                {urls.map((url, i) => (
                    <Box
                        key={url} component="img" src={url} alt="" onClick={() => setZoomIndex(i)}
                        sx={{
                            width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 1.5,
                            display: 'block', cursor: 'zoom-in', bgcolor: 'background.paper'
                        }}
                    />
                ))}
            </Box>
            <ImageZoomDialog
                open={zoomIndex !== null}
                onClose={() => setZoomIndex(null)}
                images={urls}
                initialIndex={zoomIndex ?? 0}
            />
        </Box>
    );
};

export default AdGallery;
