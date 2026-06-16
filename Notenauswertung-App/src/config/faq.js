/** FAQ-Inhalte (synchron mit Paulokat Webpage / phix.html). */
export const FAQ_ITEMS = [
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
      'Ganz ehrlich: Ohne KI wäre eine solche Software für mich als Hobbyentwickler einfach nicht machbar gewesen. Sprich: Die Software ist mit KI-Unterstützung entstanden. Wenn du grundsätzlich keine KI-unterstützt entwickelte Software nutzen möchtest, ist das vollkommen in Ordnung und ich bitte in diesem Fall davon abzusehen, PhiX zu nutzen.',
  },
  {
    id: 'name',
    question: 'Warum der Name „PhiX“?',
    answer:
      'Das griechische, große Phi wird häufig in der Physik genutzt und war daher für mich zur Nutzung naheliegend. Da ich es auch schon für meine Software zur Katalogisierung von Physiksammlungen (EquiPhi) genutzt habe, finde ich es einfach konsequent, das Symbol weiter zu nutzen. Und beachte das Wortspiel: Mit PhiX geht die Notenauswertung richtig fix! ;)',
  },
  {
    id: 'accuracy',
    question: 'Kann ich sicher gehen, dass meine Noten auch wirklich korrekt berechnet werden?',
    answer:
      'Vertrauen ist gut, Kontrolle ist besser. Ich habe die Software ausgiebig getestet und nutze sie auch selbst. Ich habe versucht, die Notenberechnungen so offen und klar wie möglich darzulegen (etwa durch das Nachvollziehen der Berechnung der Noten oder durch Visualisierung der Notenschlüssel). Trotzdem ist keine Software perfekt und kleinere Fehler möchte ich nicht per se ausschließen. Falls du Fehler oder Ungereimtheiten entdeckst, zögere bitte nicht, mich zu kontaktieren.',
  },
  {
    id: 'security',
    question: 'Sind die Schülerdaten sicher gespeichert?',
    answer:
      'Ja: Alle Daten (Namen, Noten, Klassen usw.) werden mit AES-256-GCM verschlüsselt gespeichert. AES-256 gilt auch gegenüber quantencomputergestützten Angriffen noch als sehr robust. Trotzdem gilt auch hier: Die Daten sind nur mit einem starken Benutzerpasswort zuverlässig geschützt!',
  },
  {
    id: 'password',
    question: 'Ich habe mein Passwort vergessen, was nun?',
    answer:
      'Wenn du dein Passwort vergessen hast, kannst du es mit deinem persönlichen Recovery-Key neu setzen. Der Recovery-Key wird dir beim ersten Login einmal angezeigt und zum Kopieren/Download angeboten. Wenn du allerdings auch den Recovery-Key verloren hast, gibt es leider keine Möglichkeit mehr, an die Daten zu gelangen. Das ist eben der Preis für Datensicherheit.',
  },
  {
    id: 'excel',
    question: 'Ich habe doch meine Notentabellen, weshalb sollte ich auf PhiX umsteigen?',
    answer:
      'Guter Punkt: Never change a running system. Wenn du also mit deinen Tabellen gut zurecht kommst und nicht im Datenchaos versinkst und dich nicht auf ein neues System einlassen kannst oder möchtest, dann ist das völlig in Ordnung und nachvollziehbar. Aber: PhiX bietet alles unter einem Dach und deckt viele Sonderfälle wie Projekte, Nachschreiber oder GFS mit ab. Kurzum: PhiX macht das Auswerten und das Notenerstellen schlicht einfacher und schneller, deshalb lohnt sich ein Umstieg ja vielleicht doch?',
  },
  {
    id: 'server',
    question:
      'Ich möchte PhiX als Server in meiner Schule für meine Kollegen anbieten. Kann ich Hilfe bei der Installation erwarten?',
    answer:
      'Selbstverständlich stehe ich mit Rat und Tat zur Seite. Doch bevor du einen Server auf einem Schulnetzwerk installierst, kläre dies bitte mit der Schulleitung und dem Datenschutzbeauftragten (evtl. sogar dem Beauftragten des Landes) ab, um nicht in rechtliche Grauzonen oder gar Schwierigkeiten zu geraten. Die Software sollte alle Datenschutzmechanismen vorweisen und eine Nutzung auf einem Schulserver sollte dahingehend kein Problem sein, aber sie ist nicht offiziell zugelassen/bestätigt. Für die private Nutzung gilt diese Einschränkung nicht.',
  },
  {
    id: 'apple',
    question: 'Ich nutze einen Mac oder ein iPad. Gibt es für Apple-Geräte auch PhiX-Versionen?',
    answer:
      'Nein, leider nicht. Für das Apple-Ökosystem zu entwickeln ist sehr mühsam und ohne eigene Geräte eigentlich nicht machbar. Deshalb wird es auch in Zukunft keine Apple-Versionen geben.',
  },
];
