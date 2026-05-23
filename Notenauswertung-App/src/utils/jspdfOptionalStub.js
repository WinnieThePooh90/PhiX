/**
 * jsPDF lädt optionale Plugins (html2canvas, canvg, …) statisch mit.
 * PhiX nutzt nur jspdf-autotable — Stubs verhindern fehlende Abhängigkeiten im Vite-Build.
 */
const noop = () => Promise.resolve(null);

export default noop;

export const html2canvas = noop;
