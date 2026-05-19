import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

const SCROLL_PARENT_SELECTOR = '.view-table-scroll, .exams-body-scroll, .view-generic-scroll';

/** Am Scroll-Container: WebKit-Track oben einziehen, damit der Pfeil nicht unter dem Max-Button liegt */
const SCROLL_CORNER_RESERVE_CLASS = 'table-max-scroll--reserve-corner';

function isEditableEventTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest('[contenteditable="true"]')) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** Pro Seite typisch eine Instanz; „M“ toggelt die zuletzt per Maus/Touch fokussierte oder die einzige. */
const maximizableInstances = [];
let lastInteractedHostEl = null;
let mKeyListenerAttached = false;

function handleWindowKeydownM(e) {
  if (e.key !== 'm' && e.key !== 'M') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.repeat) return;
  if (isEditableEventTarget(e.target)) return;

  let hostEl = lastInteractedHostEl;
  if (!hostEl || !document.body.contains(hostEl)) {
    lastInteractedHostEl = null;
    hostEl = null;
  }

  let toggleFn = null;
  if (hostEl) {
    const hit = maximizableInstances.find((i) => i.host === hostEl);
    toggleFn = hit?.toggle ?? null;
  }
  if (!toggleFn && maximizableInstances.length === 1) {
    toggleFn = maximizableInstances[0].toggle;
  }
  if (!toggleFn) return;

  e.preventDefault();
  toggleFn();
}

function syncMKeyListener() {
  if (maximizableInstances.length > 0 && !mKeyListenerAttached) {
    window.addEventListener('keydown', handleWindowKeydownM);
    mKeyListenerAttached = true;
  } else if (maximizableInstances.length === 0 && mKeyListenerAttached) {
    window.removeEventListener('keydown', handleWindowKeydownM);
    mKeyListenerAttached = false;
  }
}

export default function MaximizableTableSection({ children, title = 'Tabelle' }) {
  const [maximized, setMaximized] = useState(false);
  const hostRef = useRef(null);
  const [floatBtnStyle, setFloatBtnStyle] = useState(null);

  const syncFloatButton = useCallback(() => {
    if (maximized) {
      setFloatBtnStyle(null);
      return;
    }
    const root = hostRef.current;
    if (!root) return;
    const scrollEl = root.closest(SCROLL_PARENT_SELECTOR);
    if (!scrollEl) {
      setFloatBtnStyle(null);
      return;
    }
    const sr = scrollEl.getBoundingClientRect();
    const cs = window.getComputedStyle(scrollEl);
    const borderTop = parseFloat(cs.borderTopWidth) || 0;
    /* Deutlich über Kante + Rahmen, damit Track/Thumb nicht mehr unter dem Button liegt */
    const liftPx = 18;
    const padX = 2;
    setFloatBtnStyle({
      position: 'fixed',
      top: sr.top + borderTop - liftPx,
      right: Math.max(0, window.innerWidth - sr.right + padX),
      zIndex: 45,
      transform: 'translateY(-4px)',
    });
  }, [maximized]);

  useLayoutEffect(() => {
    if (maximized) {
      setFloatBtnStyle(null);
      return undefined;
    }

    let raf = 0;
    const scheduleSync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => syncFloatButton());
    };

    const scrollEl = hostRef.current?.closest(SCROLL_PARENT_SELECTOR);
    scrollEl?.classList.add(SCROLL_CORNER_RESERVE_CLASS);
    scheduleSync();
    const ro =
      typeof ResizeObserver !== 'undefined' && scrollEl
        ? new ResizeObserver(scheduleSync)
        : null;
    if (scrollEl && ro) ro.observe(scrollEl);

    if (scrollEl) scrollEl.addEventListener('scroll', scheduleSync, { passive: true });
    window.addEventListener('resize', scheduleSync);
    window.addEventListener('scroll', scheduleSync, { capture: true, passive: true });

    return () => {
      cancelAnimationFrame(raf);
      scrollEl?.classList.remove(SCROLL_CORNER_RESERVE_CLASS);
      if (scrollEl && ro) ro.disconnect();
      if (scrollEl) scrollEl.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('scroll', scheduleSync, { capture: true });
    };
  }, [maximized, syncFloatButton]);

  const toggle = useCallback(() => {
    setMaximized((m) => !m);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const inst = { host, toggle };
    maximizableInstances.push(inst);
    syncMKeyListener();

    const markInteracted = () => {
      lastInteractedHostEl = host;
    };
    host.addEventListener('pointerdown', markInteracted, true);

    return () => {
      host.removeEventListener('pointerdown', markInteracted, true);
      const idx = maximizableInstances.indexOf(inst);
      if (idx >= 0) maximizableInstances.splice(idx, 1);
      if (lastInteractedHostEl === host) lastInteractedHostEl = null;
      syncMKeyListener();
    };
  }, [toggle]);

  useEffect(() => {
    if (!maximized) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setMaximized(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [maximized]);

  return (
    <div ref={hostRef} className={`table-max-host${maximized ? ' table-max-host--maximized' : ''}`}>
      <div className="table-max-host__toolbar">
        <span className="table-max-host__title">{title}</span>
        <button
          type="button"
          className="table-max-host__toggle"
          style={!maximized && floatBtnStyle ? floatBtnStyle : undefined}
          onClick={toggle}
          aria-label={maximized ? 'Tabelle verkleinern' : 'Tabelle maximieren'}
          aria-keyshortcuts="M"
          title={maximized ? 'Verkleinern (Esc oder M)' : 'Vollbild (M)'}
        >
          {maximized ? <Minimize2 size={18} strokeWidth={2} aria-hidden /> : <Maximize2 size={12} strokeWidth={2} aria-hidden />}
        </button>
      </div>
      <div className="table-max-host__body">{children}</div>
    </div>
  );
}
