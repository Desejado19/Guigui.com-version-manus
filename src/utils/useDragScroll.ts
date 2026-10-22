import { useEffect, useRef } from 'react';

/**
 * Hook to enable smooth mouse click-and-drag scrolling on any container element
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;
    let isDragging = false;

    const onMouseDown = (e: MouseEvent) => {
      // Ignore clicks on buttons, inputs, links, or textareas
      const target = e.target as HTMLElement;
      if (target.closest('button, input, select, textarea, a, [role="button"]')) {
        return;
      }

      isDown = true;
      isDragging = false;
      startX = e.pageX - el.offsetLeft;
      startY = e.pageY - el.offsetTop;
      scrollLeft = el.scrollLeft;
      scrollTop = el.scrollTop;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    };

    const onMouseLeave = () => {
      isDown = false;
      el.style.cursor = '';
      el.style.userSelect = '';
    };

    const onMouseUp = () => {
      isDown = false;
      el.style.cursor = '';
      el.style.userSelect = '';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const y = e.pageY - el.offsetTop;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;

      if (Math.abs(walkX) > 5 || Math.abs(walkY) > 5) {
        isDragging = true;
      }

      el.scrollLeft = scrollLeft - walkX;
      el.scrollTop = scrollTop - walkY;
    };

    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mousemove', onMouseMove);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return ref;
}
