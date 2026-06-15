import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import GradingKeyTable from '../components/GradingKeyTable';
import CustomGradingKeyModal from '../components/CustomGradingKeyModal';
import WarningMarkWithTooltip from '../components/WarningMarkWithTooltip';
import { useData } from '../store/DataContext';
import {
  ABI_BAWUE_2026_120_BE_KEY,
  nextAbiBaWue2026TemplateCloneIdentity,
  isAbiBaWue2026KeyFamilyId,
} from '../data/kmBwAbiPhysik2026GradingKey';
import {
  ABI_BAWUE_2026_100_BE_MATHEMATIK_KEY,
  nextAbiBaWue2026Mathematik100BeTemplateCloneIdentity,
  isAbiBaWue2026Mathematik100BeFamilyId,
} from '../data/abiBaWu2026Mathematik100BeGradingKey';
import {
  VORLAGE_1_KEY,
  VORLAGE_1_DESC,
  buildVorlage1Bands,
  nextVorlage1TemplateCloneIdentity,
  isVorlage1KeyFamilyId,
} from '../data/vorlage1GradingKey';
import { abiTemplateSimulatedMaxMismatchTooltip } from '../utils/abiTemplateSimulatedMaxWarning';
import { useDialog } from '../components/PhixDialog';

export default function KeysView() {
  const { config, setConfig, exams, updateExam } = useData();
  const { showConfirm } = useDialog();
  const [maxPoints, setMaxPoints] = useState(50);
  const [modalOpen, setModalOpen] = useState(false);
  const [editKey, setEditKey] = useState(null);

  const customKeys = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const customKeysWithBands = customKeys.filter((k) => k.bands?.length || isVorlage1KeyFamilyId(k.id));

  useEffect(() => {
    if (!modalOpen) setEditKey(null);
  }, [modalOpen]);

  const openCreate = () => {
    setEditKey(null);
    setModalOpen(true);
  };

  const openEdit = (key) => {
    setEditKey(key);
    setModalOpen(true);
  };

  const handleSaveKey = (def) => {
    setConfig((c) => {
      const list = Array.isArray(c.customGradingKeys) ? [...c.customGradingKeys] : [];
      const idx = list.findIndex((k) => k.id === def.id);
      if (idx >= 0) list[idx] = def;
      else list.push(def);
      return { ...c, customGradingKeys: list };
    });
  };

  const handleDeleteKey = async (id) => {
    const ok = await showConfirm(
      'Diesen Notenschl\u00FCssel wirklich l\u00F6schen? Klausuren mit diesem Schl\u00FCssel werden auf Schl\u00FCssel 1 umgestellt.',
      { title: 'Notenschl\u00FCssel l\u00F6schen', danger: true },
    );
    if (!ok) return;
    const prefix = `custom:${id}`;
    Object.keys(exams).forEach((num) => {
      if (exams[num]?.keyType === prefix) updateExam(num, 'keyType', '1');
    });
    setConfig((c) => ({
      ...c,
      customGradingKeys: (c.customGradingKeys || []).filter((k) => k.id !== id),
    }));
  };

  const handleAddAbiBaWu2026_120BE = () => {
    setMaxPoints(120);
    setConfig((c) => {
      const list = Array.isArray(c.customGradingKeys) ? [...c.customGradingKeys] : [];
      const { id, name } = nextAbiBaWue2026TemplateCloneIdentity(list);
      const def = {
        ...ABI_BAWUE_2026_120_BE_KEY,
        id,
        name,
        bands: ABI_BAWUE_2026_120_BE_KEY.bands.map((b) => ({ ...b })),
      };
      list.push(def);
      return { ...c, customGradingKeys: list };
    });
  };

  const handleAddAbiBaWu2026Mathematik100Be = () => {
    setMaxPoints(100);
    setConfig((c) => {
      const list = Array.isArray(c.customGradingKeys) ? [...c.customGradingKeys] : [];
      const { id, name } = nextAbiBaWue2026Mathematik100BeTemplateCloneIdentity(list);
      const def = {
        ...ABI_BAWUE_2026_100_BE_MATHEMATIK_KEY,
        id,
        name,
        bands: ABI_BAWUE_2026_100_BE_MATHEMATIK_KEY.bands.map((b) => ({ ...b })),
      };
      list.push(def);
      return { ...c, customGradingKeys: list };
    });
  };

  const handleAddVorlage1 = () => {
    setConfig((c) => {
      const list = Array.isArray(c.customGradingKeys) ? [...c.customGradingKeys] : [];
      const { id, name } = nextVorlage1TemplateCloneIdentity(list);
      const def = {
        ...VORLAGE_1_KEY,
        id,
        name,
      };
      list.push(def);
      return { ...c, customGradingKeys: list };
    });
  };

  const keys = [
    { title: 'Notenschlüssel 1', type: '1', desc: 'Note 2 ab 75% | Note 4 ab 45%' },
    { title: 'Notenschlüssel 2', type: '2', desc: 'Note 2 ab 77% | Note 4 ab 47%' },
    { title: 'Notenschlüssel 3', type: '3', desc: 'Note 2 ab 80% | Note 4 ab 50%' },
    { title: 'Notenschlüssel 4', type: '4', desc: 'Note 1,0 von 90–100 %; Note 6,0 von 0–14 %; dazwischen gleiche Stufenlogik wie 1–3' },
    { title: 'Notenschlüssel 5', type: '5', desc: 'Weitere Plateaus (88% / 18%); Mittelbereich etwas milder' },
    { title: 'Notenschlüssel 6', type: '6', desc: 'Breiteste Plateaus (85% / 22%); Mittelbereich nochmals angepasst' },
    { title: 'ABI BaWü 2026 120 BE', type: 'abi' },
  ];

  const standardKeyRows = keys.filter((k) => k.type !== 'abi');
  const abiKeyRows = keys.filter((k) => k.type === 'abi');

  return (
    <div className="view-generic-scroll">
      <CustomGradingKeyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialKey={editKey}
        onSave={handleSaveKey}
      />

      <div className="mb-8">
        <h2 className="mb-4">Notenschlüssel</h2>

        <div className="flex flex-wrap gap-4 mb-4" style={{ alignItems: 'stretch' }}>
          <div className="glass-panel" style={{ flex: '0 1 300px', maxWidth: '300px', padding: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }} className="text-muted">Simulierte Maximalpunkte:</label>
            <input
              type="number"
              value={maxPoints}
              onChange={(e) => setMaxPoints(parseFloat(e.target.value) || 0)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="glass-panel" style={{ flex: '0 1 280px', maxWidth: '320px', minWidth: 'min(100%, 220px)', padding: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }} className="text-muted">
              Eigener Notenschlüssel
            </label>
            <button
              type="button"
              className="tab active"
              onClick={openCreate}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                fontWeight: 600,
                whiteSpace: 'normal',
                textAlign: 'center',
              }}
            >
              <Plus size={20} strokeWidth={2.25} aria-hidden />
              Neuen Notenschlüssel erstellen
            </button>
          </div>
          <div className="glass-panel" style={{ flex: '1 1 280px', minWidth: 'min(100%, 240px)', padding: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }} className="text-muted">
              Vorlagen
            </label>
            <button
              type="button"
              className="tab secondary"
              onClick={handleAddAbiBaWu2026_120BE}
              style={{
                width: '100%',
                padding: '0.55rem 1rem',
                fontWeight: 600,
                whiteSpace: 'normal',
                textAlign: 'center',
              }}
              title="120 Bewertungseinheiten; simulierte und Klausur-Maximalpunkte idealerweise 120"
            >
              Vorlage: ABI BaWü 2026 120 BE
            </button>
            <button
              type="button"
              className="tab secondary"
              onClick={handleAddAbiBaWu2026Mathematik100Be}
              style={{
                width: '100%',
                marginTop: '0.5rem',
                padding: '0.55rem 1rem',
                fontWeight: 600,
                whiteSpace: 'normal',
                textAlign: 'center',
              }}
              title="100 Bewertungseinheiten; simulierte und Klausur-Maximalpunkte idealerweise 100"
            >
              Vorlage: ABI BaWü 2026 100 BE Mathematik
            </button>
            <button
              type="button"
              className="tab secondary"
              onClick={handleAddVorlage1}
              style={{
                width: '100%',
                marginTop: '0.5rem',
                padding: '0.55rem 1rem',
                fontWeight: 600,
                whiteSpace: 'normal',
                textAlign: 'center',
              }}
              title="Punktgrenzen: RUNDEN(2·(−0,15·Note+1,05)·Max)/2; rechte Grenze = Max bzw. vorige linke − 0,5"
            >
              Vorlage: Vorlage 1
            </button>
          </div>
        </div>

        {customKeys.length > 0 && (
          <div className="glass-panel mb-8" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.05rem', color: 'var(--primary)' }}>Eigene Schlüssel in diesem Kurs</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {customKeys.map((k) => {
                const refMismatchTip = abiTemplateSimulatedMaxMismatchTooltip(k.id, maxPoints);
                return (
                <li
                  key={k.id}
                  className="flex flex-wrap gap-2 items-center"
                  style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}
                >
                  <strong style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.25rem', flexWrap: 'wrap' }}>
                    <span>{k.name}</span>
                    {refMismatchTip ? <WarningMarkWithTooltip text={refMismatchTip} /> : null}
                  </strong>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                    {isVorlage1KeyFamilyId(k.id) ? '21 Stufen (Formel)' : `(${(k.bands || []).length} Stufen)`}
                  </span>
                  {!isVorlage1KeyFamilyId(k.id) ? (
                    <button type="button" className="tab secondary" style={{ marginLeft: 'auto' }} onClick={() => openEdit(k)}>
                      Bearbeiten
                    </button>
                  ) : (
                    <span style={{ marginLeft: 'auto' }} />
                  )}
                  <button type="button" className="tab secondary" onClick={() => handleDeleteKey(k.id)}>
                    Löschen
                  </button>
                </li>
              );
              })}
            </ul>
          </div>
        )}
      </div>

      {customKeysWithBands.map((k, i) => (
        <div key={k.id} className="mb-8">
          <GradingKeyTable
            type="1"
            maxPoints={maxPoints}
            title={k.name}
            desc={
              isVorlage1KeyFamilyId(k.id)
                ? VORLAGE_1_DESC
                : 'Benutzerdefinierter Schlüssel (Intervalle in % der Klausur-Maximalpunkte)'
            }
            customBands={isVorlage1KeyFamilyId(k.id) ? buildVorlage1Bands(maxPoints) : k.bands}
            pktIntegerDisplay={!!k.pktIntegerDisplay || isAbiBaWue2026KeyFamilyId(k.id) || isAbiBaWue2026Mathematik100BeFamilyId(k.id)}
            titleWarningTooltip={abiTemplateSimulatedMaxMismatchTooltip(k.id, maxPoints)}
          />
        </div>
      ))}

      <div className="grid-3 mb-8" style={{ alignItems: 'start' }}>
        {standardKeyRows.map((keyObj, i) => (
            <GradingKeyTable
              key={keyObj.type}
              type={keyObj.type}
              maxPoints={maxPoints}
              title={keyObj.title}
              desc={keyObj.desc}
            />
          ))}
      </div>

      <div className="mb-8">
        {abiKeyRows.map((keyObj, i) => (
            <GradingKeyTable
              key={keyObj.type}
              type={keyObj.type}
              maxPoints={maxPoints}
              title={keyObj.title}
              desc={keyObj.desc}
            />
          ))}
      </div>
    </div>
  );
}
