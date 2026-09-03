import React, { createContext, useContext } from 'react';

// Lets any page know whether the floating ad widget is currently showing, so a row
// that runs all the way to the right edge (a filter bar's trailing button, a tab
// strip) can reserve just enough space to clear it — without shifting the page's
// overall centering, which stays on the full viewport at all times.
// The ad widget itself grows on larger screens (see FloatingAds' width breakpoints),
// so the reserved lane grows to match — each value here is that width plus the ad's
// 20px offset from the viewport's right edge, otherwise a wider ad on a big monitor
// overlaps a lane still sized for its smaller, laptop-width self.
const LANE_SX = { xs: 0, md: '220px', lg: '260px', xl: '300px' };

const AdLaneContext = createContext({ adVisible: false, laneSx: 0, adStackTop: null });

// adStackTop is the pixel `top` a fixed element should use to sit directly under the
// desktop ad card (null until FloatingAds has measured it, or if no ad is showing) —
// see FloatingAds' onStackTopChange.
export const AdLaneProvider = ({ adVisible, adStackTop, children }) => (
    <AdLaneContext.Provider value={{ adVisible, laneSx: adVisible ? LANE_SX : 0, adStackTop: adVisible ? adStackTop : null }}>
        {children}
    </AdLaneContext.Provider>
);

export const useAdLane = () => useContext(AdLaneContext);
