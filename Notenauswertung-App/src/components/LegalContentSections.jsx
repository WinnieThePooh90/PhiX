import React from 'react';

/** Wiederverwendbare Darstellung von Impressum-/DSGVO-Abschnitten. */
export default function LegalContentSections({ sections }) {
  return (
    <div className="program-view-stack">
      {sections.map((section) => (
        <section
          key={section.id}
          className="app-info-section glass-panel legal-content-section"
          aria-labelledby={`legal-${section.id}-heading`}
        >
          <h4 id={`legal-${section.id}-heading`} className="program-view-panel-heading">
            {section.heading}
          </h4>
          {section.lines?.map((line) => (
            <p key={line} className="legal-content-line">
              {line}
            </p>
          ))}
          {section.paragraphs?.map((text) => (
            <p key={text} className="legal-content-paragraph text-muted">
              {text}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
