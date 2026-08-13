import React, { createContext, useContext } from 'react';

// Lets any page know whether the floating ad widget is currently showing, so a row
// that runs all the way to the right edge (a filter bar's trailing button, a tab
// strip) can reserve just enough space to clear it — without shifting the page's
// overall centering, which stays on the full viewport at all times.
const AdLaneContext = createContext({ adVisible: false, laneWidth: 220 });

export const AdLaneProvider = ({ adVisible, children }) => (
    <AdLaneContext.Provider value={{ adVisible, laneWidth: 220 }}>
        {children}
    </AdLaneContext.Provider>
);

export const useAdLane = () => useContext(AdLaneContext);
