import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { HELP_CONTACT_EMAIL } from '../config/help';

const FAQ_ITEMS = [
  {
    id: 'who',
    question: 'Wer steckt hinter der Entwicklung von PhiX?',
    answer:
      'Mein Name ist Karsten Paulokat. Ich unterrichte an einem Gymnasium in Baden-Württemberg Physik, Mathematik, Informatik und NIT.',
  },
  {
    id: 'why',
    question: 'Warum die Entwicklung von PhiX?',
    answer:
      'Ich kenne es gut, Klausuren und Noten mit verschiedenen Excel-Tabellen auszuwerten. Obwohl meine genutzten Tabellen auch schon etwas fortschrittlicher waren, hatten sie aber immer lästige Limitierungen. Und mit Abweichungen wie Nachklausuren konnten sie auch schlecht umgehen. Deshalb habe ich mich dazu entschieden, eine Software zu entwickeln, die das lästige Tabellenschieben zwar nicht gänzlich verschwinden lässt, die Sache aber doch stark vereinfacht.',
  },
  {
    id: 'free',
    question: 'Ist PhiX kostenlos?',
    answer:
      'Ja: Keine Erwerbkosten, keine Werbung und auch keine versteckten Kosten. Du zahlst weder mit Geld, noch mit deinen Daten. Das einzige, was dahingehend möglich ist, ist eine freiwillige Spende. Diese schaltet keine neuen Kernfunktionen frei, da PhiX für alle vollumfänglich nutzbar sein soll. Allerdings werden mit einer Registrierung und der damit verbundenen kleinen Spende einige Farbschemas als Dankeschön freigeschalten.',
  },
  {
    id: 'ai',
    question: 'Wie weit hat KI zu der Erstellung von PhiX beigetragen?',
    answer:
      'Ganz ehrlich: Ohne KI wäre eine solche Software für mich als Hobbyentwickler einfach nicht stemmbar gewesen. Sprich: Ich habe diese Software mit KI erstellt. Wenn du Bedenken zur Nutzung einer mit Hilfe von KI erstellten Software hast, dann bitte ich dich einfach von der Nutzung von PhiX abzusehen.',
  },
  {
    id: 'name',
    question: "Warum der Name 'PhiX'?",
    answer:
      'Das griechische, große Phi wird häufig in der Physik genutzt und ich mag dieses Symbol. Da ich es auch schon für meine Software zur Katalogisierung von Physiksammlungen (EquiPhi) genutzt habe, finde ich es einfach konsequent, das Symbol weiter zu nutzen. Und beachte das Wortspiel: Mit PhiX geht die Notenauswertung richtig fix! ;)',
  },
];

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
