import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const HIDE_DELAY = 1000;
const MIN_THUMB_SIZE = 28;
const TRACK_INSET = 4;

function getMetrics(element) {
  const { clientHeight, scrollHeight, scrollTop } = element;
  const trackHeight = Math.max(0, clientHeight - TRACK_INSET * 2);
  const canScroll = scrollHeight > clientHeight + 1;
  const thumbHeight = canScroll
    ? Math.min(
        trackHeight,
        Math.max(MIN_THUMB_SIZE, (clientHeight / scrollHeight) * trackHeight),
      )
    : 0;
  const thumbTop = canScroll
    ? TRACK_INSET +
      (scrollTop / (scrollHeight - clientHeight)) * (trackHeight - thumbHeight)
    : 0;

  return { canScroll, thumbHeight, thumbTop };
}

const ScrollContainer = forwardRef(function ScrollContainer(
  { children, className = "", onScroll, ...props },
  ref,
) {
  const viewportRef = useRef(null);
  const hideTimerRef = useRef(null);
  const dragRef = useRef(null);
  const thumbHeightRef = useRef(0);
  const [isVisible, setIsVisible] = useState(false);
  const [metrics, setMetrics] = useState({
    canScroll: false,
    thumbHeight: 0,
    thumbTop: 0,
  });

  const setViewportRef = useCallback(
    (node) => {
      viewportRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  const updateScrollbar = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const next = getMetrics(viewport);
    thumbHeightRef.current = next.thumbHeight;
    setMetrics((prev) =>
      prev.canScroll === next.canScroll &&
      prev.thumbHeight === next.thumbHeight &&
      Math.abs(prev.thumbTop - next.thumbTop) < 0.5
        ? prev
        : next,
    );
  }, []);

  const showScrollbar = useCallback(() => {
    window.clearTimeout(hideTimerRef.current);
    setIsVisible(true);
    hideTimerRef.current = window.setTimeout(
      () => setIsVisible(false),
      HIDE_DELAY,
    );
  }, []);

  useLayoutEffect(() => {
    updateScrollbar();

    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return () => {};

    const observer = new ResizeObserver(updateScrollbar);
    observer.observe(viewport);

    return () => {
      observer.disconnect();
      window.clearTimeout(hideTimerRef.current);
    };
  }, [updateScrollbar]);

  useEffect(() => {
    updateScrollbar();
  });

  const handleScroll = (event) => {
    updateScrollbar();
    showScrollbar();
    onScroll?.(event);
  };

  const handleThumbPointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: viewportRef.current?.scrollTop ?? 0,
    };
    showScrollbar();
  };

  const handleThumbPointerMove = (event) => {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !viewport) return;

    const trackHeight = viewport.clientHeight - TRACK_INSET * 2;
    const availableThumbTravel = trackHeight - thumbHeightRef.current;
    const availableScroll = viewport.scrollHeight - viewport.clientHeight;
    if (availableThumbTravel <= 0 || availableScroll <= 0) return;

    viewport.scrollTop =
      drag.startScrollTop +
      ((event.clientY - drag.startY) / availableThumbTravel) * availableScroll;
    showScrollbar();
  };

  const handleThumbPointerUp = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    showScrollbar();
  };

  return (
    <div
      className="argon-scroll"
      onMouseEnter={showScrollbar}
      onMouseMove={showScrollbar}
      onFocusCapture={showScrollbar}
    >
      <div
        {...props}
        ref={setViewportRef}
        className={`argon-scroll-viewport${className ? ` ${className}` : ""}`}
        onScroll={handleScroll}
      >
        {children}
      </div>

      {metrics.canScroll && (
        <div
          aria-hidden="true"
          className={`argon-scroll-track${isVisible ? " argon-scroll-track--visible" : ""}`}
        >
          <div
            className="argon-scroll-thumb"
            style={{
              height: metrics.thumbHeight,
              transform: `translateY(${metrics.thumbTop}px)`,
            }}
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerUp}
            onPointerCancel={handleThumbPointerUp}
          />
        </div>
      )}
    </div>
  );
});

export { ScrollContainer };
