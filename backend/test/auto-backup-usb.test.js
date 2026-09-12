'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { rotateUsbBackups, rotateLocalBackups } = require('../lib/auto-backup-service');
const { listAvailableDrives } = require('../lib/drive-detector');

test('drive-detector: listAvailableDrives gibt ein Array zurück', () => {
  const drives = listAvailableDrives();
  assert.ok(Array.isArray(drives));
});

test('rotateUsbBackups: rotiert Backups im Hauptverzeichnis auf retentionCount', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phix-usb-test-'));
  try {
    const files = [
      'phix-autobackup-2026-09-01T00-00-00.json',
      'phix-autobackup-2026-09-08T00-00-00.json',
      'phix-autobackup-2026-09-15T00-00-00.json',
      'other-file.txt',
    ];

    for (const f of files) {
      fs.writeFileSync(path.join(tempDir, f), 'test-content', 'utf8');
    }

    // Behalte nur 2 Backups
    const deleted = rotateUsbBackups(tempDir, 2);
    assert.strictEqual(deleted, 1);

    const remaining = fs.readdirSync(tempDir);
    assert.ok(remaining.includes('phix-autobackup-2026-09-15T00-00-00.json'));
    assert.ok(remaining.includes('phix-autobackup-2026-09-08T00-00-00.json'));
    assert.ok(!remaining.includes('phix-autobackup-2026-09-01T00-00-00.json'));
    assert.ok(remaining.includes('other-file.txt'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
