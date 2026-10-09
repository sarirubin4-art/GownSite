import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Paper, Box, Typography, Stack, Tooltip, ButtonBase, Link } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useAdLane } from '../context/AdLaneContext';
import { AD_TOP } from './FloatingAds';

// Shared pieces for the Admin page's traffic bubble and Traffic tab.

export const PAGE_TYPE_LABELS = {
    Home: 'Home page',
    Gown: 'Gown',
    Ad: 'Ad',
    Search: 'Browse Gowns',
    AdDirectory: 'Ad Directory',
    PostGown: 'Post a Gown',
    Advertise: 'Advertise',
    Concierge: 'Concierge',
    Account: 'Log in / Sign up',
    MyAccount: 'My Listings',
    Checkout: 'Checkout',
    Info: 'Terms / Privacy',
    Other: 'Other'
};

const parseDay = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};
// View-log filter for a location row. A row with no country at all is the "Unknown"
// bucket, which the server matches with the "none" sentinel (a plain missing param would
// mean "no location filter" and show everything instead).
export const locationFilter = (row) => ({
    key: 'location',
    label: `Location: ${row.label}`,
    params: row.countryCode
        ? { city: row.city, regionCode: row.regionCode, countryCode: row.countryCode }
        : { countryCode: 'none' }
});

export const formatDay =(s) => parseDay(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// Path for a bar whose top two corners are rounded and whose base sits flat on the axis.
const barPath = (x, y, w, h, r) => {
    const rr = Math.min(r, w / 2, h);
    return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
};

// Views per day as thin bars, one per day, with a hover tooltip on each. Single series,
// so no legend — the surrounding title names it.
export const DailyBars = ({ daily, height = 56 }) => {
    const theme = useTheme();
    if (!daily?.length) return null;
    const max = Math.max(1, ...daily.map((d) => d.views));
    const width = 300;
    const slot = width / daily.length;
    const gap = 2;
    return (
        <Box>
            <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" sx={{ width: '100%', height, display: 'block' }}>
                <line x1="0" y1={height - 0.5} x2={width} y2={height - 0.5} stroke={theme.palette.divider} strokeWidth="1" />
                {daily.map((d, i) => {
                    const h = d.views === 0 ? 0 : Math.max(2, (d.views / max) * (height - 4));
                    return (
                        <Tooltip
                            key={d.date}
                            title={`${formatDay(d.date)}: ${d.views.toLocaleString()} views, ${d.visitors.toLocaleString()} visitors`}
                            placement="top"
                            arrow
                        >
                            <g style={{ cursor: 'default' }}>
                                {/* Full-height transparent hit target — bigger than the bar itself. */}
                                <rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
                                {h > 0 && (
                                    <path d={barPath(i * slot + gap / 2, height - 1 - h, slot - gap, h, 2)} fill={theme.palette.primary.main} />
                                )}
                            </g>
                        </Tooltip>
                    );
                })}
            </Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.25 }}>
                <Typography variant="caption" color="text.secondary">{formatDay(daily[0].date)}</Typography>
                <Typography variant="caption" color="text.secondary">peak {max.toLocaleString()}/day</Typography>
                <Typography variant="caption" color="text.secondary">{formatDay(daily[daily.length - 1].date)}</Typography>
            </Stack>
        </Box>
    );
};

// One "label ... 41%" row with a thin proportional bar underneath. Clickable when
// onClick is given (filters the view log to just this row).
export const PercentRow = ({ label, percent, count, onClick, dense }) => {
    const body = (
        <Box sx={{ width: '100%', py: dense ? 0.4 : 0.6 }}>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography variant="body2" noWrap sx={{ minWidth: 0, fontSize: dense ? '0.8rem' : undefined }} title={label}>{label}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, flexShrink: 0, fontSize: dense ? '0.8rem' : undefined }}>
                    {percent}%{count != null && !dense && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>({count.toLocaleString()})</Typography>
                    )}
                </Typography>
            </Stack>
            <Box sx={{ height: 4, mt: 0.4, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${Math.max(percent, 1)}%`, bgcolor: 'primary.main', borderRadius: 2 }} />
            </Box>
        </Box>
    );
    if (!onClick) return body;
    return (
        <ButtonBase onClick={onClick} sx={{ width: '100%', textAlign: 'left', borderRadius: 1, px: 0.5, mx: -0.5, '&:hover': { bgcolor: 'action.hover' } }}>
            {body}
        </ButtonBase>
    );
};

const StatCell = ({ label, views, visitors }) => (
    <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{label}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: { md: '1.05rem', xl: '1.25rem' }, lineHeight: 1.3 }}>{(views ?? 0).toLocaleString()}</Typography>
        {visitors != null && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                {visitors.toLocaleString()} {visitors === 1 ? 'visitor' : 'visitors'}
            </Typography>
        )}
    </Box>
);

const BubbleContent = ({ data, onOpenTraffic }) => (
    <Box sx={{ p: { xs: 2, md: 1.5, xl: 2 } }}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Site Traffic</Typography>
            {/* Up top so it's reachable without scrolling the bubble. */}
            <Link component="button" variant="caption" onClick={() => onOpenTraffic(null)} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                See full traffic &rsaquo;
            </Link>
        </Stack>
        {data.onlineNow > 0 ? (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 1 }} title="Visitors active in the last 5 minutes">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                <Typography variant="caption" color="text.secondary">{data.onlineNow} on the site now</Typography>
            </Stack>
        ) : <Box sx={{ mb: 1 }} />}

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, mb: 1.5 }}>
            <StatCell label="Today" views={data.today.views} visitors={data.today.visitors} />
            <StatCell label="7 days" views={data.week.views} visitors={data.week.visitors} />
            <StatCell label="30 days" views={data.month.views} visitors={data.month.visitors} />
            <StatCell label="All time" views={data.allTimeViews} />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Page views per day</Typography>
        <DailyBars daily={data.daily} height={44} />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 0.25 }}>Top locations (30 days)</Typography>
        {data.topLocations.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No visits yet.</Typography>
        ) : data.topLocations.map((l) => (
            <PercentRow
                key={`${l.city}|${l.regionCode}|${l.countryCode}`}
                label={l.label}
                percent={l.percent}
                dense
                onClick={() => onOpenTraffic(locationFilter(l))}
            />
        ))}
        {!data.locationsEnabled && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Location lookup is still starting up — new visits will show a city shortly.
            </Typography>
        )}

        {data.trackingSince && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1.25 }}>
                Tracking since {new Date(data.trackingSince).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </Typography>
        )}
    </Box>
);

// Always-visible traffic summary on the Admin page. On desktop it floats in the right
// lane directly under the floating ad (or in the ad's spot when no ad is showing); on
// phones there's no lane, so it sits at the top of the page instead.
export const TrafficBubble = ({ onOpenTraffic }) => {
    const { adVisible, adStackTop } = useAdLane();
    const [data, setData] = useState(null);

    useEffect(() => {
        const load = () => axios.get('/api/admin/analytics/overview').then(({ data: d }) => setData(d)).catch(() => {});
        load();
        const timer = setInterval(load, 60000);
        return () => clearInterval(timer);
    }, []);

    if (!data) return null;
    // While the ad is showing but hasn't measured itself yet, wait rather than briefly
    // rendering on top of it.
    const desktopTop = adVisible ? adStackTop : AD_TOP;

    return (
        <>
            {desktopTop != null && (
                <Paper
                    elevation={6}
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        position: 'fixed',
                        top: desktopTop,
                        right: 20,
                        width: { md: 200, lg: 240, xl: 280 },
                        maxHeight: `calc(100vh - ${desktopTop + 16}px)`,
                        overflowY: 'auto',
                        zIndex: 1200,
                        border: '1px solid',
                        borderColor: 'secondary.light'
                    }}
                >
                    <BubbleContent data={data} onOpenTraffic={onOpenTraffic} />
                </Paper>
            )}
            <Paper variant="outlined" sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}>
                <BubbleContent data={data} onOpenTraffic={onOpenTraffic} />
            </Paper>
        </>
    );
};
