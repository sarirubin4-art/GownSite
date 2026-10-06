import { useCallback, useEffect, useRef, useState } from 'react';

// Drop-in replacement for `useState('')` on a form's error message that also scrolls
// the error into view every time one is set — so a user who clicks Submit at the bottom
// of a long form isn't left guessing why nothing happened. Attach the returned ref to
// the element showing the error (usually an <Alert>). Scrolls on every set, not just
// when the text changes, since resubmitting with the same mistake should still jump
// back up to it.
const useFormError = () => {
    const [error, setErrorState] = useState('');
    const [showCount, setShowCount] = useState(0);
    const errorRef = useRef(null);

    const setError = useCallback((message) => {
        setErrorState(message);
        if (message) setShowCount((n) => n + 1);
    }, []);

    useEffect(() => {
        if (showCount && errorRef.current) {
            errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [showCount]);

    return [error, setError, errorRef];
};

export default useFormError;
