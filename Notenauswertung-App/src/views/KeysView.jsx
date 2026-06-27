import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import GradingKeyTable from '../components/GradingKeyTable';
import CustomGradingKeyModal from '../components/CustomGradingKeyModal';
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
  buildVorlage1Bands,
  isVorlage1KeyFamilyId,
} from '../data/vorlage1GradingKey';
import {
  getBuiltinGradingKeyShortDesc,
  getFormulaKeyHelpText,
  getPlateauKeyShortDesc,
} from '../data/gradingKeyDisplay';
import { abiTemplateSimulatedMaxMismatchTooltip } from '../utils/abiTemplateSimulatedMaxWarning';
import { useDialog } from '../components/PhixDialog';
import PhixCheckboxOption from '../components/PhixCheckboxOption';
import DeferredNumberInput from '../components/DeferredNumberInput';

export default function KeysView() {
  const { config, setConfig, exams, updateExam } = useData();
  const { showConfirm } = useDialog();
  const isKursstufe = config?.kursstufe === true;
  const [maxPoints, setMaxPoints] = useState(50);
  const [showNotenpunkte, setShowNotenpunkte] = useState(isKursstufe);
  const [modalOpen, setModalOpen] = useState(false);
  const [editKey, setEditKey] = useState(null);

  useEffect(() => {
    setShowNotenpunkte(isKursstufe);
  }, [config?.id, isKursstufe]);

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
      'Diesen Notenschl\u00FCssel wirklich l\u00F6schen? Klausuren mit diesem Schl\u00FCssel werden auf Plateau 1 umgestellt.',
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

  const keys = useMemo(
    () => [
      { title: 'Plateau 1', type: '1', desc: getPlateauKeyShortDesc('1', maxPoints, showNotenpunkte), titleHelpText: getFormulaKeyHelpText('1') },
      { title: 'Plateau 2', type: '2', desc: getPlateauKeyShortDesc('2', maxPoints, showNotenpunkte), titleHelpText: getFormulaKeyHelpText('2') },
      { title: 'Plateau 3', type: '3', desc: getPlateauKeyShortDesc('3', maxPoints, showNotenpunkte), titleHelpText: getFormulaKeyHelpText('3') },
      { title: 'Linear 1', type: '4', desc: getBuiltinGradingKeyShortDesc('4', maxPoints, showNotenpunkte) },
      { title: 'Linear 2', type: '5', desc: getBuiltinGradingKeyShortDesc('5', maxPoints, showNotenpunkte) },
      { title: 'Linear 3', type: '6', desc: getBuiltinGradingKeyShortDesc('6', maxPoints, showNotenpunkte) },
    ],
    [maxPoints, showNotenpunkte],
  );

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

        <div className="keys-view-toolbar flex flex-wrap gap-4 mb-4" style={{ alignItems: 'stretch' }}>
          <div className="glass-panel keys-view-toolbar-panel" style={{ flex: '0 1 300px', maxWidth: '300px', padding: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }} className="text-muted">Simulierte Maximalpunkte:</label>
            <DeferredNumberInput
              value={maxPoints}
              defaultValue={50}
              min={0.5}
              onChange={setMaxPoints}
              style={{ width: '100%' }}
            />
            <div style={{ marginTop: '0.5rem' }}>
              <PhixCheckboxOption
                checked={showNotenpunkte}
                onChange={(e) => setShowNotenpunkte(e.target.checked)}
              >
                Notenpunkte
              </PhixCheckboxOption>
            </div>
          </div>
          <div className="glass-panel keys-view-toolbar-panel" style={{ flex: '0 1 280px', maxWidth: '320px', minWidth: 'min(100%, 220px)', padding: '1rem' }}>
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
          <div className="glass-panel keys-view-toolbar-panel" style={{ flex: '1 1 280px', minWidth: 'min(100%, 240px)', padding: '1rem' }}>
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
          </div>
        </div>
      </div>

      {customKeysWithBands.map((k) => (
        <div key={k.id} className="mb-8">
          <GradingKeyTable
            type="1"
            maxPoints={maxPoints}
            showNotenpunkte={showNotenpunkte}
            title={k.name}
            desc={
              isVorlage1KeyFamilyId(k.id)
                ? getPlateauKeyShortDesc('1', maxPoints, showNotenpunkte)
                : 'Benutzerdefinierter Schlüssel (Intervalle in % der Klausur-Maximalpunkte)'
            }
            titleHelpText={isVorlage1KeyFamilyId(k.id) ? getFormulaKeyHelpText('1') : null}
            customBands={isVorlage1KeyFamilyId(k.id) ? buildVorlage1Bands(maxPoints) : k.bands}
            pktIntegerDisplay={!!k.pktIntegerDisplay || isAbiBaWue2026KeyFamilyId(k.id) || isAbiBaWue2026Mathematik100BeFamilyId(k.id)}
            titleWarningTooltip={abiTemplateSimulatedMaxMismatchTooltip(k.id, maxPoints)}
            onEdit={isVorlage1KeyFamilyId(k.id) ? undefined : () => openEdit(k)}
            onDelete={() => handleDeleteKey(k.id)}
          />
        </div>
      ))}

      <div className="grid-3 mb-8" style={{ alignItems: 'start' }}>
        {keys.map((keyObj) => (
            <GradingKeyTable
              key={keyObj.type}
              type={keyObj.type}
              maxPoints={maxPoints}
              showNotenpunkte={showNotenpunkte}
              title={keyObj.title}
              desc={keyObj.desc}
              titleHelpText={keyObj.titleHelpText}
            />
          ))}
      </div>
    </div>
  );
}
