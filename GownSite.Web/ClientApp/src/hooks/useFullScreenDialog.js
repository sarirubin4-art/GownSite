import { useTheme, useMediaQuery } from '@mui/material';

// Dialogs default to a centered card sized around their content, which works fine on
// desktop but routinely overflows a phone's viewport (a two-column row of fields alone
// can force the dialog wider than a 375px screen). Below the 'sm' breakpoint we go
// fullScreen instead, so the dialog always fits and scrolls naturally within the screen.
const useFullScreenDialog = () => {
    const theme = useTheme();
    return useMediaQuery(theme.breakpoints.down('sm'));
};

export default useFullScreenDialog;
