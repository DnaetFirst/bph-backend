import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Tooltip({ children, text, placement = 'bottom' }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    const updateCoords = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords({
          x: rect.left + rect.width / 2,
          y: placement === 'bottom' ? rect.bottom + 4 : rect.top - 4,
        });
      }
    };

    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [visible, placement]);

  return (
    <>
      <span
        ref={triggerRef}
        className="tooltip-portal-trigger"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        style={{ cursor: 'pointer' }}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            className="tooltip-portal-text"
            style={{
              position: 'fixed',
              left: coords.x,
              top: coords.y,
              transform: 'translateX(-50%)',
              zIndex: 99999,
              pointerEvents: 'none',
              opacity: 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
}
