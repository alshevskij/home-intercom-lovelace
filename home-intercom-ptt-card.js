class HomeIntercomPttCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = {};
    this._rooms = {};
    this._status = {};
    this._busy = false;
    this._recording = null;
    this._pressing = false;
    this._refreshTimer = null;
    this._ready = false;
    this._loading = false;
  }

  setConfig(config) {
    this._config = {
      title: "Интерком", subtitle: "Удерживайте, чтобы говорить",
      footer_text: "Голосовое сообщение будет воспроизведено на выбранной колонке",
      show_title: true, show_subtitle: true, show_footer: true, show_all: true,
      all_label: "Всем", all_hint: "Передать во все комнаты", all_sent_text: "",
      online_text: "На связи", offline_text: "Недоступна",
      unsupported_text: "Нет поддержки воспроизведения",
      recording_text: "Идёт запись… отпустите для отправки",
      sending_text: "Отправка…", sent_text: "Сообщение отправлено",
      error_text: "Ошибка", max_duration: 60, refresh_interval: 15,
      layout: "grid", columns: 3, button_size: 68, button_radius: 50,
      room_radius: 14, card_radius: 12, gap: 10, padding: 16,
      pulse: true, compact: false, glass: true, glow: true,
      colors: {}, room_names: {}, room_icons: {},
      ...config,
      colors: { ...(config.colors || {}) },
      room_names: { ...(config.room_names || {}) },
      room_icons: { ...(config.room_icons || {}) }
    };
    this._render();
    this._startRefresh();
    this._load();
  }

  set hass(value) {
    this._hass = value;
    if (!this._ready) this._load();
  }

  connectedCallback() {
    this._startRefresh();
  }

  disconnectedCallback() {
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    this._refreshTimer = null;
    if (this._recording) {
      try { this._recording.recorder.stop(); } catch (_) {}
    }
  }

  get _base() {
    return "/api/home_intercom";
  }

  _authHeaders(extra = {}) {
    const token = this._hass?.auth?.data?.access_token;
    return {
      ...extra,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  async _load() {
    if (!this._hass || !this.shadowRoot || this._loading || this._ready) return;
    this._loading = true;
    try {
      const [roomsResp, statusResp] = await Promise.all([
        fetch(`${this._base}/rooms`, { credentials: "same-origin" }),
        fetch(`${this._base}/rooms/status`, { credentials: "same-origin" })
      ]);
      if (!roomsResp.ok) throw new Error(`Комнаты: HTTP ${roomsResp.status}`);
      this._rooms = await roomsResp.json();
      this._status = statusResp.ok ? await statusResp.json() : {};
      this._ready = true;
      this._render();
    } catch (err) {
      this._showError(`Не удалось загрузить Home Intercom: ${err.message}`);
    } finally {
      this._loading = false;
    }
  }

  _startRefresh() {
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    this._refreshTimer = setInterval(() => this._refreshStatus(), Math.max(5, Number(this._config.refresh_interval) || 15) * 1000);
  }

  async _refreshStatus() {
    if (!this._hass) return;
    try {
      const response = await fetch(`${this._base}/rooms/status`, {
        credentials: "same-origin",
        cache: "no-store"
      });
      if (response.ok) {
        this._status = await response.json();
        if (!this._recording && !this._busy) this._render();
      }
    } catch (_) {}
  }

  _showError(message) {
    const node = this.shadowRoot?.querySelector(".error");
    if (node) node.textContent = message;
  }

  _render() {
    if (!this.shadowRoot) return;
    const root = this.shadowRoot;
    root.innerHTML = `
      <style>
        :host { display:block; box-sizing:border-box; }
        ha-card {
          position:relative; isolation:isolate; overflow:hidden; display:block;
          padding:var(--hic-padding,16px); color:var(--hic-text,#d6d7de);
          background:var(--hic-card-bg,radial-gradient(circle at 18% 0%,rgba(96,165,250,.10),transparent 58%),rgba(10,12,18,.62));
          border:1px solid var(--hic-card-border,rgba(120,150,200,.42));
          border-radius:var(--hic-card-radius,28px);
          box-shadow:0 8px 32px rgba(0,0,0,.32),0 0 24px -14px var(--hic-glow-color,rgba(96,165,250,.45));
          backdrop-filter:blur(16px) saturate(150%); -webkit-backdrop-filter:blur(16px) saturate(150%);
          transition:box-shadow .5s ease,border-color .5s ease;
        }
        ha-card::before { content:""; position:absolute; inset:0; z-index:0; pointer-events:none; border-radius:inherit;
          background:radial-gradient(circle at 15% 0%,rgba(96,165,250,.10),transparent 58%); opacity:.9; }
        ha-card.recording-active { border-color:var(--hic-recording,var(--success-color,#4ade80));
          box-shadow:0 0 30px -12px var(--hic-recording,var(--success-color,#4ade80)),0 8px 32px rgba(0,0,0,.35); }
        ha-card > * { position:relative; z-index:1; }
        ha-card.flat { background:var(--ha-card-background,var(--card-background-color)); border-color:var(--divider-color); box-shadow:var(--ha-card-box-shadow,none); backdrop-filter:none; -webkit-backdrop-filter:none; }
        ha-card.flat::before { display:none; }
        .heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 0 14px; padding:2px 4px; }
        .title { font-size:var(--ha-font-size-xl,20px); font-weight:600; letter-spacing:.1px; color:var(--hic-title,var(--hic-text,#d6d7de)); }
        .hint { color:var(--hic-subtitle,rgba(214,215,222,.62)); font-size:12px; font-weight:400; }
        .grid { display:grid; grid-template-columns:repeat(var(--hic-columns,3),minmax(0,1fr)); gap:var(--hic-gap,10px); }
        .grid.list { grid-template-columns:1fr; }
        .room { min-width:0; padding:12px 12px 10px; border:1px solid var(--hic-room-border,rgba(255,255,255,.09));
          border-radius:var(--hic-room-radius,18px); display:flex; flex-direction:column; align-items:center;
          gap:9px; background:var(--hic-room-bg,rgba(255,255,255,.045));
          box-shadow:inset 0 1px 0 rgba(255,255,255,.025); transition:background .25s,border-color .25s,box-shadow .25s; }
        .room.all { grid-column:1/-1; flex-direction:row; justify-content:space-between; padding:12px 14px; }
        .grid.list .room:not(.all) { flex-direction:row; justify-content:space-between; padding:11px 14px; }
        .room-info { min-width:0; width:100%; text-align:center; }
        .all .room-info,.grid.list .room-info { text-align:left; }
        .name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; font-weight:600; color:var(--hic-text,#d6d7de); }
        .state { margin-top:4px; color:var(--hic-state,rgba(214,215,222,.62)); font-size:11px; min-height:14px; }
        .ptt { width:var(--hic-button-size,68px); height:var(--hic-button-size,68px); border:1px solid var(--hic-button-border,rgba(255,255,255,.13));
          border-radius:var(--hic-button-radius,50%); color:var(--hic-button-text,#d6d7de); background:var(--hic-button-bg,rgba(255,255,255,.08));
          display:grid; place-items:center; cursor:pointer; touch-action:none; user-select:none; -webkit-user-select:none;
          box-shadow:0 3px 12px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.07); transition:transform .15s,background .2s,opacity .2s,box-shadow .2s; flex:0 0 auto; }
        .ptt:hover:not(:disabled) { box-shadow:0 0 18px -7px var(--hic-glow-color,rgba(96,165,250,.7)),inset 0 1px 0 rgba(255,255,255,.12); }
        .all .ptt { width:calc(var(--hic-button-size,68px) * .8); height:calc(var(--hic-button-size,68px) * .8); background:var(--hic-all-button-bg,rgba(96,165,250,.16)); border-color:rgba(96,165,250,.3); }
        .ptt:active { transform:scale(.94); }
        .ptt.recording { background:var(--hic-recording,var(--success-color,#4ade80)); color:#07130b; border-color:var(--hic-recording,var(--success-color,#4ade80)); transform:scale(1.06); box-shadow:0 0 24px -5px var(--hic-recording,var(--success-color,#4ade80)); }
        .ptt.recording.pulse { animation:pulse 1.1s ease-in-out infinite; }
        .ptt:disabled { opacity:.28; cursor:not-allowed; box-shadow:none; }
        .mic { width:25px; height:25px; fill:currentColor; pointer-events:none; }
        .all .mic { width:22px; height:22px; }
        .custom-icon { font-size:25px; line-height:1; pointer-events:none; }
        .dot { display:inline-block; width:7px; height:7px; margin-right:6px; border-radius:50%; background:var(--disabled-text-color); vertical-align:1px; }
        .dot.online { background:var(--hic-online,#4ade80); box-shadow:0 0 9px var(--hic-online,#4ade80); }
        .dot.offline { background:var(--hic-offline,#9ca3af); }
        .error { color:var(--error-color); font-size:12px; margin-top:10px; }
        .footer { margin-top:12px; color:var(--hic-subtitle,rgba(214,215,222,.55)); font-size:11px; text-align:center; }
        .compact .room { padding:8px 10px; gap:6px; }
        @keyframes pulse { 0%,100% { box-shadow:0 0 0 0 color-mix(in srgb,var(--hic-recording,var(--success-color,#4ade80)) 35%,transparent); } 50% { box-shadow:0 0 0 10px transparent; } }
        @media (max-width:520px) { .grid:not(.list) { grid-template-columns:repeat(2,minmax(0,1fr)); gap:calc(var(--hic-gap,10px) * .8); } }
      </style>
      <ha-card>
        <div class="heading">
          <span class="title"></span><span class="hint"></span>
        </div>
        <div class="grid"></div><div class="error" role="status"></div><div class="footer"></div>
      </ha-card>`;

    const cfg = this._config;
    const colors = cfg.colors || {};
    const card = root.querySelector('ha-card');
    const cssVars = {
      '--hic-card-bg': colors.card_background, '--hic-card-border': colors.card_border, '--hic-glow-color': colors.glow, '--hic-text': colors.text,
      '--hic-title': colors.title, '--hic-subtitle': colors.subtitle,
      '--hic-room-bg': colors.room_background, '--hic-room-border': colors.room_border, '--hic-button-border': colors.button_border,
      '--hic-button-bg': colors.button_background, '--hic-button-text': colors.button_text,
      '--hic-all-button-bg': colors.all_button_background, '--hic-recording': colors.recording,
      '--hic-online': colors.online, '--hic-offline': colors.offline, '--hic-state': colors.state,
      '--hic-card-radius': cfg.card_radius + 'px', '--hic-room-radius': cfg.room_radius + 'px',
      '--hic-button-radius': cfg.button_radius + '%', '--hic-button-size': cfg.button_size + 'px',
      '--hic-gap': cfg.gap + 'px', '--hic-padding': cfg.padding + 'px', '--hic-columns': cfg.columns
    };
    Object.entries(cssVars).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') card.style.setProperty(key, value); });
    card.classList.toggle('flat', cfg.glass === false);
    card.classList.toggle('recording-active', Boolean(this._recording) && cfg.glow !== false);
    if (!cfg.show_title) root.querySelector('.title').hidden = true;
    else root.querySelector('.title').textContent = cfg.title || 'Интерком';
    if (!cfg.show_subtitle) root.querySelector('.hint').hidden = true;
    else root.querySelector('.hint').textContent = cfg.subtitle || '';
    if (!cfg.show_footer) root.querySelector('.footer').hidden = true;
    else root.querySelector('.footer').textContent = cfg.footer_text || '';
    const grid = root.querySelector('.grid');
    if (cfg.layout === 'list') grid.classList.add('list');
    if (cfg.compact) grid.classList.add('compact');
    if (!this._ready) {
      const loading = document.createElement('div'); loading.className = 'state'; loading.textContent = 'Загрузка комнат…'; grid.append(loading); return;
    }
    if (cfg.show_all !== false) grid.append(this._makeRoom('all', cfg.all_label || 'Всем', true));
    for (const [id, room] of Object.entries(this._rooms || {})) {
      if (id === 'all') continue;
      grid.append(this._makeRoom(id, cfg.room_names?.[id] || room.name || id, false));
    }
  }

  _makeRoom(id, name, isAll) {
    const room = document.createElement('div'); room.className = `room${isAll ? ' all' : ''}`;
    const info = document.createElement('div'); info.className = 'room-info';
    const title = document.createElement('div'); title.className = 'name';
    title.textContent = `${isAll ? '📢 ' : ''}${name}`;
    const state = document.createElement('div'); state.className = 'state';
    let online = true;
    if (!isAll) {
      const status = this._status?.[id];
      const statusName = typeof status === 'object' ? status.status : status;
      online = statusName === 'online';
      const dot = document.createElement('span'); dot.className = `dot ${online ? 'online' : 'offline'}`;
      state.append(dot, document.createTextNode(online ? (this._config.online_text || 'На связи') :
        statusName === 'no_play_media' ? (this._config.unsupported_text || 'Нет поддержки воспроизведения') : (this._config.offline_text || 'Недоступна')));
    } else state.textContent = this._config.all_hint || 'Передать во все комнаты';
    info.append(title, state);
    const button = document.createElement('button'); button.className = 'ptt'; button.type = 'button';
    button.title = `Удерживайте, чтобы говорить: ${name}`; button.setAttribute('aria-label', button.title);
    const customIcon = this._config.room_icons?.[id] || (isAll ? '📢' : '');
    if (customIcon) { const icon = document.createElement('span'); icon.className = 'custom-icon'; icon.textContent = customIcon; button.append(icon); }
    else button.innerHTML = `<svg class="mic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2Z"/></svg>`;
    if (!online) button.disabled = true;
    button.addEventListener('pointerdown', event => {
      if (button.disabled || this._busy) return; event.preventDefault(); this._pressing = true;
      try { button.setPointerCapture(event.pointerId); } catch (_) {}
      this._startRecording(id, button, state);
    });
    const stop = event => { if (event) event.preventDefault(); this._pressing = false; this._stopRecording(); };
    button.addEventListener('pointerup', stop); button.addEventListener('pointercancel', stop);
    button.addEventListener('lostpointercapture', () => { if (this._recording) { this._pressing = false; this._stopRecording(); } });
    button.addEventListener('contextmenu', e => e.preventDefault());
    room.append(info, button); return room;
  }

  async _startRecording(target, button, state) {
    if (this._recording || this._busy) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      state.textContent = "Для микрофона нужен HTTPS";
      this._pressing = false;
      return;
    }

    try {
      const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });
      const stream = await streamPromise;
      if (!this._pressing) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      const preferred = ["audio/webm;codecs=opus", "audio/mp4"];
      let options = {};
      if (window.MediaRecorder?.isTypeSupported) {
        const mimeType = preferred.find(type => MediaRecorder.isTypeSupported(type));
        if (mimeType) options.mimeType = mimeType;
      }
      const recorder = new MediaRecorder(stream, options);
      const chunks = [];
      recorder.addEventListener("dataavailable", event => {
        if (event.data?.size) chunks.push(event.data);
      });
      recorder.addEventListener("stop", async () => {
        stream.getTracks().forEach(track => track.stop());
        this._recording = null;
        this.shadowRoot?.querySelector('ha-card')?.classList.remove('recording-active');
        button.classList.remove("recording", "pulse");
        button.disabled = true;
        state.textContent = this._config.sending_text || "Отправка…";
        await this._sendRecording(target, chunks, button, state);
      }, { once: true });

      this._recording = { recorder, target, button, state };
      this.shadowRoot?.querySelector('ha-card')?.classList.add('recording-active');
      recorder.start();
      button.classList.add("recording");
      if (this._config.pulse !== false) button.classList.add("pulse");
      state.textContent = this._config.recording_text || "Идёт запись… отпустите для отправки";
      const maxMs = Math.max(5, Number(this._config.max_duration) || 60) * 1000;
      this._maxTimer = setTimeout(() => {
        if (this._recording?.recorder === recorder) {
          this._pressing = false;
          this._stopRecording();
        }
      }, maxMs);
    } catch (error) {
      this._pressing = false;
      state.textContent = error?.name === "NotAllowedError"
        ? "Нет доступа к микрофону"
        : `Ошибка микрофона: ${error.message || error}`;
    }
  }

  _stopRecording() {
    if (this._maxTimer) clearTimeout(this._maxTimer);
    this._maxTimer = null;
    const active = this._recording;
    if (active && active.recorder.state === "recording") {
      try { active.recorder.stop(); } catch (_) {}
    }
  }

  async _sendRecording(target, chunks, button, state) {
    this._busy = true;
    try {
      const blob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" });
      if (!blob.size) throw new Error("Запись пустая");

      const pcm = await this._decodeToPcm(blob);
      const token = this._hass?.auth?.data?.access_token;
      if (!token) throw new Error("Не удалось получить токен Home Assistant");

      const response = await fetch(
        `${this._base}/device/record?target=${encodeURIComponent(target)}&rate=16000`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: this._authHeaders({ "Content-Type": "application/octet-stream" }),
          body: pcm
        }
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      state.textContent = target === "all"
        ? `Отправлено: ${result.rooms_sent ?? "все"} комнат`
        : (this._config.sent_text || "Сообщение отправлено");
      button.classList.remove("recording", "pulse");
      setTimeout(() => {
        if (state.isConnected) state.textContent = target === "all" ? (this._config.all_hint || "Передать во все комнаты") : (this._config.online_text || "На связи");
      }, 2500);
    } catch (error) {
      state.textContent = `${this._config.error_text || "Ошибка"}: ${error.message || error}`;
    } finally {
      button.disabled = false;
      this._busy = false;
      this.shadowRoot?.querySelector('ha-card')?.classList.remove('recording-active');
    }
  }

  async _decodeToPcm(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const context = new AudioCtx();
    let decoded;
    try {
      decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      await context.close();
    }

    const duration = decoded.duration;
    const rate = 16000;
    const offline = new OfflineAudioContext(1, Math.ceil(duration * rate), rate);
    const mono = offline.createBuffer(1, decoded.length, decoded.sampleRate);
    const sourceData = decoded.getChannelData(0);
    mono.copyToChannel(sourceData, 0);
    const source = offline.createBufferSource();
    source.buffer = mono;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return new Blob([pcm.buffer], { type: "application/octet-stream" });
  }

  getCardSize() {
    return Math.max(3, 2 + Object.keys(this._rooms || {}).length);
  }

  static getConfigElement() {
    return document.createElement("home-intercom-ptt-card-editor");
  }

  static getStubConfig() {
    return { title: "Интерком", max_duration: 60 };
  }
}

class HomeIntercomPttCardEditor extends HTMLElement {
  setConfig(config) { this._config = { title:'Интерком', subtitle:'Удерживайте, чтобы говорить', footer_text:'Голосовое сообщение будет воспроизведено на выбранной колонке', show_title:true, show_subtitle:true, show_footer:true, show_all:true, all_label:'Всем', all_hint:'Передать во все комнаты', all_sent_text:'', online_text:'На связи', offline_text:'Недоступна', unsupported_text:'Нет поддержки воспроизведения', recording_text:'Идёт запись… отпустите для отправки', sending_text:'Отправка…', sent_text:'Сообщение отправлено', max_duration:60, refresh_interval:15, layout:'grid', columns:3, button_size:68, button_radius:50, room_radius:14, card_radius:12, gap:10, padding:16, pulse:true, compact:false, glass:true, glow:true, colors:{}, room_names:{}, room_icons:{}, ...config, colors:{...(config.colors||{})}, room_names:{...(config.room_names||{})}, room_icons:{...(config.room_icons||{})} }; this._build(); this._sync(); }
  set hass(hass) { this._hass = hass; this._loadRooms(); }
  async _loadRooms() {
    if (this._roomsLoaded || !this._hass) return; this._roomsLoaded = true;
    try { const r = await fetch('/api/home_intercom/rooms', {credentials:'same-origin'}); if (r.ok) { this._rooms = await r.json(); this._addRoomFields(); } } catch (_) {}
  }
  _build() {
    if (this._built) return; this._built = true;
    this.innerHTML = `<style>
      .wrap{display:grid;gap:12px}.section{border:1px solid var(--divider-color);border-radius:12px;padding:12px}
      .section h3{font-size:14px;margin:0 0 10px;font-weight:600}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      label{display:flex;flex-direction:column;gap:5px;font-size:13px;color:var(--primary-text-color)}
      input,select{box-sizing:border-box;width:100%;min-height:36px;padding:6px 8px;border:1px solid var(--divider-color);border-radius:8px;background:var(--card-background-color);color:var(--primary-text-color);font:inherit}
      input[type=checkbox]{width:18px;min-height:18px;accent-color:var(--primary-color)} input[type=color]{padding:2px;height:38px}
      .check{display:flex;flex-direction:row;align-items:center;gap:8px;min-height:36px}.color-wrap{display:flex;gap:6px}.color-wrap input{flex:1;min-width:0}.color-wrap button{border:1px solid var(--divider-color);border-radius:8px;background:var(--secondary-background-color);color:var(--primary-text-color);padding:0 9px}.muted{font-size:12px;color:var(--secondary-text-color);margin-top:6px}
      @media(max-width:500px){.fields{grid-template-columns:1fr}}
    </style><div class="wrap">
      <section class="section"><h3>Основное</h3><div class="fields">
        <label>Заголовок<input data-path="title" type="text"></label><label>Подсказка сверху<input data-path="subtitle" type="text"></label>
        <label>Подпись снизу<input data-path="footer_text" type="text"></label><label>Название кнопки «Всем»<input data-path="all_label" type="text"></label>
        <label>Подпись кнопки «Всем»<input data-path="all_hint" type="text"></label><label>Текст после отправки всем<input data-path="all_sent_text" type="text" placeholder="Автоматически: количество комнат"></label><label>Максимальная запись, секунд<input data-path="max_duration" type="number" min="5" max="180"></label><label>Обновление статусов, секунд<input data-path="refresh_interval" type="number" min="5" max="120"></label>
      </div><div class="fields" style="margin-top:8px">
        <label class="check"><input data-path="show_title" type="checkbox"> Показывать заголовок</label>
        <label class="check"><input data-path="show_subtitle" type="checkbox"> Показывать подсказку</label>
        <label class="check"><input data-path="show_footer" type="checkbox"> Показывать подпись снизу</label>
        <label class="check"><input data-path="show_all" type="checkbox"> Показывать кнопку «Всем»</label>
      </div></section>
      <section class="section"><h3>Тексты и статусы</h3><div class="fields">
        <label>Колонка доступна<input data-path="online_text" type="text"></label><label>Колонка недоступна<input data-path="offline_text" type="text"></label>
        <label>Нет поддержки воспроизведения<input data-path="unsupported_text" type="text"></label><label>Во время записи<input data-path="recording_text" type="text"></label>
        <label>Во время отправки<input data-path="sending_text" type="text"></label><label>После отправки<input data-path="sent_text" type="text"></label>
      </div></section>
      <section class="section"><h3>Расположение и размеры</h3><div class="fields">
        <label>Расположение комнат<select data-path="layout"><option value="grid">Сетка</option><option value="list">Список</option></select></label>
        <label>Колонок на широком экране<input data-path="columns" type="number" min="1" max="6"></label>
        <label>Размер кнопки, px<input data-path="button_size" type="number" min="40" max="120"></label>
        <label>Форма кнопки<select data-path="button_radius"><option value="50">Круглая</option><option value="18">Скруглённая</option><option value="8">Квадратная</option></select></label>
        <label>Скругление комнат, px<input data-path="room_radius" type="number" min="0" max="32"></label>
        <label>Скругление карточки, px<input data-path="card_radius" type="number" min="0" max="40"></label>
        <label>Расстояние между комнатами, px<input data-path="gap" type="number" min="0" max="32"></label>
        <label>Внутренний отступ карточки, px<input data-path="padding" type="number" min="0" max="40"></label>
      </div><div class="fields" style="margin-top:8px"><label class="check"><input data-path="compact" type="checkbox"> Компактный вид</label><label class="check"><input data-path="pulse" type="checkbox"> Пульсация при записи</label></div></section>
      <section class="section"><h3>Стиль и эффекты</h3><div class="fields">
        <label class="check"><input data-path="glass" type="checkbox"> Стеклянный эффект и размытие</label>
        <label class="check"><input data-path="glow" type="checkbox"> Свечение рамки при записи</label>
      </div><div class="muted">Стиль по умолчанию — тёмное стекло с мягким голубым свечением, в духе панели компьютера.</div></section>
      <section class="section"><h3>Цвета</h3><div class="fields">
        <label>Фон карточки<input data-path="colors.card_background" type="color"></label><label>Обводка карточки<input data-path="colors.card_border" type="color"></label>
        <label>Цвет свечения<input data-path="colors.glow" type="color"></label><label>Основной текст<input data-path="colors.text" type="color"></label>
        <label>Заголовок<input data-path="colors.title" type="color"></label><label>Подсказки и подписи<input data-path="colors.subtitle" type="color"></label>
        <label>Фон комнаты<input data-path="colors.room_background" type="color"></label><label>Рамка комнаты<input data-path="colors.room_border" type="color"></label>
        <label>Кнопка микрофона<input data-path="colors.button_background" type="color"></label><label>Обводка кнопки<input data-path="colors.button_border" type="color"></label><label>Иконка кнопки<input data-path="colors.button_text" type="color"></label>
        <label>Кнопка «Всем»<input data-path="colors.all_button_background" type="color"></label><label>Цвет записи<input data-path="colors.recording" type="color"></label>
        <label>Индикатор онлайн<input data-path="colors.online" type="color"></label><label>Индикатор офлайн<input data-path="colors.offline" type="color"></label>
        <label>Текст статуса<input data-path="colors.state" type="color"></label>
      </div><div class="muted">Пустое поле цвета означает стандартный цвет текущей темы Home Assistant.</div></section>
      <section class="section"><h3>Индивидуальные комнаты</h3><div class="fields" id="room-fields"><div class="muted">Загрузка списка комнат…</div></div><div class="muted">Можно задать собственное название и эмодзи-иконку для каждой комнаты. Пустая иконка — стандартный микрофон.</div></section>
    </div>`;
    this.querySelectorAll('[data-path]').forEach(el => { el.addEventListener('change', () => this._change(el)); if (el.type === 'text') el.addEventListener('input', () => this._change(el)); });
    this.querySelectorAll('input[type=color]').forEach(input => { const wrap=document.createElement('div'); wrap.className='color-wrap'; input.parentNode.insertBefore(wrap,input); wrap.append(input); const reset=document.createElement('button'); reset.type='button'; reset.textContent='Сброс'; reset.title='Использовать цвет темы Home Assistant'; reset.addEventListener('click',()=>{this._set(input.dataset.path,'');this._sync();this._fire();}); wrap.append(reset); });
  }
  _get(path) { return path.split('.').reduce((o,k) => o?.[k], this._config); }
  _set(path, value) { const keys=path.split('.'); let obj=this._config; for (const k of keys.slice(0,-1)) obj=obj[k] ||= {}; obj[keys[keys.length-1]]=value; }
  _sync() { this.querySelectorAll('[data-path]').forEach(el => { const v=this._get(el.dataset.path); if (el.type==='checkbox') el.checked = v !== false; else if (el.type==='color') el.value = /^#[0-9a-f]{6}$/i.test(v||'') ? v : '#000000'; else el.value = v ?? ''; }); }
  _change(el) { const path=el.dataset.path; let value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value; this._set(path,value); this._fire(); }
  _fire() { this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._config},bubbles:true,composed:true})); }
  _addRoomFields() {
    const container=this.querySelector('#room-fields'); if (!container || !this._rooms) return; container.innerHTML='';
    for (const [id, room] of Object.entries(this._rooms)) {
      if (id==='all') continue;
      const name=document.createElement('label'); name.textContent=`Название: ${room.name || id}`;
      const input=document.createElement('input'); input.type='text'; input.value=this._config.room_names?.[id] || ''; input.placeholder=room.name || id;
      input.addEventListener('change',()=>{this._config.room_names[id]=input.value;this._fire();}); name.append(input);
      const icon=document.createElement('label'); icon.textContent='Иконка (эмодзи)';
      const iconInput=document.createElement('input'); iconInput.type='text'; iconInput.value=this._config.room_icons?.[id] || ''; iconInput.placeholder='🎙️';
      iconInput.addEventListener('change',()=>{this._config.room_icons[id]=iconInput.value;this._fire();}); icon.append(iconInput);
      container.append(name,icon);
    }
    if (!container.children.length) container.textContent='Комнаты пока не обнаружены.';
  }
}

customElements.define("home-intercom-ptt-card", HomeIntercomPttCard);
customElements.define("home-intercom-ptt-card-editor", HomeIntercomPttCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "home-intercom-ptt-card",
  name: "Home Intercom PTT",
  description: "Стеклянная карточка Push-to-Talk для Home Intercom с визуальным редактором",
  preview: true
});