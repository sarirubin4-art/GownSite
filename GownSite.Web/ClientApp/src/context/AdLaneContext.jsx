import React, { createContext, useContext } from 'react';

// Lets any page know whether the floating ad widget is currently showing, so a row
// that runs all the way to the right edge (a filter bar's trailing button, a tab
// strip) can reserve just enough space to clear it — without shifting the page's
// overall centering, which stays on the full viewport at all times.
// The ad widget itself grows on larger screens (see FloatingAds), so the reserved
// lane grows to match at the same breakpoints — otherwise a wider ad on a big
// monitor would overlap a lane sized for its smaller, laptop-width self.
const LANE_SX = { xs: 0, md: '220px', lg: '260px', xl: '320px' };

const AdLaneContext = createContext({ adVisible: false, laneSx: 0 });

export const AdLaneProvider = ({ adVisible, children }) => (
    <AdLaneContext.Provider value={{ adVisible, laneSx: adVisible ? LANE_SX : 0 }}>
        {children}
    </AdLaneContext.Provider>
);

export const useAdLane = () => useContext(AdLaneContext);
