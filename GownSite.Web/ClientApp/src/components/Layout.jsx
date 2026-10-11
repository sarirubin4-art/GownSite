import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    AppBar, Toolbar, Typography, Button, Box, Container, Paper,
    Avatar, IconButton, Menu, MenuItem, Divider, Drawer, List, ListItemButton, ListItemText, ListSubheader
} from '@mui/material';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import MenuIcon from '@mui/icons-material/Menu';
import { useAuth } from '../context/AuthContext';
import { AdLaneProvider } from '../context/AdLaneContext';
import FloatingAds from './FloatingAds';
import ContactAdminDialog from './ContactAdminDialog';
import { wallpaperBackground } from '../theme';
import { trackPageView } from '../utils/analytics';

// Three tiers, each styled differently so they don't blend together: the shopper/seller
// calls to action are real buttons; the business links live in a slim strip above the
// header (desktop) or their own drawer section (phone); the visitor's own pages sit with
// their account avatar.
const SHOPPER_LINKS = [
    { to: '/search', label: 'Browse Gowns' },
    { to: '/postagown', label: 'Post a Gown' }
];
const BUSINESS_LINKS = [
    { to: '/ads', label: 'Ad Directory' },
    { to: '/advertise', label: 'Advertise' }
];

// Desktop only. FloatingAds' AD_TOP accounts for it — keep the two in sync.
const BUSINESS_STRIP_HEIGHT = 32;
const HEADER_RULE = '1px solid #EFD9D8';

const DrawerHeading = ({ children }) => (
    <ListSubheader disableSticky sx={{ lineHeight: 1, pt: 2, pb: 1, fontSize: '0.7rem', letterSpacing: 2, textTransform: 'uppercase', color: 'primary.dark', bgcolor: 'transparent' }}>
        {children}
    </ListSubheader>
);

const initialsFor = (name) => (name || '')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const Layout = ({ children }) => {
    const { owner, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [adVisible, setAdVisible] = useState(false);
    const [adStackTop, setAdStackTop] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [resendState, setResendState] = useState('idle'); // idle | sending | sent
    const [contactOpen, setContactOpen] = useState(false);

    // Layout wraps every route, so this is the one place every page view passes through.
    useEffect(() => {
        trackPageView(location.pathname);
    }, [location.pathname]);

    // My Listings only appears once the owner has something to manage (a gown or ad in any
    // state). Re-checked on navigation until it turns true, so the link shows up right
    // after someone posts their first listing; once true it stays put for that owner.
    const [hasListings, setHasListings] = useState(false);
    useEffect(() => { setHasListings(false); }, [owner?.id]);
    useEffect(() => {
        if (!owner || hasListings) return;
        axios.get('/api/owner/has-listings').then(({ data }) => setHasListings(!!data)).catch(() => {});
    }, [owner?.id, location.pathname, hasListings]);
    // Always reachable while actually on the page (e.g. a shared /mylistings link).
    const showMyListings = !!owner && (hasListings || location.pathname === '/mylistings');

    const onContactUsClick = () => {
        if (owner) {
            setContactOpen(true);
        } else {
            navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
        }
    };

    const onResendVerification = async () => {
        setResendState('sending');
        try {
            await axios.post('/api/owner/resend-verification');
            setResendState('sent');
        } catch {
            setResendState('idle');
        }
    };

    const onLogoutClick = async () => {
        setMenuAnchor(null);
        setDrawerOpen(false);
        await logout();
        navigate('/');
    };

    const closeDrawer = () => setDrawerOpen(false);

    return (
        <Box sx={{
            minHeight: '100vh',
            backgroundColor: 'background.default'
        }}>
            {/* Desktop: a white header so the logo sits on it as-is and the pink calls to
                action stand out, with business links in a slim strip above. Phone: the pink
                bar stays, with the logo knocked out to white and Post a Gown as a white
                button so it still pops. */}
            <AppBar
                position="sticky"
                elevation={0}
                sx={{
                    bgcolor: { xs: 'primary.main', md: 'background.paper' },
                    color: { xs: '#fff', md: 'text.primary' },
                    borderBottom: { xs: 'none', md: HEADER_RULE }
                }}
            >
                <Box sx={{
                    display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'flex-end', gap: 2.75,
                    height: BUSINESS_STRIP_HEIGHT, px: 3, bgcolor: '#F6E1DF', color: '#7A4E55', fontSize: '0.8rem', letterSpacing: 0.2
                }}>
                    <Box component="span">For businesses:</Box>
                    {BUSINESS_LINKS.map((link) => (
                        <Box
                            key={link.to} component={Link} to={link.to}
                            sx={{
                                color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3,
                                textDecorationColor: 'rgba(122, 78, 85, 0.4)',
                                fontWeight: location.pathname.startsWith(link.to) ? 600 : 400,
                                '&:hover': { color: 'primary.dark', textDecorationColor: 'currentColor' }
                            }}
                        >
                            {link.label}
                        </Box>
                    ))}
                </Box>
                <Toolbar sx={{ gap: { xs: 1, md: 2 } }}>
                    <IconButton
                        onClick={() => setDrawerOpen(true)}
                        color="inherit"
                        sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                        aria-label="Open menu"
                    >
                        <MenuIcon />
                    </IconButton>
                    <Box
                        component={Link}
                        to="/"
                        sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}
                    >
                        <Box
                            component="img"
                            src="/logo.webp"
                            alt="Regowned"
                            sx={{
                                height: { xs: 32, md: 44 }, width: 'auto', display: 'block',
                                filter: { xs: 'brightness(0) invert(1)', md: 'none' }
                            }}
                        />
                    </Box>

                    {/* Desktop: the visitor's own pages, then the two main calls to action. */}
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 2 }}>
                        {(showMyListings || owner?.isAdmin) && (
                            <>
                                {showMyListings && (
                                    <Button
                                        component={Link} to="/mylistings" color="inherit"
                                        sx={{
                                            fontWeight: location.pathname === '/mylistings' ? 700 : 500,
                                            '&:hover': { bgcolor: 'rgba(198, 113, 122, 0.08)' }
                                        }}
                                    >
                                        My Listings
                                    </Button>
                                )}
                                {owner?.isAdmin && (
                                    <Button component={Link} to="/admin" color="inherit" size="small" variant="outlined" sx={{ borderColor: '#E3C3C3' }}>
                                        Admin
                                    </Button>
                                )}
                                <Box sx={{ width: '1px', height: 26, bgcolor: '#EFD9D8' }} />
                            </>
                        )}
                        <Button
                            component={Link} to={SHOPPER_LINKS[0].to} variant="contained" disableElevation
                            sx={{
                                px: 2.75, py: 1,
                                boxShadow: '0 4px 14px rgba(198, 113, 122, 0.35)',
                                '&:hover': { boxShadow: '0 6px 18px rgba(198, 113, 122, 0.45)' }
                            }}
                        >
                            {SHOPPER_LINKS[0].label}
                        </Button>
                        <Button
                            component={Link} to={SHOPPER_LINKS[1].to} variant="outlined"
                            sx={{ px: 2.5, py: 0.9, borderWidth: 1.5, color: 'primary.dark', '&:hover': { borderWidth: 1.5 } }}
                        >
                            {SHOPPER_LINKS[1].label}
                        </Button>
                    </Box>

                    {/* Phone: Post a Gown stays one tap away; browsing already starts from the
                        home page search. */}
                    <Button
                        component={Link} to="/postagown" variant="contained" size="small" disableElevation
                        sx={{
                            display: { xs: 'inline-flex', md: 'none' }, flexShrink: 0,
                            bgcolor: '#fff', color: 'primary.dark', px: 1.75,
                            '&:hover': { bgcolor: '#FFF6F3' }
                        }}
                    >
                        Post a Gown
                    </Button>

                    {owner ? (
                        <>
                            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ ml: { xs: 0, md: -0.5 }, p: 0.5 }} aria-label="Account menu">
                                <Avatar sx={{
                                    width: 36, height: 36, fontSize: 14, fontWeight: 700,
                                    bgcolor: { xs: 'secondary.light', md: '#F2D5D3' }, color: 'primary.dark'
                                }}>
                                    {initialsFor(owner.name)}
                                </Avatar>
                            </IconButton>
                            <Menu
                                anchorEl={menuAnchor}
                                open={Boolean(menuAnchor)}
                                onClose={() => setMenuAnchor(null)}
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                            >
                                <Box sx={{ px: 2, py: 1, minWidth: 180 }}>
                                    <Typography variant="caption" color="text.secondary">Signed in as</Typography>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{owner.name}</Typography>
                                </Box>
                                <Divider />
                                {showMyListings && (
                                    <MenuItem
                                        component={Link}
                                        to="/mylistings"
                                        onClick={() => setMenuAnchor(null)}
                                        sx={{ display: { xs: 'flex', md: 'none' } }}
                                    >
                                        My Listings
                                    </MenuItem>
                                )}
                                {owner.isAdmin && (
                                    <MenuItem
                                        component={Link}
                                        to="/admin"
                                        onClick={() => setMenuAnchor(null)}
                                        sx={{ display: { xs: 'flex', md: 'none' } }}
                                    >
                                        Admin
                                    </MenuItem>
                                )}
                                <MenuItem component={Link} to="/account" onClick={() => setMenuAnchor(null)}>My Account</MenuItem>
                                <MenuItem onClick={onLogoutClick}>Log Out</MenuItem>
                            </Menu>
                        </>
                    ) : (
                        <Button
                            component={Link}
                            to="/login"
                            color="inherit"
                            size="small"
                            sx={{ flexShrink: 0, fontWeight: 600, '&:hover': { bgcolor: { xs: 'rgba(255,255,255,0.12)', md: 'rgba(198, 113, 122, 0.08)' } } }}
                        >
                            Log In
                        </Button>
                    )}
                </Toolbar>
            </AppBar>
            <Drawer anchor="left" open={drawerOpen} onClose={closeDrawer}>
                <Box sx={{ width: 270 }} role="presentation">
                    <Box sx={{ p: 2 }}>
                        <Box component="img" src="/logo.webp" alt="Regowned" sx={{ height: 32, width: 'auto', display: 'block' }} />
                    </Box>
                    <Divider />
                    {[
                        { heading: 'Shop and sell', links: SHOPPER_LINKS },
                        { heading: 'For businesses', links: BUSINESS_LINKS },
                    ].map((group) => (
                        <List key={group.heading} subheader={<DrawerHeading>{group.heading}</DrawerHeading>}>
                            {group.links.map((link) => (
                                <ListItemButton key={link.to} component={Link} to={link.to} onClick={closeDrawer}>
                                    <ListItemText primary={link.label} />
                                </ListItemButton>
                            ))}
                        </List>
                    ))}
                    <List subheader={<DrawerHeading>Your account</DrawerHeading>}>
                        {owner ? (
                            <>
                                {showMyListings && (
                                    <ListItemButton component={Link} to="/mylistings" onClick={closeDrawer}>
                                        <ListItemText primary="My Listings" />
                                    </ListItemButton>
                                )}
                                {owner.isAdmin && (
                                    <ListItemButton component={Link} to="/admin" onClick={closeDrawer}>
                                        <ListItemText primary="Admin" />
                                    </ListItemButton>
                                )}
                                <ListItemButton component={Link} to="/account" onClick={closeDrawer}>
                                    <ListItemText primary="My Account" />
                                </ListItemButton>
                                <ListItemButton onClick={onLogoutClick}>
                                    <ListItemText primary="Log Out" />
                                </ListItemButton>
                            </>
                        ) : (
                            <ListItemButton component={Link} to="/login" onClick={closeDrawer}>
                                <ListItemText primary="Log In" />
                            </ListItemButton>
                        )}
                    </List>
                </Box>
            </Drawer>
            {/* Backgrounds live here, not on the outer Box, so the top-left bloom
                always starts right below the navbar regardless of its rendered
                height (e.g. if the nav wraps to two lines on a narrower screen). */}
            <Box sx={{ ...wallpaperBackground, minHeight: 'calc(100vh - 64px)' }}>
                {/* My Account stays reachable while unverified: it's how a patron who mistyped
                    their email at signup fixes it (confirming the new address verifies them). */}
                {owner && !owner.emailVerified && location.pathname !== '/account' ? (
                    // A hard gate, not a dismissable nudge: unverified accounts can't use the
                    // site at all (browsing while logged out is unaffected) until they click
                    // the link in their verification email. Accounts that existed before this
                    // feature shipped were grandfathered in as verified, so this only applies
                    // to new signups going forward.
                    <Container maxWidth="xs" sx={{ pt: 8, pb: 8 }}>
                        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                            <MarkEmailUnreadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                            <Typography variant="h5" gutterBottom>Verify Your Email</Typography>
                            <Typography color="text.secondary" sx={{ mb: 3 }}>
                                We sent a verification link to <strong>{owner.email}</strong>. Click it to activate your account — you'll need to verify before you can use Regowned.
                            </Typography>
                            <Button
                                variant="contained" fullWidth disabled={resendState !== 'idle'} onClick={onResendVerification} sx={{ mb: 1.5 }}
                            >
                                {resendState === 'sent' ? 'Email Sent' : resendState === 'sending' ? 'Sending...' : 'Resend Email'}
                            </Button>
                            <Button variant="text" fullWidth component={Link} to="/account">Wrong email address? Change it</Button>
                            <Button variant="text" fullWidth onClick={onLogoutClick}>Log Out</Button>
                        </Paper>
                    </Container>
                ) : (
                    /* The page itself always stays centered on the full viewport — the ad floats
                       over it rather than displacing it. AdLaneProvider passes adVisible down so
                       the rare row that actually reaches the right edge (a filter bar's trailing
                       button, a tab strip) can reserve just enough space to clear the ad, without
                       the whole page shifting off-center to make permanent room for it. */
                    <Container maxWidth="xl" sx={{ pt: { xs: adVisible ? '108px' : 4, md: 4 }, pb: 24 }}>
                        <AdLaneProvider adVisible={adVisible} adStackTop={adStackTop}>
                            {children}
                        </AdLaneProvider>
                    </Container>
                )}
            </Box>
            <Box sx={{ py: 3, textAlign: 'center', borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Typography variant="body2" color="text.secondary">
                    <Box component={Link} to="/terms" sx={{ color: 'inherit', mx: 1.5 }}>Terms of Service</Box>
                    &middot;
                    <Box component={Link} to="/privacy" sx={{ color: 'inherit', mx: 1.5 }}>Privacy Policy</Box>
                    &middot;
                    <Box component={Link} to="/concierge/terms" sx={{ color: 'inherit', mx: 1.5 }}>Concierge Posting</Box>
                    &middot;
                    <Box component="span" onClick={onContactUsClick} sx={{ color: 'inherit', mx: 1.5, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                        Contact Us
                    </Box>
                </Typography>
            </Box>
            <ContactAdminDialog
                open={contactOpen}
                onClose={() => setContactOpen(false)}
                topic="Contact Customer Service"
                title="Contact Customer Service"
                promptText="How can we help? Send us a message and we'll follow up by email."
            />
            <FloatingAds onVisibilityChange={setAdVisible} onStackTopChange={setAdStackTop} />
        </Box>
    );
};

export default Layout;
