import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ_ITEMS } from '../config/faq';
import { HELP_CONTACT_EMAIL } from '../config/help';

function FaqRow({ item, expanded, onToggle }) {
  const headingId = `help-faq-${item.id}-heading`;
  const contentId = `help-faq-${item.id}-content`;

  return (
    <div className={`help-faq-row${expanded ? ' help-faq-row--open' : ''}`}>
      <button
        type="button"
        className="help-faq-row__toggle"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={contentId}
        id={headingId}
      >
        <span className="help-faq-row__question">{item.question}</span>
        <ChevronDown size={18} strokeWidth={2.25} className="help-faq-row__chevron" aria-hidden />
      </button>
      {expanded ? (
        <div id={contentId} className="help-faq-row__answer" role="region" aria-labelledby={headingId}>
          <p>{item.answer}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function HelpView() {
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const toggleFaq = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="view-generic-scroll program-view">
      <h3 className="program-view-title">Hilfe</h3>
      <section className="program-view-panel glass-panel">
        <p className="program-view-panel-text">
          Du hast einen Fehler entdeckt oder kommst einfach nicht weiter? Du hast Fragen zu PhiX? Melde
          dich einfach unverbindlich bei mir:
        </p>
        <p className="program-view-panel-text help-contact-mail-wrap">
          <a href={`mailto:${HELP_CONTACT_EMAIL}`} className="help-contact-mail">
            {HELP_CONTACT_EMAIL}
          </a>
        </p>
      </section>

      <section className="program-view-panel glass-panel help-faq-panel" aria-labelledby="help-faq-heading">
        <h4 id="help-faq-heading" className="program-view-panel-heading">
          FAQ
        </h4>
        <div className="help-faq-table" role="list">
          {FAQ_ITEMS.map((item) => (
            <FaqRow
              key={item.id}
              item={item}
              expanded={expandedIds.has(item.id)}
              onToggle={() => toggleFaq(item.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
