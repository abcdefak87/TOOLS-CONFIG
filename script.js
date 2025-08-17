(function() {
	const STORAGE_KEY = 'scanLogs';
	const SETTINGS_KEY = 'scanSettings';

	let scanLogs = [];
	let settings = {
		enableSound: true,
		enableVibration: false,
		autoFocus: false,
		showNotifications: false,
		theme: 'light'
	};

	let lastScanText = '';
	let lastScanAt = 0;

	// Elements
	const el = (id) => document.getElementById(id);
	const namaEl = el('nama');
	const jumlahEl = el('jumlah');
	const petugasEl = el('petugas');
	const catatanEl = el('catatan');
	const btnManual = el('btnManual');
	const readerEl = el('reader');
	const msgEl = el('msg');
	const logListEl = el('logList');
	const searchInputEl = el('searchInput');
	const filterModeEl = el('filterMode');
	const clearSearchEl = el('clearSearch');
	const totalScansEl = el('totalScans');
	const filteredScansEl = el('filteredScans');
	const beepEl = el('beep-sound');

	const themeToggleBtn = el('themeToggle');
	const exportBtn = el('exportBtn');
	const settingsBtn = el('settingsBtn');
	const settingsModal = el('settingsModal');
	const modalClose = settingsModal ? settingsModal.querySelector('.close') : null;
	const enableSoundEl = el('enableSound');
	const enableVibrationEl = el('enableVibration');
	const autoFocusEl = el('autoFocus');
	const showNotificationsEl = el('showNotifications');
	const exportDataBtn = el('exportData');
	const clearDataBtn = el('clearData');

	function loadSettings() {
		try {
			const raw = localStorage.getItem(SETTINGS_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				settings = Object.assign(settings, parsed || {});
			}
		} catch (e) {}
	}

	function saveSettings() {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
	}

	function applySettingsToUI() {
		if (enableSoundEl) enableSoundEl.checked = !!settings.enableSound;
		if (enableVibrationEl) enableVibrationEl.checked = !!settings.enableVibration;
		if (autoFocusEl) autoFocusEl.checked = !!settings.autoFocus;
		if (showNotificationsEl) showNotificationsEl.checked = !!settings.showNotifications;
		if (settings.theme === 'dark') {
			document.body.classList.add('dark');
		} else {
			document.body.classList.remove('dark');
		}
	}

	function requestNotificationPermissionIfNeeded() {
		if (!settings.showNotifications) return;
		if (!('Notification' in window)) return;
		if (Notification.permission === 'default') {
			Notification.requestPermission().catch(() => {});
		}
	}

	function notify(title, body) {
		if (!settings.showNotifications) return;
		if (!('Notification' in window)) return;
		if (Notification.permission === 'granted') {
			try { new Notification(title, { body }); } catch (e) {}
		}
	}

	function loadLogs() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			scanLogs = raw ? JSON.parse(raw) : [];
			if (!Array.isArray(scanLogs)) scanLogs = [];
		} catch (e) {
			scanLogs = [];
		}
	}

	function saveLogs() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(scanLogs));
	}

	function getSelectedMode() {
		const checked = document.querySelector('input[name="mode"]:checked');
		return checked && checked.value === 'keluar' ? 'KELUAR' : 'MASUK';
	}

	function playFeedback() {
		if (settings.enableSound && beepEl) {
			try {
				beepEl.currentTime = 0;
				beepEl.play().catch(() => {});
			} catch (e) {}
		}
		if (settings.enableVibration && navigator.vibrate) {
			navigator.vibrate(100);
		}
	}

	function formatTimestamp(ts) {
		const d = new Date(ts);
		const pad = (n) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	}

	function addLogEntry({ mode, nama, jumlah, petugas, catatan, source }) {
		const now = Date.now();
		const entry = {
			id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
			timestamp: now,
			mode,
			nama,
			jumlah,
			petugas,
			catatan,
			source
		};
		scanLogs.unshift(entry);
		saveLogs();
		render();
		playFeedback();
		notify('Scan Barang', `${mode} • ${nama} (${jumlah})`);
		if (settings.autoFocus && namaEl) {
			namaEl.focus();
			namaEl.select && namaEl.select();
		}
	}

	function buildLogItemHTML(entry) {
		const badgeClass = entry.mode === 'KELUAR' ? 'mode-badge out' : 'mode-badge';
		const jumlah = Number(entry.jumlah) || 0;
		const petugas = entry.petugas ? ` • Petugas: ${escapeHtml(entry.petugas)}` : '';
		const note = entry.catatan ? `<div class="note">Catatan: ${escapeHtml(entry.catatan)}</div>` : '';
		return `
			<div class="log-item" data-id="${entry.id}">
				<div>
					<div class="log-header">
						<span class="${badgeClass}">${entry.mode}</span>
						<span class="item-name">${escapeHtml(entry.nama)}</span>
					</div>
					<div class="item-meta">${formatTimestamp(entry.timestamp)} • Jumlah: ${jumlah}${petugas}</div>
					${note}
				</div>
				<div style="display:flex; align-items:center; gap:8px;">
					<button class="small-btn" data-action="copy" title="Salin">📋</button>
					<button class="small-btn" data-action="delete" title="Hapus">🗑️</button>
				</div>
			</div>
		`;
	}

	function escapeHtml(str) {
		return String(str)
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}

	function render() {
		const text = (searchInputEl && searchInputEl.value || '').toLowerCase().trim();
		const modeFilter = (filterModeEl && filterModeEl.value) || '';
		const filtered = scanLogs.filter((e) => {
			const matchesText = !text || (e.nama && String(e.nama).toLowerCase().includes(text)) || (e.catatan && String(e.catatan).toLowerCase().includes(text));
			const matchesMode = !modeFilter || e.mode === modeFilter;
			return matchesText && matchesMode;
		});

		if (totalScansEl) totalScansEl.textContent = `Total: ${scanLogs.length}`;
		if (filteredScansEl) filteredScansEl.textContent = `Ditampilkan: ${filtered.length}`;

		if (logListEl) {
			if (!filtered.length) {
				logListEl.innerHTML = '<div class="item-meta">Belum ada data</div>';
			} else {
				logListEl.innerHTML = filtered.map(buildLogItemHTML).join('');
			}
		}
	}

	function handleListClick(e) {
		const button = e.target.closest('button.small-btn');
		if (!button) return;
		const item = e.target.closest('.log-item');
		if (!item) return;
		const id = item.getAttribute('data-id');
		const action = button.getAttribute('data-action');
		if (action === 'delete') {
			const idx = scanLogs.findIndex((x) => x.id === id);
			if (idx >= 0) {
				scanLogs.splice(idx, 1);
				saveLogs();
				render();
			}
		}
		if (action === 'copy') {
			const entry = scanLogs.find((x) => x.id === id);
			if (entry) {
				const text = `${entry.mode}\t${entry.nama}\t${entry.jumlah}\t${entry.petugas || ''}\t${entry.catatan || ''}\t${formatTimestamp(entry.timestamp)}`;
				navigator.clipboard && navigator.clipboard.writeText(text).catch(() => {});
			}
		}
	}

	function initScanner() {
		if (!window.Html5QrcodeScanner) {
			msgEl && (msgEl.textContent = 'Gagal memuat kamera/QR library.');
			return;
		}
		const config = {
			fps: 10,
			qrbox: { width: 250, height: 250 },
			rememberLastUsedCamera: true,
			formatsToSupport: [
				Html5QrcodeSupportedFormats.QR_CODE,
				Html5QrcodeSupportedFormats.CODE_128,
				Html5QrcodeSupportedFormats.CODE_39,
				Html5QrcodeSupportedFormats.EAN_13,
				Html5QrcodeSupportedFormats.EAN_8,
				Html5QrcodeSupportedFormats.UPC_A,
				Html5QrcodeSupportedFormats.UPC_E,
				Html5QrcodeSupportedFormats.ITF,
				Html5QrcodeSupportedFormats.DATA_MATRIX,
				Html5QrcodeSupportedFormats.AZTEC
			]
		};
		const scanner = new Html5QrcodeScanner('reader', config, false);
		scanner.render(onScanSuccess, onScanFailure);

		function onScanSuccess(decodedText) {
			const now = Date.now();
			if (decodedText === lastScanText && (now - lastScanAt) < 1500) {
				return; // debounce identical scans
			}
			lastScanText = decodedText;
			lastScanAt = now;

			const mode = getSelectedMode();
			const jumlah = Math.max(1, parseInt(jumlahEl.value || '1', 10) || 1);
			const petugas = (petugasEl.value || '').trim();
			const catatan = (catatanEl.value || '').trim();
			const nama = decodedText.trim();

			if (nama) {
				addLogEntry({ mode, nama, jumlah, petugas, catatan, source: 'scan' });
				msgEl && (msgEl.textContent = `✅ ${mode}: ${nama} (${jumlah})`);
				if (catatanEl) catatanEl.value = '';
			}
		}

		function onScanFailure(error) {
			// Optionally handle decode errors; avoid log spam
		}
	}

	function exportCSV(rows) {
		const header = ['Timestamp', 'Mode', 'Nama', 'Jumlah', 'Petugas', 'Catatan'];
		const csv = [header]
			.concat(rows.map(r => [
				formatTimestamp(r.timestamp),
				r.mode,
				r.nama && String(r.nama).replaceAll('"', '""'),
				Number(r.jumlah) || 0,
				r.petugas ? r.petugas.replaceAll('"', '""') : '',
				r.catatan ? r.catatan.replaceAll('"', '""') : ''
			]))
			.map(row => row.map(v => `"${String(v)}"`).join(','))
			.join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		const ts = new Date();
		const pad = (n) => String(n).padStart(2, '0');
		const tsName = `${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
		a.href = url;
		a.download = `scan_logs_${tsName}.csv`;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			URL.revokeObjectURL(url);
			a.remove();
		}, 0);
	}

	function handleManualSubmit() {
		const nama = (namaEl.value || '').trim();
		if (!nama) {
			msgEl && (msgEl.textContent = 'Nama barang tidak boleh kosong.');
			return;
		}
		const jumlah = Math.max(1, parseInt(jumlahEl.value || '1', 10) || 1);
		const petugas = (petugasEl.value || '').trim();
		const catatan = (catatanEl.value || '').trim();
		const mode = getSelectedMode();
		addLogEntry({ mode, nama, jumlah, petugas, catatan, source: 'manual' });
		namaEl.value = '';
		catatanEl.value = '';
		msgEl && (msgEl.textContent = `✅ ${mode}: ${nama} (${jumlah})`);
	}

	function initQuickActions() {
		document.querySelectorAll('.qty-btn').forEach((btn) => {
			btn.addEventListener('click', () => {
				const qty = parseInt(btn.getAttribute('data-qty') || '1', 10) || 1;
				jumlahEl.value = String(qty);
				playFeedback();
			});
		});
		document.querySelectorAll('.note-btn').forEach((btn) => {
			btn.addEventListener('click', () => {
				const note = btn.getAttribute('data-note') || '';
				catatanEl.value = note;
				playFeedback();
			});
		});
	}

	function initSearchAndFilters() {
		if (searchInputEl) searchInputEl.addEventListener('input', render);
		if (filterModeEl) filterModeEl.addEventListener('change', render);
		if (clearSearchEl) clearSearchEl.addEventListener('click', () => {
			if (searchInputEl) searchInputEl.value = '';
			if (filterModeEl) filterModeEl.value = '';
			render();
		});
	}

	function initThemeToggle() {
		if (!themeToggleBtn) return;
		themeToggleBtn.addEventListener('click', () => {
			settings.theme = (settings.theme === 'dark') ? 'light' : 'dark';
			applySettingsToUI();
			saveSettings();
		});
	}

	function initSettingsModal() {
		if (!settingsBtn || !settingsModal) return;
		settingsBtn.addEventListener('click', () => {
			settingsModal.style.display = 'block';
		});
		if (modalClose) {
			modalClose.addEventListener('click', () => settingsModal.style.display = 'none');
		}
		window.addEventListener('click', (event) => {
			if (event.target === settingsModal) settingsModal.style.display = 'none';
		});

		if (enableSoundEl) enableSoundEl.addEventListener('change', (e) => { settings.enableSound = !!e.target.checked; saveSettings(); });
		if (enableVibrationEl) enableVibrationEl.addEventListener('change', (e) => { settings.enableVibration = !!e.target.checked; saveSettings(); });
		if (autoFocusEl) autoFocusEl.addEventListener('change', (e) => { settings.autoFocus = !!e.target.checked; saveSettings(); });
		if (showNotificationsEl) showNotificationsEl.addEventListener('change', (e) => { settings.showNotifications = !!e.target.checked; saveSettings(); requestNotificationPermissionIfNeeded(); });

		if (exportDataBtn) exportDataBtn.addEventListener('click', () => exportCSV(scanLogs));
		if (clearDataBtn) clearDataBtn.addEventListener('click', () => {
			if (confirm('Hapus semua data? Tindakan ini tidak bisa dibatalkan.')) {
				scanLogs = [];
				saveLogs();
				render();
			}
		});
	}

	function initExportButtons() {
		if (exportBtn) exportBtn.addEventListener('click', () => exportCSV(scanLogs));
	}

	function registerServiceWorker() {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('service-worker.js').catch(() => {});
		}
	}

	document.addEventListener('DOMContentLoaded', () => {
		loadSettings();
		applySettingsToUI();
		requestNotificationPermissionIfNeeded();

		loadLogs();
		render();

		initScanner();
		initQuickActions();
		initSearchAndFilters();
		initThemeToggle();
		initSettingsModal();
		initExportButtons();
		registerServiceWorker();

		if (btnManual) btnManual.addEventListener('click', handleManualSubmit);
		if (namaEl) namaEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleManualSubmit(); });
		if (logListEl) logListEl.addEventListener('click', handleListClick);
	});
})();