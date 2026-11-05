import { useEffect, useRef } from 'react';

/** Move focus after a view change without stealing focus on initial load.
 * @param {string} view
 */
export function useNavigationFocus(view) {
  const previous = useRef(view);
  useEffect(() => {
    if (previous.current === view) return;
    previous.current = view;
    const main = document.getElementById('main');
    main?.focus({ preventScroll: true });
    main?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [view]);
}
