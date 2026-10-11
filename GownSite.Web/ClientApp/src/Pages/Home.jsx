import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Box, Typography, Button, Stack, Snackbar, Alert, Grid, useMediaQuery } from '@mui/material';
import usePageTitle from '../hooks/usePageTitle';
import { useAdLane } from '../context/AdLaneContext';
import SmartSearchBar from '../components/SmartSearchBar';
import GownCard from '../components/GownCard';
import { COLOR_OPTIONS, styleLabel } from '../constants/gownOptions';
import { parsedToSearchParams } from '../utils/parseSearchQuery';

// How long each Shop by tab stays up before rotating to the next.
const ROTATE_MS = 4000;

// Below desktop width, each Shop by panel is a sideways-swipe row (bleeding to the screen
// edges) rather than wrapping into a tall stack. The three panels share one fixed-height
// area, so keeping them all about the same height is what avoids a big empty gap.
const SWIPE_ROW = {
    overflowX: { xs: 'auto', md: 'visible' }, scrollSnapType: { xs: 'x proximity', md: 'none' },
    mx: { xs: -2, sm: -3, md: 0 }, px: { xs: 2, sm: 3, md: 0 }, pb: { xs: 1, md: 0 },
    scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }
};
const RULE = '1px solid rgba(156, 78, 88, 0.18)';
const serif = `'Playfair Display', serif`;

// Small letter-spaced label that sits above a section title.
const Eyebrow = ({ children, sx }) => (
    <Typography sx={{ fontSize: '0.72rem', letterSpacing: 3, textTransform: 'uppercase', color: 'primary.dark', fontWeight: 500, ...sx }}>
        {children}
    </Typography>
);

const SectionHeading = ({ eyebrow, title, linkTo, linkLabel }) => (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, pb: 1.5, mb: 3.5, borderBottom: RULE }}>
        <Box>
            <Eyebrow sx={{ mb: 0.5 }}>{eyebrow}</Eyebrow>
            <Typography variant="h4" component="h2" sx={{ fontSize: { xs: '1.6rem', md: '2.1rem' } }}>{title}</Typography>
        </Box>
        {linkTo && (
            <Typography
                component={Link} to={linkTo}
                sx={{ color: 'text.primary', fontSize: '0.9rem', whiteSpace: 'nowrap', textDecoration: 'none',
                    borderBottom: '1px solid currentColor', pb: 0.25, mb: 0.75, '&:hover': { color: 'primary.dark' } }}
            >
                {linkLabel}
            </Typography>
        )}
    </Box>
);

// Swatch fills for the "Shop by Color" row — metallics and prints get a soft gradient so
// they read as what they are rather than a flat chip.
const SWATCH = {
    'Ivory/White': '#FBF7EE', Blush: '#F2CFCB', Champagne: '#EED9B9', Beige: '#D9C4A5', Black: '#1E1A1B',
    Navy: '#1F2B47', Burgundy: '#6E1F2E', Emerald: '#1F5E46', Sage: '#A3B09A', Blue: '#4F74B3',
    Silver: 'linear-gradient(135deg, #F2F2F2 0%, #B9BCC2 50%, #EDEDED 100%)',
    Gold: 'linear-gradient(135deg, #F3E2A9 0%, #C9A44C 50%, #F1DE9D 100%)',
    Pink: '#E59BB1', Purple: '#7A5194',
    Floral: 'radial-gradient(circle at 30% 30%, #E8A1AE 0 18%, transparent 19%), radial-gradient(circle at 70% 65%, #A9B98F 0 16%, transparent 17%), radial-gradient(circle at 68% 28%, #F3D27A 0 12%, transparent 13%), #FBF1EE',
    Multi: 'conic-gradient(#E59BB1, #F3D27A, #A3B09A, #4F74B3, #7A5194, #E59BB1)',
};

// One-click shortcuts under the hero search bar, straight to a pre-filtered Browse page.
const POPULAR = [
    { label: 'Mother of the Bride', params: 'styles=MotherOfBrideOrGroom' },
    { label: 'Sister of the Bride', params: 'styles=SisterOfBrideOrGroom' },
    { label: 'Navy', params: 'colors=Navy' },
    { label: 'Bridal', params: 'styles=Bridal' },
    { label: 'For Rent', params: 'listingTypes=Rent' },
];

const Home = () => {
    usePageTitle(null, "Buy, sell, and rent dresses for every event. Find the perfect dress nearby, or give one you love a beautiful second life.");
    const navigate = useNavigate();
    const { laneSx } = useAdLane();
    const [searchParams] = useSearchParams();
    const verified = searchParams.get('verified');
    const [noticeOpen, setNoticeOpen] = useState(!!verified);
    const [showcase, setShowcase] = useState(null);

    useEffect(() => {
        axios.get('/api/gown/home-showcase').then(({ data }) => setShowcase(data)).catch(() => {});
    }, []);

    const onSearch = (parsed, text) => navigate(`/search?${parsedToSearchParams(parsed, text)}`);

    const colors = showcase ? COLOR_OPTIONS.filter((c) => SWATCH[c] && showcase.colors.includes(c)) : [];
    const styles = showcase?.styles || [];
    const brands = showcase?.brands || [];
    const newest = showcase?.newest || [];

    // A designer list of one or two names looks thin, so that tab waits until there are a few.
    const shopTabs = [
        { key: 'color', label: 'Color', show: colors.length > 0 },
        { key: 'designer', label: 'Designer', show: brands.length >= 3 },
        { key: 'occasion', label: 'Occasion', show: styles.length > 0 },
    ].filter((t) => t.show);
    const [shopBy, setShopBy] = useState('color');
    const activeTab = shopTabs.some((t) => t.key === shopBy) ? shopBy : shopTabs[0]?.key;

    // The tabs advance on their own until the visitor shows interest: hovering or focusing
    // the section pauses it, and picking a tab (or touching the section on a phone, e.g. to
    // swipe the occasion photos) stops it for good. Off entirely for reduced-motion users.
    const [autoRotate, setAutoRotate] = useState(true);
    const [paused, setPaused] = useState(false);
    const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
    const rotating = autoRotate && !paused && !reduceMotion && shopTabs.length > 1;
    useEffect(() => {
        if (!rotating) return undefined;
        const timer = setTimeout(() => {
            const i = shopTabs.findIndex((t) => t.key === activeTab);
            setShopBy(shopTabs[(i + 1) % shopTabs.length].key);
        }, ROTATE_MS);
        return () => clearTimeout(timer);
    }, [rotating, activeTab, shopTabs.length]);

    const pickTab = (key) => {
        setAutoRotate(false);
        setShopBy(key);
    };

    const renderColors = () => (
        <Box sx={{
            ...SWIPE_ROW, display: { xs: 'grid', md: 'flex' }, flexWrap: 'wrap',
            gridAutoFlow: 'column', gridTemplateRows: 'repeat(2, auto)', gridAutoColumns: '72px',
            columnGap: { xs: 2, md: 3.5 }, rowGap: { xs: 2, md: 3.5 }
        }}>
            {colors.map((c) => (
                <Box
                    key={c} component={Link} to={`/search?colors=${encodeURIComponent(c)}`}
                    sx={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', width: 72,
                        color: 'text.primary', textDecoration: 'none',
                        '&:hover .swatch': { boxShadow: '0 0 0 2px #fff, 0 0 0 3px rgba(156, 78, 88, 0.6)' }
                    }}
                >
                    <Box className="swatch" sx={{
                        width: 52, height: 52, borderRadius: '50%', background: SWATCH[c],
                        border: '1px solid rgba(74, 52, 57, 0.12)', transition: 'box-shadow 0.2s'
                    }} />
                    <Typography sx={{ fontSize: '0.8rem', mt: 1, textAlign: 'center', lineHeight: 1.3 }}>{c}</Typography>
                </Box>
            ))}
        </Box>
    );

    // Already ordered best-known first by the server (see DesignerDirectory). Each button
    // carries a small photo of that designer's newest available gown.
    const renderDesigners = () => (
        <Box sx={{
            ...SWIPE_ROW, display: { xs: 'grid', md: 'flex' }, flexWrap: 'wrap',
            gridAutoFlow: 'column', gridTemplateRows: 'repeat(3, auto)', gridAutoColumns: 'max-content',
            justifyItems: 'start', gap: { xs: 1.25, md: 1.5 }
        }}>
            {brands.map((b) => (
                <Button
                    key={b.name} component={Link} to={`/search?keywords=${encodeURIComponent(b.searchTerm)}`}
                    variant="outlined"
                    sx={{
                        bgcolor: 'background.paper', color: 'text.primary',
                        borderColor: 'rgba(156, 78, 88, 0.3)',
                        pl: 0.75, pr: { xs: 2.25, md: 2.75 }, py: 0.75, gap: 1.25,
                        fontFamily: serif, fontWeight: 600, fontSize: { xs: '1rem', md: '1.1rem' },
                        transition: 'all 0.2s',
                        '&:hover': {
                            bgcolor: 'primary.main', borderColor: 'primary.main', color: '#fff',
                            '& .designer-count': { color: 'rgba(255,255,255,0.8)' }
                        }
                    }}
                >
                    <Box
                        component="img" src={b.imageUrl} alt="" loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        sx={{
                            width: { xs: 32, md: 36 }, height: { xs: 32, md: 36 }, borderRadius: '50%', flexShrink: 0,
                            objectFit: 'cover', objectPosition: 'center 20%', bgcolor: 'background.default',
                            border: '1px solid rgba(74, 52, 57, 0.08)'
                        }}
                    />
                    {b.name}
                    <Box component="span" className="designer-count" sx={{
                        fontFamily: `'Poppins', sans-serif`, fontWeight: 400, fontSize: '0.75rem',
                        color: 'text.secondary', transition: 'color 0.2s'
                    }}>
                        {b.count}
                    </Box>
                </Button>
            ))}
        </Box>
    );

    // One row of photos at every width (a swipe row below desktop) — two rows of tall
    // photos made this panel several times taller than the other two.
    const renderOccasions = () => (
        <Box sx={{
            ...SWIPE_ROW, display: { xs: 'flex', md: 'grid' }, gap: { xs: 1.5, md: 2.5 },
            gridTemplateColumns: { md: `repeat(${styles.length}, minmax(0, 1fr))` },
            maxWidth: { md: styles.length * 230 }
        }}>
            {styles.map((s) => (
                <Box
                    key={s.style} component={Link} to={`/search?styles=${s.style}`}
                    sx={{
                        display: 'block', flex: { xs: '0 0 38%', sm: '0 0 22%', md: 'none' }, scrollSnapAlign: 'start',
                        color: 'inherit', textDecoration: 'none',
                        '&:hover img': { transform: 'scale(1.04)' },
                        '&:hover .occasion-label': { color: 'primary.dark' }
                    }}
                >
                    <Box sx={{ overflow: 'hidden', borderRadius: 2, aspectRatio: '4 / 5', bgcolor: 'background.paper' }}>
                        <Box
                            component="img" src={s.imageUrl} alt={styleLabel(s.style)} loading="lazy"
                            sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%',
                                display: 'block', transition: 'transform 0.6s ease' }}
                        />
                    </Box>
                    <Typography className="occasion-label" sx={{ fontFamily: serif, fontSize: { xs: '1rem', md: '1.1rem' }, mt: 1, transition: 'color 0.2s' }}>
                        {styleLabel(s.style)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {s.count} {s.count === 1 ? 'gown' : 'gowns'}
                    </Typography>
                </Box>
            ))}
        </Box>
    );

    return (
        <Box>
            {/* Hero */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', pt: { xs: 5, md: 9 }, pb: { xs: 6, md: 9 } }}>
                <Box
                    component="img"
                    src="/logo.webp"
                    alt="Regowned"
                    sx={{ width: { xs: '80%', sm: 420 }, maxWidth: 500, height: 'auto', mb: 2 }}
                />
                <Typography variant="h6" color="text.secondary" sx={{ mb: { xs: 4, md: 5 }, maxWidth: 560, fontWeight: 400 }}>
                    Buy, sell, and rent dresses for every event. Find the perfect dress nearby,
                    or give one you love a beautiful second life.
                </Typography>

                <Box sx={{ width: '100%', maxWidth: 680 }}>
                    <SmartSearchBar
                        large
                        onSearch={onSearch}
                        placeholder='Try “navy mother of the bride, size 12”'
                    />
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', columnGap: 2.5, rowGap: 1, mt: 1, px: 2 }}>
                    <Eyebrow sx={{ color: 'text.secondary', letterSpacing: 2.5 }}>Popular</Eyebrow>
                    {POPULAR.map((p) => (
                        <Typography
                            key={p.label} component={Link} to={`/search?${p.params}`}
                            sx={{ color: 'text.primary', fontSize: '0.9rem', textDecoration: 'none',
                                borderBottom: '1px solid transparent', '&:hover': { borderColor: 'primary.main', color: 'primary.dark' } }}
                        >
                            {p.label}
                        </Typography>
                    ))}
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: { xs: 4, md: 5 } }}>
                    <Button component={Link} to="/search" variant="contained" size="large" sx={{ px: 4, py: 1.5 }}>
                        Browse All Gowns
                    </Button>
                    <Button component={Link} to="/postagown" variant="outlined" size="large" sx={{ px: 4, py: 1.5 }}>
                        Post a Gown
                    </Button>
                </Stack>
            </Box>

            <Box sx={{ mr: laneSx }}>
                {/* Shop by — color, designer and occasion share one section (tabs) so the
                    page doesn't turn into a long scroll of separate shortcut sections. Each
                    tab only lists what currently has available gowns. */}
                {shopTabs.length > 0 && (
                    <Box
                        component="section"
                        sx={{ mb: { xs: 7, md: 10 } }}
                        onMouseEnter={() => setPaused(true)}
                        onMouseLeave={() => setPaused(false)}
                        onFocus={() => setPaused(true)}
                        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}
                        onTouchStart={() => setAutoRotate(false)}
                    >
                        <Box sx={{ pb: 1.5, mb: 3.5, borderBottom: RULE }}>
                            <Eyebrow sx={{ mb: 0.75 }}>Shop by</Eyebrow>
                            <Box role="tablist" sx={{ display: 'flex', flexWrap: 'wrap', columnGap: { xs: 2.5, md: 4 }, rowGap: 0.5 }}>
                                {shopTabs.map((t) => {
                                    const active = t.key === activeTab;
                                    return (
                                        <Box
                                            key={t.key} component="button" type="button" role="tab" aria-selected={active}
                                            onClick={() => pickTab(t.key)}
                                            sx={{
                                                position: 'relative', p: 0, border: 0, background: 'none', cursor: 'pointer',
                                                fontFamily: serif, fontWeight: 600, fontSize: { xs: '1.5rem', md: '2.1rem' },
                                                color: active ? 'text.primary' : 'rgba(74, 52, 57, 0.35)',
                                                transition: 'color 0.4s',
                                                '&:hover': { color: active ? 'text.primary' : 'rgba(74, 52, 57, 0.6)' }
                                            }}
                                        >
                                            {t.label}
                                            {/* Fills over the time this tab stays up, so the switch
                                                never comes as a surprise. Restarts when resumed. */}
                                            {active && rotating && (
                                                <Box component="span" key={activeTab} sx={{
                                                    position: 'absolute', left: 0, bottom: -2, height: 2, borderRadius: 1,
                                                    bgcolor: 'primary.main', opacity: 0.6,
                                                    animation: `shopByProgress ${ROTATE_MS}ms linear forwards`,
                                                    '@keyframes shopByProgress': { from: { width: '0%' }, to: { width: '100%' } }
                                                }} />
                                            )}
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>

                        {/* All panels sit in the same grid cell, so the section is always as tall
                            as its tallest panel — the page below doesn't jump on every switch —
                            and switching is a cross-fade. */}
                        <Box sx={{ display: 'grid' }}>
                            {shopTabs.map((t) => {
                                const active = t.key === activeTab;
                                return (
                                    <Box
                                        key={t.key} role="tabpanel" aria-hidden={!active}
                                        sx={{
                                            gridArea: '1 / 1', minWidth: 0,
                                            opacity: active ? 1 : 0, visibility: active ? 'visible' : 'hidden',
                                            transition: 'opacity 0.5s ease, visibility 0.5s'
                                        }}
                                    >
                                        {t.key === 'color' && renderColors()}
                                        {t.key === 'designer' && renderDesigners()}
                                        {t.key === 'occasion' && renderOccasions()}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                )}

                {/* Just listed — one row, so it teases rather than adds another long scroll */}
                {newest.length > 0 && (
                    <Box component="section" sx={{ mb: { xs: 7, md: 10 } }}>
                        <SectionHeading eyebrow="Just listed" title="Newest arrivals" linkTo="/search" linkLabel="Browse all" />
                        <Box sx={{
                            display: { xs: 'flex', sm: 'grid' }, gap: 3,
                            overflowX: { xs: 'auto', sm: 'visible' }, scrollSnapType: 'x mandatory',
                            mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, pb: { xs: 1, sm: 0 },
                            gridTemplateColumns: { sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                            scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }
                        }}>
                            {newest.map((gown) => (
                                <Box key={gown.id} sx={{ flex: { xs: '0 0 78%', sm: 'none' }, scrollSnapAlign: 'start', minWidth: 0 }}>
                                    <GownCard gown={gown} navigate={navigate} />
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Sellers */}
                <Box component="section" sx={{ mb: { xs: 8, md: 11 } }}>
                    <Grid container spacing={{ xs: 2, md: 3 }}>
                        {[
                            {
                                eyebrow: 'For sellers', title: 'Have a gown in your closet?',
                                body: 'Rent it out or sell it, and let it shine at someone else’s simcha.',
                                to: '/postagown', cta: 'Post a Gown', variant: 'contained'
                            },
                            {
                                eyebrow: 'Concierge', title: 'Rather we handle it?',
                                body: 'Send us a few photos and the basics. We’ll write and post your listing for you.',
                                to: '/concierge', cta: 'Let Us Post It', variant: 'outlined'
                            },
                        ].map((card) => (
                            <Grid key={card.title} size={{ xs: 12, md: 6 }}>
                                <Box sx={{
                                    height: '100%', bgcolor: 'background.paper', border: RULE, borderRadius: 3,
                                    p: { xs: 3.5, md: 5 }, display: 'flex', flexDirection: 'column', alignItems: 'flex-start'
                                }}>
                                    <Eyebrow sx={{ mb: 1.5 }}>{card.eyebrow}</Eyebrow>
                                    <Typography variant="h4" component="h2" sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, mb: 1.5 }}>
                                        {card.title}
                                    </Typography>
                                    <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 420 }}>{card.body}</Typography>
                                    <Button component={Link} to={card.to} variant={card.variant} size="large" sx={{ px: 4, mt: 'auto' }}>
                                        {card.cta}
                                    </Button>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                </Box>

                {/* Notify me */}
                <Box component="section" sx={{ textAlign: 'center', py: { xs: 6, md: 8 }, borderTop: RULE, borderBottom: RULE, mb: { xs: 6, md: 8 } }}>
                    <Eyebrow sx={{ mb: 1.5 }}>Still searching?</Eyebrow>
                    <Typography variant="h4" component="h2" sx={{ fontSize: { xs: '1.7rem', md: '2.3rem' }, mb: 1.5 }}>
                        Be the first to know
                    </Typography>
                    <Typography color="text.secondary" sx={{ maxWidth: 480, mx: 'auto', mb: 3.5 }}>
                        Tell us your size, color, and style, and we’ll email you the moment a match is posted.
                    </Typography>
                    <Button component={Link} to="/search?notify=1" variant="contained" size="large" sx={{ px: 4.5, py: 1.4 }}>
                        Notify Me
                    </Button>
                </Box>

                {/* Ad directory */}
                <Box sx={{ textAlign: 'center', pb: 2 }}>
                    <Typography color="text.secondary">
                        Planning a simcha?{' '}
                        <Box component={Link} to="/ads" sx={{ color: 'primary.dark', textDecoration: 'none', borderBottom: '1px solid currentColor' }}>
                            Explore our Ad Directory
                        </Box>
                        {' '}for makeup, hair, sheitels, and more.
                    </Typography>
                </Box>
            </Box>

            <Snackbar
                open={noticeOpen}
                autoHideDuration={6000}
                onClose={() => setNoticeOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setNoticeOpen(false)}
                    severity={verified === '1' ? 'success' : 'warning'}
                    variant="filled"
                >
                    {verified === '1'
                        ? 'Email verified! Your account is fully active.'
                        : 'That verification link is invalid or has expired.'}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Home;
