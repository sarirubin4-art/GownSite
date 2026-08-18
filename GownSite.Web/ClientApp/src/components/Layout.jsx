import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    AppBar, Toolbar, Typography, Button, Box, Container, Paper,
    Avatar, IconButton, Menu, MenuItem, Divider, Drawer, List, ListItemButton, ListItemText
} from '@mui/material';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import MenuIcon from '@mui/icons-material/Menu';
import { useAuth } from '../context/AuthContext';
import { AdLaneProvider } from '../context/AdLaneContext';
import FloatingAds from './FloatingAds';
import ContactAdminDialog from './ContactAdminDialog';
import { wallpaperBackground } from '../theme';

const NAV_LINKS = [
    { to: '/search', label: 'Browse Gowns' },
    { to: '/ads', label: 'Simcha Services' },
    { to: '/postagown', label: 'Post a Gown' },
    { to: '/advertise', label: 'Advertise' }
];

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
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [resendState, setResendState] = useState('idle'); // idle | sending | sent
    const [contactOpen, setContactOpen] = useState(false);

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
            <AppBar position="sticky" color="primary" elevation={0}>
                <Toolbar sx={{ gap: 1 }}>
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
                            sx={{
                                bgcolor: 'background.paper', borderRadius: 2,
                                px: { xs: 1, md: 1.5 }, py: { xs: 0.5, md: 0.75 }, display: 'flex', alignItems: 'center'
                            }}
                        >
                            <Box
                                component="img"
                                src="/logo.webp"
                                alt="Regowned"
                                sx={{ height: { xs: 30, md: 40 }, width: 'auto', display: 'block' }}
                            />
                        </Box>
                    </Box>
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
                        {NAV_LINKS.map((link) => (
                            <Button key={link.to} component={Link} to={link.to} color="inherit">{link.label}</Button>
                        ))}
                        {owner && (
                            <>
                                <Button component={Link} to="/mylistings" color="inherit">My Listings</Button>
                                <Button component={Link} to="/myads" color="inherit">My Ads</Button>
                                {owner.isAdmin && (
                                    <Button component={Link} to="/admin" color="inherit" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                                        Admin
                                    </Button>
                                )}
                            </>
                        )}
                    </Box>
                    {owner ? (
                        <>
                            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ ml: 0.5 }}>
                                <Avatar sx={{
                                    width: 36, height: 36, fontSize: 14, fontWeight: 700,
                                    bgcolor: 'secondary.light', color: 'primary.dark'
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
                                <MenuItem
                                    component={Link}
                                    to="/mylistings"
                                    onClick={() => setMenuAnchor(null)}
                                    sx={{ display: { xs: 'flex', md: 'none' } }}
                                >
                                    My Listings
                                </MenuItem>
                                <MenuItem
                                    component={Link}
                                    to="/myads"
                                    onClick={() => setMenuAnchor(null)}
                                    sx={{ display: { xs: 'flex', md: 'none' } }}
                                >
                                    My Ads
                                </MenuItem>
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
                                <MenuItem onClick={onLogoutClick}>Log Out</MenuItem>
                            </Menu>
                        </>
                    ) : (
                        <Button
                            component={Link}
                            to="/login"
                            color="inherit"
                            variant="outlined"
                            size="small"
                            sx={{ borderColor: 'rgba(255,255,255,0.6)', flexShrink: 0 }}
                        >
                            Log In
                        </Button>
                    )}
                </Toolbar>
            </AppBar>
            <Drawer anchor="left" open={drawerOpen} onClose={closeDrawer}>
                <Box sx={{ width: 260 }} role="presentation">
                    <Box sx={{ p: 2 }}>
                        <Box component="img" src="/logo.webp" alt="Regowned" sx={{ height: 32, width: 'auto', display: 'block' }} />
                    </Box>
                    <Divider />
                    <List>
                        {NAV_LINKS.map((link) => (
                            <ListItemButton key={link.to} component={Link} to={link.to} onClick={closeDrawer}>
                                <ListItemText primary={link.label} />
                            </ListItemButton>
                        ))}
                        {owner ? (
                            <>
                                <ListItemButton component={Link} to="/mylistings" onClick={closeDrawer}>
                                    <ListItemText primary="My Listings" />
                                </ListItemButton>
                                <ListItemButton component={Link} to="/myads" onClick={closeDrawer}>
                                    <ListItemText primary="My Ads" />
                                </ListItemButton>
                                {owner.isAdmin && (
                                    <ListItemButton component={Link} to="/admin" onClick={closeDrawer}>
                                        <ListItemText primary="Admin" />
                                    </ListItemButton>
                                )}
                                <Divider sx={{ my: 1 }} />
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
                {owner && !owner.emailVerified ? (
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
                            <Button variant="text" fullWidth onClick={onLogoutClick}>Log Out</Button>
                        </Paper>
                    </Container>
                ) : (
                    /* The page itself always stays centered on the full viewport — the ad floats
                       over it rather than displacing it. AdLaneProvider passes adVisible down so
                       the rare row that actually reaches the right edge (a filter bar's trailing
                       button, a tab strip) can reserve just enough space to clear the ad, without
                       the whole page shifting off-center to make permanent room for it. */
                    <Container maxWidth="lg" sx={{ pt: { xs: adVisible ? '108px' : 4, md: 4 }, pb: 24 }}>
                        <AdLaneProvider adVisible={adVisible}>
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
            <FloatingAds onVisibilityChange={setAdVisible} />
        </Box>
    );
};

export default Layout;
