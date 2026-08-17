import { createTheme } from '@mui/material/styles';

// Real floral artwork (the user's own vort-invitation design) with the paper
// background and text removed, leaving just the two corner blooms. Anchored to
// the true page corners and faded low so it reads as a soft accent, not decor
// that competes with the site's own content.
export const wallpaperBackground = {
    backgroundImage: 'url("/floral-topleft.webp"), url("/floral-bottomright.webp")',
    backgroundPosition: 'left top, right bottom',
    backgroundRepeat: 'no-repeat, no-repeat',
    backgroundSize: '320px auto, 320px auto'
};

const theme = createTheme({
    palette: {
        primary: {
            main: '#C6717A',
            light: '#E8B4BC',
            dark: '#9C4E58',
            contrastText: '#fff'
        },
        secondary: {
            main: '#D9A5A0',
            contrastText: '#fff'
        },
        background: {
            default: '#FFF6F3',
            paper: '#FFFFFF'
        },
        text: {
            primary: '#4A3439',
            secondary: '#8A6D72'
        }
    },
    typography: {
        fontFamily: `'Poppins', 'Segoe UI', sans-serif`,
        h1: { fontFamily: `'Playfair Display', serif`, fontWeight: 700 },
        h2: { fontFamily: `'Playfair Display', serif`, fontWeight: 700 },
        h3: { fontFamily: `'Playfair Display', serif`, fontWeight: 600 },
        h4: { fontFamily: `'Playfair Display', serif`, fontWeight: 600 },
    },
    shape: {
        borderRadius: 14
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    borderRadius: 999,
                    fontWeight: 600
                }
            }
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    fontWeight: 500
                }
            }
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: '0 6px 24px rgba(198, 113, 122, 0.14)',
                    borderRadius: 16
                }
            }
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none'
                }
            }
        }
    }
});

export default theme;
