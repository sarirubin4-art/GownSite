import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import {
    Box, Typography, Paper, Grid, Stack, Chip, Button, TextField, MenuItem, Alert,
    ToggleButtonGroup, ToggleButton, Table, TableHead, TableBody, TableRow, TableCell,
    TablePagination, Link, LinearProgress
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { DailyBars, PercentRow, PAGE_TYPE_LABELS, locationFilter } from './TrafficWidgets';

const RANGES = [
    { value: 1, label: 'Today' },
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
    { value: 0, label: 'All time' }
];

const DEVICE_OPTIONS = ['Mobile', 'Desktop', 'Tablet'];

const pageHref = (pageType, entityId, path) =>
    pageType === 'Gown' && entityId ? `/gown/${entityId}` : pageType === 'Ad' && entityId ? `/ad/${entityId}` : path;

const pageLabel = (row) => row.title
    ? `${PAGE_TYPE_LABELS[row.pageType] || row.pageType}: ${row.title}`
    : (PAGE_TYPE_LABELS[row.pageType] && row.pageType !== 'Other' ? PAGE_TYPE_LABELS[row.pageType] : row.path);

const Card = ({ title, caption, children }) => (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
        {caption && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{caption}</Typography>}
        <Box sx={{ mt: caption ? 0 : 1 }}>{children}</Box>
    </Paper>
);

const Empty = () => <Typography variant="body2" color="text.secondary">Nothing yet for this range.</Typography>;

const StatTile = ({ label, value, hint }) => (
    <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{(value ?? 0).toLocaleString()}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Paper>
);

// Full traffic breakdown plus the raw, filterable list of every recorded page view.
// `filterRequest` is how the Admin page's traffic bubble deep-links in: clicking a
// location there opens this tab already filtered to it.
const TrafficTab = ({ filterRequest, onFilterRequestHandled, laneSx }) => {
    const [days, setDays] = useState(30);
    const [overview, setOverview] = useState(null);
    const [breakdown, setBreakdown] = useState(null);
    const [breakdownError, setBreakdownError] = useState('');
    // { [key]: { label, params } } — each becomes a removable chip above the log.
    const [filters, setFilters] = useState({});
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [log, setLog] = useState({ items: [], totalCount: 0 });
    const [logLoading, setLogLoading] = useState(false);
    const logRef = useRef(null);

    useEffect(() => {
        axios.get('/api/admin/analytics/overview').then(({ data }) => setOverview(data)).catch(() => {});
    }, []);

    useEffect(() => {
        setBreakdownError('');
        axios.get('/api/admin/analytics/breakdown', { params: { days } })
            .then(({ data }) => setBreakdown(data))
            .catch(() => setBreakdownError('Could not load traffic numbers.'));
    }, [days]);

    // A request is applied once, then handed back so the parent clears it — otherwise
    // switching to another admin tab and back would remount this and re-apply a filter
    // the admin may have since removed. "See Full Traffic" sends no filter: just land on
    // the overview at the top, no scroll to the log.
    useEffect(() => {
        if (!filterRequest) return;
        if (filterRequest.filter) applyFilter(filterRequest.filter);
        onFilterRequestHandled?.();
    }, [filterRequest]);

    // Debounce the free-text search so typing doesn't fire a request per keystroke.
    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    const queryParams = () => {
        const params = { days, search: search || undefined };
        Object.values(filters).forEach((f) => Object.entries(f.params).forEach(([k, v]) => {
            if (v !== undefined && v !== null) params[k] = v;
        }));
        return params;
    };

    useEffect(() => {
        let cancelled = false;
        setLogLoading(true);
        axios.get('/api/admin/analytics/views', { params: { ...queryParams(), page: page + 1, pageSize: rowsPerPage } })
            .then(({ data }) => { if (!cancelled) setLog(data); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLogLoading(false); });
        return () => { cancelled = true; };
    }, [days, filters, search, page, rowsPerPage]);

    const applyFilter = (filter) => {
        if (filter) setFilters((prev) => ({ ...prev, [filter.key]: filter }));
        setPage(0);
        // Wait a tick so the log has re-rendered with the new chip before scrolling to it.
        setTimeout(() => logRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };

    const removeFilter = (key) => {
        setFilters((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        setPage(0);
    };

    const setSelectFilter = (key, labelPrefix, paramName, value, labelFor = (v) => v) => {
        if (!value) removeFilter(key);
        else setFilters((prev) => ({ ...prev, [key]: { key, label: `${labelPrefix}: ${labelFor(value)}`, params: { [paramName]: value } } }));
        setPage(0);
    };

    const csvHref = `/api/admin/analytics/views.csv?${new URLSearchParams(
        Object.entries(queryParams()).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString()}`;

    const rangeLabel = RANGES.find((r) => r.value === days)?.label.toLowerCase();
    const b = breakdown;
    const funnelMax = Math.max(1, b?.funnel.visitors || 0);

    return (
        <Box sx={{ mt: 2, mr: laneSx }}>
            <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <ToggleButtonGroup size="small" exclusive value={days} onChange={(e, v) => { if (v !== null) { setDays(v); setPage(0); } }}>
                    {RANGES.map((r) => <ToggleButton key={r.value} value={r.value}>{r.label}</ToggleButton>)}
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary">
                    Each page counts once per visit (a visit ends after 30 minutes of no activity). Times are Eastern. Your own visits while logged in as admin aren't counted.
                </Typography>
            </Stack>

            {breakdownError && <Alert severity="error" sx={{ mb: 2 }}>{breakdownError}</Alert>}
            {!b ? <LinearProgress sx={{ mb: 2 }} /> : (
                <>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 6, sm: 4, lg: 2.4 }}><StatTile label="Page views" value={b.totalViews} /></Grid>
                        <Grid size={{ xs: 6, sm: 4, lg: 2.4 }}><StatTile label="Unique visitors" value={b.uniqueVisitors} /></Grid>
                        <Grid size={{ xs: 6, sm: 4, lg: 2.4 }}><StatTile label="New signups" value={b.funnel.signups} /></Grid>
                        <Grid size={{ xs: 6, sm: 6, lg: 2.4 }}><StatTile label="Gowns posted" value={b.funnel.gownsPosted} /></Grid>
                        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}><StatTile label="Contact info requests" value={b.funnel.gownContactVisitors + b.funnel.adContactVisitors} hint="visitors who revealed a gown or ad's contact" /></Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        {overview && (
                            <Grid size={12}>
                                <Card title="Page views per day" caption="Last 30 days — hover a bar for that day's numbers">
                                    <DailyBars daily={overview.daily} height={120} />
                                </Card>
                            </Grid>
                        )}

                        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                            <Card title="Top cities" caption={`Share of page views, ${rangeLabel} — click one to see its visits`}>
                                {b.cities.length === 0 ? <Empty /> : b.cities.map((r) => (
                                    <PercentRow
                                        key={`${r.city}|${r.regionCode}|${r.countryCode}`}
                                        label={r.label} percent={r.percent} count={r.count}
                                        onClick={() => applyFilter(locationFilter(r))}
                                    />
                                ))}
                            </Card>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                            <Card title="States & countries" caption="US visits by state; everywhere else by country">
                                {b.regions.length === 0 ? <Empty /> : b.regions.map((r) => (
                                    <PercentRow
                                        key={`${r.regionCode}|${r.countryCode}|${r.label}`}
                                        label={r.label} percent={r.percent} count={r.count}
                                        onClick={() => applyFilter(locationFilter(r))}
                                    />
                                ))}
                            </Card>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                            <Card title="Where visitors come from" caption="Share of visits (first page of each visit)">
                                {b.sources.length === 0 ? <Empty /> : b.sources.map((r) => (
                                    <PercentRow
                                        key={r.key} label={r.label} percent={r.percent} count={r.count}
                                        onClick={() => applyFilter({ key: 'source', label: `Came from: ${r.label}`, params: { source: r.key } })}
                                    />
                                ))}
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                    WhatsApp usually hides where a click came from, so those visits land under "Direct". Add <strong>?utm_source=whatsapp</strong> to links you share there (e.g. regowned.com/search?utm_source=whatsapp) and they'll be counted as WhatsApp.
                                </Typography>
                            </Card>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                            <Card title="Phone vs. computer" caption="Share of page views">
                                {b.devices.length === 0 ? <Empty /> : b.devices.map((r) => (
                                    <PercentRow
                                        key={r.label} label={r.label} percent={r.percent} count={r.count}
                                        onClick={r.key ? () => applyFilter({ key: 'device', label: `Device: ${r.label}`, params: { device: r.key } }) : undefined}
                                    />
                                ))}
                            </Card>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                            <Card title="Visitor journey" caption={`Out of ${b.funnel.visitors.toLocaleString()} visitors, ${rangeLabel}`}>
                                {[
                                    ['Visited the site', b.funnel.visitors],
                                    ['Requested a gown owner\'s contact', b.funnel.gownContactVisitors],
                                    ['Requested an advertiser\'s contact', b.funnel.adContactVisitors],
                                    ['Signed up', b.funnel.signups],
                                    ['Posted a gown', b.funnel.gownsPosted]
                                ].map(([label, value]) => (
                                    <Box key={label} sx={{ py: 0.6 }}>
                                        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                                            <Typography variant="body2">{label}</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{value.toLocaleString()}</Typography>
                                        </Stack>
                                        <Box sx={{ height: 4, mt: 0.4, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
                                            <Box sx={{ height: '100%', width: `${Math.max((value / funnelMax) * 100, value > 0 ? 1 : 0)}%`, bgcolor: 'primary.main', borderRadius: 2 }} />
                                        </Box>
                                    </Box>
                                ))}
                            </Card>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                            <Card title="Searches with no results" caption="What people looked for that nobody has listed — click to copy">
                                {b.noResultSearches.length === 0 ? <Empty /> : b.noResultSearches.map((r) => (
                                    <Stack key={r.detail} direction="row" spacing={1} sx={{ justifyContent: 'space-between', py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                                        <Typography variant="body2" sx={{ minWidth: 0, cursor: 'copy' }} onClick={() => navigator.clipboard?.writeText(r.detail)}>{r.detail}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }} title={`Last searched ${new Date(r.lastSeen).toLocaleString()}`}>
                                            {r.count}×
                                        </Typography>
                                    </Stack>
                                ))}
                            </Card>
                        </Grid>

                        <Grid size={{ xs: 12, lg: 6 }}>
                            <Card title="Most viewed pages" caption="Click a row to see its visits">
                                {b.topPages.length === 0 ? <Empty /> : (
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Page</TableCell>
                                                <TableCell align="right">Views</TableCell>
                                                <TableCell align="right">Visitors</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {b.topPages.map((p) => (
                                                <TableRow
                                                    key={`${p.pageType}|${p.entityId}|${p.path}`} hover sx={{ cursor: 'pointer' }}
                                                    onClick={() => applyFilter(p.entityId
                                                        ? { key: 'page', label: `Page: ${pageLabel(p)}`, params: { pageType: p.pageType, entityId: p.entityId } }
                                                        : { key: 'page', label: `Page: ${pageLabel(p)}`, params: { pageType: p.pageType, search: p.pageType === 'Other' ? p.path : undefined } })}
                                                >
                                                    <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pageLabel(p)}</TableCell>
                                                    <TableCell align="right">{p.count.toLocaleString()}</TableCell>
                                                    <TableCell align="right">{p.visitors.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </Card>
                        </Grid>

                        <Grid size={{ xs: 12, lg: 6 }}>
                            <Card title="Ad performance" caption={`Live ads, ${rangeLabel} — "Shown" counts once per visit`}>
                                {b.ads.length === 0 ? <Empty /> : (
                                    <Box sx={{ overflowX: 'auto' }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Ad</TableCell>
                                                    <TableCell align="right">Shown</TableCell>
                                                    <TableCell align="right">Ad clicks</TableCell>
                                                    <TableCell align="right">Page views</TableCell>
                                                    <TableCell align="right">Website clicks</TableCell>
                                                    <TableCell align="right">Contacts</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {b.ads.map((a) => (
                                                    <TableRow key={a.adId}>
                                                        <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            <Link component={RouterLink} to={`/ad/${a.adId}`}>{a.title}</Link>
                                                        </TableCell>
                                                        <TableCell align="right">{a.impressions.toLocaleString()}</TableCell>
                                                        <TableCell align="right">{a.cardClicks.toLocaleString()}</TableCell>
                                                        <TableCell align="right">{a.views.toLocaleString()}</TableCell>
                                                        <TableCell align="right">{a.websiteClicks.toLocaleString()}</TableCell>
                                                        <TableCell align="right">{a.contacts.toLocaleString()}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Box>
                                )}
                            </Card>
                        </Grid>
                    </Grid>
                </>
            )}

            <Box ref={logRef} sx={{ mt: 4, scrollMarginTop: 80 }}>
                <Stack direction="row" useFlexGap spacing={1.5} sx={{ flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography variant="h6">Every page view ({rangeLabel})</Typography>
                    <Button size="small" variant="outlined" startIcon={<DownloadIcon />} href={csvHref}>Export to CSV</Button>
                </Stack>
                <Stack direction="row" useFlexGap spacing={1.5} sx={{ flexWrap: 'wrap', mb: 1.5 }}>
                    <TextField size="small" label="Search page, place, or source" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} sx={{ minWidth: 240 }} />
                    <TextField
                        select size="small" label="Page type" sx={{ minWidth: 160 }}
                        value={filters.page && !filters.page.params.entityId ? filters.page.params.pageType : ''}
                        onChange={(e) => setSelectFilter('page', 'Page', 'pageType', e.target.value, (v) => PAGE_TYPE_LABELS[v] || v)}
                    >
                        <MenuItem value="">All pages</MenuItem>
                        {Object.entries(PAGE_TYPE_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                    </TextField>
                    <TextField
                        select size="small" label="Device" sx={{ minWidth: 130 }}
                        value={filters.device?.params.device || ''}
                        onChange={(e) => setSelectFilter('device', 'Device', 'device', e.target.value)}
                    >
                        <MenuItem value="">All devices</MenuItem>
                        {DEVICE_OPTIONS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                    </TextField>
                </Stack>
                {Object.keys(filters).length > 0 && (
                    <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', mb: 1.5 }}>
                        {Object.values(filters).map((f) => <Chip key={f.key} label={f.label} onDelete={() => removeFilter(f.key)} color="primary" variant="outlined" />)}
                        <Button size="small" onClick={() => { setFilters({}); setPage(0); }}>Clear all</Button>
                    </Stack>
                )}

                <Paper variant="outlined">
                    {logLoading && <LinearProgress />}
                    <Box sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Time</TableCell>
                                    <TableCell>Page</TableCell>
                                    <TableCell>Location</TableCell>
                                    <TableCell>Came from</TableCell>
                                    <TableCell>Device</TableCell>
                                    <TableCell>Visitor</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {log.items.length === 0 && !logLoading && (
                                    <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary">No page views match.</Typography></TableCell></TableRow>
                                )}
                                {log.items.map((v) => (
                                    <TableRow key={v.id} hover>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {new Date(v.createdDate).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 320 }}>
                                            <Link component={RouterLink} to={pageHref(v.pageType, v.entityId, v.path)} sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {pageLabel(v)}
                                            </Link>
                                            <Typography variant="caption" color="text.secondary">{v.path}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{v.location}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {v.isEntry ? v.source : <Typography component="span" variant="body2" color="text.secondary">within site</Typography>}
                                        </TableCell>
                                        <TableCell>{v.device}</TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small" variant="outlined" label={`#${v.visitorId.slice(0, 4)}`}
                                                title="Show everything this visitor viewed"
                                                onClick={() => applyFilter({ key: 'visitor', label: `Visitor #${v.visitorId.slice(0, 4)}`, params: { visitorId: v.visitorId } })}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Box>
                    <TablePagination
                        component="div"
                        count={log.totalCount}
                        page={page}
                        onPageChange={(e, p) => setPage(p)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                        rowsPerPageOptions={[25, 50, 100, 200]}
                    />
                </Paper>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Visitors are anonymous: the visitor code is a scrambled tag (not an IP address or account) that stays the same for one person through the calendar month, so you can follow a single visit's path.
                </Typography>
            </Box>
        </Box>
    );
};

export default TrafficTab;
