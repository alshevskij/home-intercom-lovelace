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
    this._maxTimer = null;
    this._previewUrl = null;
    this._recordingPanel = null;
  }

  setConfig(config) {
    if (this._preview) this._clearPreview();
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
      colors: {}, room_names: {}, room_icons: {}, groups: [], show_group_buttons: true, show_unassigned: true, swipe_lock: true,
      ...config,
      colors: { ...(config.colors || {}) },
      room_names: { ...(config.room_names || {}) },
      room_icons: { ...(config.room_icons || {}) },
      groups: Array.isArray(config.groups) ? config.groups.map((group, index) => ({ id: group.id || `group_${index + 1}`, name: group.name || `Группа ${index + 1}`, icon: group.icon || "📁", room_ids: Array.isArray(group.room_ids) ? [...group.room_ids] : [], collapsed: Boolean(group.collapsed), show_send_button: group.show_send_button !== false })) : []
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
    if (this._maxTimer) clearTimeout(this._maxTimer);
    if (this._recording) {
      this._recording.mode = 'cancel';
      try { this._recording.recorder.stop(); } catch (_) {}
      this._recording.stream?.getTracks().forEach(track => track.stop());
    }
    this._clearPreview();
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
        if (!this._recording && !this._busy && !this._preview) this._render();
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
        ha-card { position:relative; isolation:isolate; overflow:hidden; display:block; padding:var(--hic-padding,16px); color:var(--hic-text,#d6d7de);
          background:var(--hic-card-bg,radial-gradient(circle at 18% 0%,rgba(96,165,250,.10),transparent 58%),rgba(10,12,18,.62));
          border:1px solid var(--hic-card-border,rgba(120,150,200,.42)); border-radius:var(--hic-card-radius,28px);
          box-shadow:0 8px 32px rgba(0,0,0,.32),0 0 24px -14px var(--hic-glow-color,rgba(96,165,250,.45));
          backdrop-filter:blur(16px) saturate(150%); -webkit-backdrop-filter:blur(16px) saturate(150%); transition:box-shadow .5s,border-color .5s; }
        ha-card::before { content:""; position:absolute; inset:0; z-index:0; pointer-events:none; border-radius:inherit; background:radial-gradient(circle at 15% 0%,rgba(96,165,250,.10),transparent 58%); }
        ha-card.recording-active { border-color:var(--hic-recording,var(--success-color,#4ade80)); box-shadow:0 0 30px -12px var(--hic-recording,var(--success-color,#4ade80)),0 8px 32px rgba(0,0,0,.35); }
        ha-card > * { position:relative; z-index:1; }
        ha-card.flat { background:var(--ha-card-background,var(--card-background-color)); border-color:var(--divider-color); box-shadow:var(--ha-card-box-shadow,none); backdrop-filter:none; }
        ha-card.flat::before { display:none; }
        .heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 0 14px; padding:2px 4px; }
        .title { font-size:var(--ha-font-size-xl,20px); font-weight:600; color:var(--hic-title,var(--hic-text,#d6d7de)); }
        .hint,.state { color:var(--hic-subtitle,rgba(214,215,222,.62)); font-size:12px; }
        .grid { display:grid; grid-template-columns:repeat(var(--hic-columns,3),minmax(0,1fr)); gap:var(--hic-gap,10px); }
        .grid.list { grid-template-columns:1fr; }
        .room { min-width:0; padding:12px; border:1px solid var(--hic-room-border,rgba(255,255,255,.09)); border-radius:var(--hic-room-radius,18px); display:flex; flex-direction:column; align-items:center; gap:9px; background:var(--hic-room-bg,rgba(255,255,255,.045)); }
        .room.all { grid-column:1/-1; flex-direction:row; justify-content:space-between; padding:12px 14px; }
        .grid.list .room:not(.all) { flex-direction:row; justify-content:space-between; padding:11px 14px; }
        .room-info { min-width:0; width:100%; text-align:center; }
        .all .room-info,.grid.list .room-info { text-align:left; }
        .name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; font-weight:600; color:var(--hic-text,#d6d7de); }
        .state { margin-top:4px; min-height:14px; }
        .ptt-wrap { position:relative; display:flex; align-items:center; justify-content:center; flex:0 0 auto; }
        .swipe-hint { position:absolute; left:-28px; display:flex; gap:1px; color:var(--secondary-text-color,rgba(214,220,235,.62)); font-size:22px; font-weight:300; line-height:1; pointer-events:none; opacity:.58; animation:swipe-hint 1.8s ease-in-out infinite; transition:opacity .18s; }
        .swipe-hint.hidden { opacity:0; }
        .ptt { width:var(--hic-button-size,68px); height:var(--hic-button-size,68px); border:1px solid var(--hic-button-border,rgba(255,255,255,.13)); border-radius:var(--hic-button-radius,50%); color:var(--hic-button-text,#d6d7de); background:var(--hic-button-bg,rgba(255,255,255,.08)); display:grid; place-items:center; cursor:pointer; touch-action:none; user-select:none; -webkit-user-select:none; flex:0 0 auto; transform:translateX(var(--swipe-offset,0px)); transition:transform .12s ease,background .22s,border-color .22s,box-shadow .22s; }
        .ptt.swiping { transform:translateX(var(--swipe-offset,0px)) scale(.97); }
        .ptt.recording { background:var(--hic-recording,var(--success-color,#4ade80)); color:#07130b; border-color:var(--hic-recording,var(--success-color,#4ade80)); transform:translateX(var(--swipe-offset,0px)) scale(1.04); }
        .ptt.recording.pulse { animation:pulse 1.1s ease-in-out infinite; }
        .ptt.locked { background:var(--warning-color,#ffb74d); color:#241600; border-color:var(--warning-color,#ffb74d); transform:translateX(-55px) scale(1.06); box-shadow:0 0 0 4px color-mix(in srgb,var(--warning-color,#ffb74d) 22%,transparent),0 0 24px color-mix(in srgb,var(--warning-color,#ffb74d) 45%,transparent); }
        .ptt.locked.pulse { animation:locked-pulse 1.35s ease-in-out infinite; }
        .ptt:disabled { opacity:.28; cursor:not-allowed; }
        .mic { width:25px; height:25px; fill:currentColor; pointer-events:none; }
        .custom-icon { font-size:25px; line-height:1; pointer-events:none; }
        .dot { display:inline-block; width:7px; height:7px; margin-right:6px; border-radius:50%; vertical-align:1px; background:var(--disabled-text-color); }
        .dot.online { background:var(--hic-online,#4ade80); box-shadow:0 0 9px var(--hic-online,#4ade80); }
        .dot.offline { background:var(--hic-offline,#9ca3af); }
        .group { grid-column:1/-1; min-width:0; border:1px solid var(--hic-room-border,rgba(255,255,255,.10)); border-radius:var(--hic-room-radius,18px); padding:10px; background:rgba(255,255,255,.025); }
        .group-head { display:flex; align-items:center; gap:10px; width:100%; border:0; padding:4px; color:inherit; background:transparent; cursor:pointer; text-align:left; }
        .group-head > button.group-head { width:auto; flex:1; }
        .group-title { flex:1; min-width:0; font-weight:600; font-size:14px; }
        .group-count { color:var(--secondary-text-color,rgba(214,215,222,.6)); font-size:11px; }
        .group-body { display:grid; grid-template-columns:repeat(var(--hic-columns,3),minmax(0,1fr)); gap:var(--hic-gap,10px); margin-top:10px; }
        .group-body.hidden { display:none; }
        .group-body.list { grid-template-columns:1fr; }
        .group-send { width:38px; height:38px; border-radius:50%; border:1px solid rgba(96,165,250,.35); background:var(--hic-all-button-bg,rgba(96,165,250,.16)); color:inherit; display:grid; place-items:center; cursor:pointer; flex:0 0 auto; touch-action:none; user-select:none; -webkit-user-select:none; }
        .group-send:disabled { opacity:.3; }
        .group-send.locked { background:var(--warning-color,#ffb74d); color:#241600; border-color:var(--warning-color,#ffb74d); box-shadow:0 0 0 4px color-mix(in srgb,var(--warning-color,#ffb74d) 22%,transparent),0 0 22px color-mix(in srgb,var(--warning-color,#ffb74d) 42%,transparent); }
        .group-send.locked.pulse { animation:locked-pulse 1.35s ease-in-out infinite; }
        .group-send svg { width:19px; height:19px; fill:currentColor; }
        .recording-panel { display:none; margin-top:12px; padding:12px; border:1px solid var(--divider-color,rgba(255,255,255,.12)); border-radius:14px; background:rgba(255,255,255,.04); }
        .recording-panel.visible { display:grid; gap:10px; }
        .recording-panel audio { width:100%; }
        .panel-actions { display:flex; flex-wrap:wrap; gap:8px; }
        .panel-actions button,.record-stop { border:1px solid var(--divider-color,rgba(255,255,255,.2)); border-radius:10px; padding:8px 12px; color:inherit; background:var(--secondary-background-color,rgba(255,255,255,.08)); cursor:pointer; }
        .panel-actions .primary { background:var(--primary-color,#03a9f4); color:white; border-color:transparent; }
        .record-stop { display:none; margin-top:10px; }
        .record-stop.visible { display:inline-flex; }
        .error { color:var(--error-color); font-size:12px; margin-top:10px; }
        .footer { margin-top:12px; color:var(--hic-subtitle,rgba(214,215,222,.55)); font-size:11px; text-align:center; }
        .compact .room { padding:8px 10px; gap:6px; }
        @keyframes pulse { 0%,100% { box-shadow:0 0 0 0 color-mix(in srgb,var(--hic-recording,var(--success-color,#4ade80)) 35%,transparent); } 50% { box-shadow:0 0 0 10px transparent; } }
        @keyframes locked-pulse { 0%,100% { box-shadow:0 0 0 3px color-mix(in srgb,var(--warning-color,#ffb74d) 20%,transparent),0 0 18px color-mix(in srgb,var(--warning-color,#ffb74d) 30%,transparent); } 50% { box-shadow:0 0 0 7px transparent,0 0 28px color-mix(in srgb,var(--warning-color,#ffb74d) 55%,transparent); } }
        @keyframes swipe-hint { 0%,100% { transform:translateX(0); opacity:.28; } 50% { transform:translateX(-7px); opacity:.78; } }
        @media(max-width:520px) { .grid:not(.list),.group-body:not(.list) { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      </style>
      <ha-card>
        <div class="heading"><span class="title"></span><span class="hint"></span></div>
        <div class="grid"></div>
        <button class="record-stop" type="button">■ Остановить запись</button>
        <div class="recording-panel"><div class="preview-label">Предпрослушивание записи</div><audio controls></audio><div class="panel-actions"><button class="primary send-preview" type="button">Отправить</button><button class="cancel-preview" type="button">Отменить</button></div></div>
        <div class="error" role="status"></div><div class="footer"></div>
      </ha-card>`;
    const cfg=this._config, colors=cfg.colors||{}, card=root.querySelector('ha-card');
    const vars={'--hic-card-bg':colors.card_background,'--hic-card-border':colors.card_border,'--hic-glow-color':colors.glow,'--hic-text':colors.text,'--hic-title':colors.title,'--hic-subtitle':colors.subtitle,'--hic-room-bg':colors.room_background,'--hic-room-border':colors.room_border,'--hic-button-border':colors.button_border,'--hic-button-bg':colors.button_background,'--hic-button-text':colors.button_text,'--hic-all-button-bg':colors.all_button_background,'--hic-recording':colors.recording,'--hic-online':colors.online,'--hic-offline':colors.offline,'--hic-card-radius':cfg.card_radius+'px','--hic-room-radius':cfg.room_radius+'px','--hic-button-radius':cfg.button_radius+'%','--hic-button-size':cfg.button_size+'px','--hic-gap':cfg.gap+'px','--hic-padding':cfg.padding+'px','--hic-columns':cfg.columns};
    Object.entries(vars).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')card.style.setProperty(k,v);});
    card.classList.toggle('flat',cfg.glass===false); card.classList.toggle('recording-active',Boolean(this._recording)&&cfg.glow!==false);
    root.querySelector('.title').hidden=!cfg.show_title; root.querySelector('.title').textContent=cfg.title||'Интерком';
    root.querySelector('.hint').hidden=!cfg.show_subtitle; root.querySelector('.hint').textContent=cfg.subtitle||'';
    root.querySelector('.footer').hidden=!cfg.show_footer; root.querySelector('.footer').textContent=cfg.footer_text||'';
    const grid=root.querySelector('.grid'); if(cfg.layout==='list')grid.classList.add('list'); if(cfg.compact)grid.classList.add('compact');
    if(!this._ready){const loading=document.createElement('div');loading.className='state';loading.textContent='Загрузка комнат…';grid.append(loading);return;}
    if(cfg.show_all!==false)grid.append(this._makeRoom('all',cfg.all_label||'Всем',true));
    const entries=Object.entries(this._rooms||{}).filter(([id])=>id!=='all');
    const assigned=new Set();
    for(const group of (cfg.groups||[])){
      const ids=(group.room_ids||[]).filter(id=>this._rooms[id]&&!assigned.has(id));
      ids.forEach(id=>assigned.add(id));
      // Keep empty groups visible so newly created groups are immediately apparent.
      const section=document.createElement('section');section.className='group';
      const head=document.createElement('div');head.className='group-head';
      const groupState=document.createElement('div');groupState.className='state';
      const toggle=document.createElement('button');toggle.type='button';toggle.className='group-head';toggle.innerHTML='';
      const label=document.createElement('span');label.className='group-title';label.textContent=`${group.icon||'📁'} ${group.name||'Группа'}`;
      const count=document.createElement('span');count.className='group-count';count.textContent=String(ids.length);
      const chevron=document.createElement('span');chevron.textContent=group.collapsed?'▸':'▾';
      toggle.append(label,count,chevron);
      toggle.addEventListener('click',()=>{body.classList.toggle('hidden');chevron.textContent=body.classList.contains('hidden')?'▸':'▾';});
      head.append(toggle);
      if(cfg.show_group_buttons!==false&&group.show_send_button!==false){
        const send=document.createElement('button');send.type='button';send.className='group-send';send.title=`Записать и отправить группе «${group.name}»`;
        send.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2Z"/></svg>';
        send.disabled=!ids.length;
        send.addEventListener('pointerdown',e=>{if(send.disabled||this._busy||this._recording)return;e.preventDefault();this._pressing=true;this._pointerX=e.clientX;send.style.transform='';try{send.setPointerCapture(e.pointerId);}catch(_){}this._startRecording(ids,send,groupState);});
        send.addEventListener('pointermove',e=>{if(this._recording?.button!==send||this._recording.locked)return;const dx=Math.max(0,Math.min(55,this._pointerX-e.clientX));send.style.transform=dx>2?'translateX('+(-dx)+'px) scale(.97)':'';if(dx>=55&&this._config.swipe_lock!==false){this._recording.locked=true;this._pressing=false;send.classList.add('locked');send.style.transform='translateX(-55px) scale(1.06)';groupState.textContent='Запись зафиксирована';this.shadowRoot.querySelector('.record-stop').classList.add('visible');}});
        const stopGroup=e=>{if(e)e.preventDefault();if(this._recording?.button===send&&!this._recording.locked){this._pressing=false;this._finishRecording('send');}};
        send.addEventListener('pointerup',stopGroup);send.addEventListener('pointercancel',stopGroup);
        head.append(send);
      }
      const body=document.createElement('div');body.className='group-body';if(group.collapsed)body.classList.add('hidden');if(cfg.layout==='list')body.classList.add('list');
      if(ids.length){for(const id of ids){const room=this._rooms[id];body.append(this._makeRoom(id,cfg.room_names?.[id]||room.name||id,false));}}
      else {const empty=document.createElement('div');empty.className='state';empty.textContent='Добавьте устройства в настройках карточки';body.append(empty);}
      section.append(head,groupState,body);grid.append(section);
    }
    const unassigned=entries.filter(([id])=>!assigned.has(id));
    if(unassigned.length&&cfg.show_unassigned!==false){
      if((cfg.groups||[]).length){const section=document.createElement('section');section.className='group';const title=document.createElement('div');title.className='group-title';title.textContent='Без группы';section.append(title);const body=document.createElement('div');body.className='group-body';if(cfg.layout==='list')body.classList.add('list');for(const [id,room] of unassigned)body.append(this._makeRoom(id,cfg.room_names?.[id]||room.name||id,false));section.append(body);grid.append(section);}
      else for(const [id,room] of unassigned)grid.append(this._makeRoom(id,cfg.room_names?.[id]||room.name||id,false));
    }
    root.querySelector('.record-stop').addEventListener('click',()=>this._finishRecording('preview'));
    root.querySelector('.send-preview').addEventListener('click',()=>this._sendPreview());
    root.querySelector('.cancel-preview').addEventListener('click',()=>this._cancelPreview());
    this._recordingPanel=root.querySelector('.recording-panel');
  }

  _makeRoom(id,name,isAll) {
    const room=document.createElement('div');room.className=`room${isAll?' all':''}`;
    const info=document.createElement('div');info.className='room-info';
    const title=document.createElement('div');title.className='name';title.textContent=`${isAll?'📢 ':''}${name}`;
    const state=document.createElement('div');state.className='state';let online=true;
    if(!isAll){const status=this._status?.[id];const statusName=typeof status==='object'?status.status:status;online=statusName==='online';const dot=document.createElement('span');dot.className=`dot ${online?'online':'offline'}`;state.append(dot,document.createTextNode(online?(this._config.online_text||'На связи'):statusName==='no_play_media'?(this._config.unsupported_text||'Нет поддержки воспроизведения'):(this._config.offline_text||'Недоступна')));}
    else state.textContent=this._config.all_hint||'Передать во все комнаты';
    info.append(title,state);
    const wrap=document.createElement('div');wrap.className='ptt-wrap';
    const hint=document.createElement('span');hint.className='swipe-hint';hint.setAttribute('aria-hidden','true');hint.textContent='‹‹';if(this._config.swipe_lock===false)hint.classList.add('hidden');
    const button=document.createElement('button');button.className='ptt';button.type='button';button.title=`Удерживайте, затем сдвиньте влево для фиксации: ${name}`;button.setAttribute('aria-label',button.title);
    const custom=this._config.room_icons?.[id]||(isAll?'📢':'');if(custom){const icon=document.createElement('span');icon.className='custom-icon';icon.textContent=custom;button.append(icon);}else button.innerHTML='<svg class="mic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2Z"/></svg>';
    if(!online)button.disabled=true;
    button.addEventListener('pointerdown',e=>{if(button.disabled||this._busy||this._recording)return;e.preventDefault();this._pressing=true;this._pointerX=e.clientX;button.style.setProperty('--swipe-offset','0px');hint.classList.remove('hidden');try{button.setPointerCapture(e.pointerId);}catch(_){}this._startRecording(id,button,state);});
    button.addEventListener('pointermove',e=>{if(this._recording?.button!==button||this._recording.locked)return;const dx=Math.max(0,Math.min(55,this._pointerX-e.clientX));button.style.setProperty('--swipe-offset',(-dx)+'px');button.classList.toggle('swiping',dx>2);if(dx>2)hint.classList.add('hidden');if(dx>=55&&this._config.swipe_lock!==false){this._recording.locked=true;this._pressing=false;button.classList.remove('swiping');button.classList.add('locked');button.style.setProperty('--swipe-offset','-55px');hint.classList.add('hidden');state.textContent='Запись зафиксирована';this.shadowRoot.querySelector('.record-stop').classList.add('visible');}});
    const release=e=>{if(e)e.preventDefault();if(this._recording?.button!==button)return;this._pressing=false;if(!this._recording.locked)this._finishRecording('send');};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);
    button.addEventListener('lostpointercapture',()=>{if(this._recording?.button===button&&!this._recording.locked)release();});
    button.addEventListener('contextmenu',e=>e.preventDefault());
    wrap.append(hint,button);room.append(info,wrap);return room;
  }

  async _startRecording(target,button,state) {
    if(this._recording||this._busy)return;
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){state.textContent='Для микрофона нужен HTTPS';this._pressing=false;return;}
    let acquiredStream=null;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      acquiredStream=stream;
      if(!this._pressing){stream.getTracks().forEach(t=>t.stop());return;}
      const preferred=['audio/webm;codecs=opus','audio/mp4'];let options={};
      if(window.MediaRecorder?.isTypeSupported){const mime=preferred.find(t=>MediaRecorder.isTypeSupported(t));if(mime)options.mimeType=mime;}
      const recorder=new MediaRecorder(stream,options),chunks=[];
      recorder.addEventListener('dataavailable',e=>{if(e.data?.size)chunks.push(e.data);});
      const active={recorder,stream,chunks,target,button,state,locked:false,mode:'recording'};
      recorder.addEventListener('stop',()=>this._onRecordingStopped(active),{once:true});
      this._recording=active;this.shadowRoot?.querySelector('ha-card')?.classList.add('recording-active');
      recorder.start();button.classList.add('recording');if(this._config.pulse!==false)button.classList.add('pulse');
      state.textContent=this._config.recording_text||'Идёт запись… отпустите для отправки';
      this._maxTimer=setTimeout(()=>{if(this._recording===active)this._finishRecording(active.locked?'preview':'send');},Math.max(5,Number(this._config.max_duration)||60)*1000);
    }catch(error){this._pressing=false;if(this._recording?.button===button)this._recording=null;acquiredStream?.getTracks().forEach(track=>track.stop());state.textContent=error?.name==='NotAllowedError'?'Нет доступа к микрофону':`Ошибка микрофона: ${error.message||error}`;}
  }

  _finishRecording(mode) {
    const active=this._recording;if(!active||active.recorder.state!=='recording')return;
    if(this._maxTimer)clearTimeout(this._maxTimer);this._maxTimer=null;
    active.mode=mode;active.button.classList.remove('recording','pulse','locked','swiping');active.button.style.removeProperty('--swipe-offset');active.button.style.removeProperty('transform');
    this._pressing=false;try{active.recorder.stop();}catch(error){this._showError(error.message||String(error));}
  }

  _onRecordingStopped(active) {
    active.stream.getTracks().forEach(track=>track.stop());
    if(this._recording!==active)return;
    this._recording=null;this.shadowRoot?.querySelector('ha-card')?.classList.remove('recording-active');
    this.shadowRoot?.querySelector('.record-stop')?.classList.remove('visible');
    if(active.mode==='cancel')return;
    const blob=new Blob(active.chunks,{type:active.chunks[0]?.type||'audio/webm'});
    if(!blob.size){active.state.textContent='Запись пустая';return;}
    if(active.mode==='preview'){
      this._clearPreview();this._preview={...active,blob};this._previewUrl=URL.createObjectURL(blob);
      const panel=this.shadowRoot.querySelector('.recording-panel');panel.querySelector('audio').src=this._previewUrl;
      panel.querySelector('.preview-label').textContent='Прослушайте запись перед отправкой';
      panel.classList.add('visible');active.state.textContent='Запись готова к отправке';
      return;
    }
    this._sendBlob(active.target,blob,active.button,active.state);
  }

  _clearPreview() {
    if(this._previewUrl){URL.revokeObjectURL(this._previewUrl);this._previewUrl=null;}
    const panel=this.shadowRoot?.querySelector('.recording-panel');if(panel){panel.classList.remove('visible');const audio=panel.querySelector('audio');audio.pause();audio.removeAttribute('src');}
    this._preview=null;
  }

  _cancelPreview() {
    const state=this._preview?.state;this._clearPreview();if(state?.isConnected)state.textContent='Запись отменена';
  }

  async _sendPreview() {
    const preview=this._preview;if(!preview||this._busy)return;
    this._clearPreview();await this._sendBlob(preview.target,preview.blob,preview.button,preview.state);
  }

  async _sendBlob(target,blob,button,state) {
    this._busy=true;button.disabled=true;state.textContent=this._config.sending_text||'Отправка…';
    try{
      if(!blob?.size)throw new Error('Запись пустая');
      const pcm=await this._decodeToPcm(blob),token=this._hass?.auth?.data?.access_token;
      if(!token)throw new Error('Не удалось получить токен Home Assistant');
      const targets=Array.isArray(target)?target:[target];let sent=0,errors=[];
      for(const roomId of targets){
        try{
          const response=await fetch(`${this._base}/device/record?target=${encodeURIComponent(roomId)}&rate=16000`,{method:'POST',credentials:'same-origin',headers:this._authHeaders({'Content-Type':'application/octet-stream'}),body:pcm});
          const result=await response.json().catch(()=>({}));
          if(!response.ok||result.ok===false)throw new Error(result.error||`HTTP ${response.status}`);
          sent+=Number(result.rooms_sent??1);
        }catch(error){errors.push(`${roomId}: ${error.message||error}`);}
      }
      if(!sent)throw new Error(errors.join('; ')||'Не удалось отправить сообщение');
      state.textContent=Array.isArray(target)?`Отправлено группе: ${sent}/${targets.length}`:target==='all'?`Отправлено: ${sent} комнат`:(this._config.sent_text||'Сообщение отправлено');
      if(errors.length)state.textContent+=` (ошибок: ${errors.length})`;
      setTimeout(()=>{if(state.isConnected)state.textContent=Array.isArray(target)?'Групповое сообщение отправлено':target==='all'?(this._config.all_hint||'Передать во все комнаты'):(this._config.online_text||'На связи');},3500);
    }catch(error){state.textContent=`${this._config.error_text||'Ошибка'}: ${error.message||error}`;}
    finally{button.disabled=false;button.classList.remove('recording','pulse','locked');this._busy=false;this.shadowRoot?.querySelector('ha-card')?.classList.remove('recording-active');}
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
  setConfig(config) {
    this._config = {
      title:'Интерком', subtitle:'Удерживайте, чтобы говорить',
      footer_text:'Голосовое сообщение будет воспроизведено на выбранной колонке',
      show_title:true, show_subtitle:true, show_footer:true, show_all:true,
      all_label:'Всем', all_hint:'Передать во все комнаты', all_sent_text:'',
      online_text:'На связи', offline_text:'Недоступна',
      unsupported_text:'Нет поддержки воспроизведения',
      recording_text:'Идёт запись… отпустите для отправки',
      sending_text:'Отправка…', sent_text:'Сообщение отправлено',
      max_duration:60, refresh_interval:15, layout:'grid', columns:3,
      button_size:68, button_radius:50, room_radius:14, card_radius:12,
      gap:10, padding:16, pulse:true, compact:false, glass:true, glow:true,
      colors:{}, room_names:{}, room_icons:{}, groups:[],
      show_group_buttons:true, show_unassigned:true, swipe_lock:true, ...config,
      colors:{...(config.colors||{})}, room_names:{...(config.room_names||{})},
      room_icons:{...(config.room_icons||{})},
      groups:Array.isArray(config.groups)?config.groups.map((g,i)=>({
        ...g, id:g.id||`group_${i+1}`, room_ids:[...(g.room_ids||[])]
      })): []
    };
    this._build();
    this._sync();
    // Rebuild dynamic group controls after every Lovelace config update.
    // Otherwise their handlers keep references to stale group objects.
    if (this._roomsLoaded) this._addGroupFields();
  }
  set hass(hass) { this._hass = hass; this._loadRooms(); }
  async _loadRooms() {
    if (this._roomsLoaded || !this._hass) return; this._roomsLoaded = true;
    try { const r = await fetch('/api/home_intercom/rooms', {credentials:'same-origin'}); if (r.ok) { this._rooms = await r.json(); this._addRoomFields(); this._addGroupFields(); } } catch (_) {}
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
      <section class="section"><h3>Запись и группы</h3><div class="fields"><label class="check"><input data-path="swipe_lock" type="checkbox"> Фиксация записи свайпом влево</label><label class="check"><input data-path="show_group_buttons" type="checkbox"> Показывать кнопки отправки у групп</label><label class="check"><input data-path="show_unassigned" type="checkbox"> Показывать устройства без группы</label></div><div id="group-fields" style="margin-top:12px"></div></section><section class="section"><h3>Индивидуальные комнаты</h3><div class="fields" id="room-fields"><div class="muted">Загрузка списка комнат…</div></div><div class="muted">Можно задать собственное название и эмодзи-иконку для каждой комнаты. Пустая иконка — стандартный микрофон.</div></section>
    </div>`;
    this.querySelectorAll('[data-path]').forEach(el => { el.addEventListener('change', () => this._change(el)); if (el.type === 'text') el.addEventListener('input', () => this._change(el)); });
    this.querySelectorAll('input[type=color]').forEach(input => { const wrap=document.createElement('div'); wrap.className='color-wrap'; input.parentNode.insertBefore(wrap,input); wrap.append(input); const reset=document.createElement('button'); reset.type='button'; reset.textContent='Сброс'; reset.title='Использовать цвет темы Home Assistant'; reset.addEventListener('click',()=>{this._set(input.dataset.path,'');this._sync();this._fire();}); wrap.append(reset); });
  }
  _get(path) { return path.split('.').reduce((o,k) => o?.[k], this._config); }
  _set(path, value) { const keys=path.split('.'); let obj=this._config; for (const k of keys.slice(0,-1)) obj=obj[k] ||= {}; obj[keys[keys.length-1]]=value; }
  _sync() { this.querySelectorAll('[data-path]').forEach(el => { const v=this._get(el.dataset.path); if (el.type==='checkbox') el.checked = v !== false; else if (el.type==='color') el.value = /^#[0-9a-f]{6}$/i.test(v||'') ? v : '#000000'; else el.value = v ?? ''; }); }
  _change(el) { const path=el.dataset.path; let value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value; this._set(path,value); this._fire(); }
  _fire() {
    // Emit a fresh object reference so Lovelace reliably detects nested group edits.
    const config=JSON.parse(JSON.stringify(this._config));
    this.dispatchEvent(new CustomEvent('config-changed',{detail:{config},bubbles:true,composed:true}));
  }
  _addGroupFields() {
    const container=this.querySelector('#group-fields');
    if(!container)return;
    container.innerHTML='';
    const add=document.createElement('button');
    add.type='button';
    add.textContent='＋ Добавить группу';
    add.style.cssText='padding:8px 12px;border:1px solid var(--divider-color);border-radius:8px;background:var(--secondary-background-color);color:var(--primary-text-color);cursor:pointer';
    add.addEventListener('click',()=>{
      const groups=this._config.groups||(this._config.groups=[]);
      const n=groups.length+1;
      groups.push({id:`group_${Date.now()}_${n}`,name:`Группа ${n}`,icon:'📁',room_ids:[],collapsed:false,show_send_button:true});
      this._addGroupFields();
      this._fire();
    });
    container.append(add);
    const ids=Object.keys(this._rooms||{}).filter(id=>id!=='all');
    (this._config.groups||[]).forEach((initialGroup,index)=>{
      const groupId=initialGroup.id;
      const current=()=> (this._config.groups||[]).find(item=>item.id===groupId);
      const box=document.createElement('div');
      box.style.cssText='border:1px solid var(--divider-color);border-radius:10px;padding:10px;margin-top:10px';
      const fields=document.createElement('div');fields.className='fields';
      const makeInput=(labelText,key,placeholder)=>{
        const label=document.createElement('label');label.textContent=labelText;
        const input=document.createElement('input');input.type='text';
        input.value=initialGroup[key]||'';input.placeholder=placeholder||'';
        input.addEventListener('change',()=>{
          const group=current();if(!group)return;
          group[key]=input.value;
          this._fire();
        });
        label.append(input);fields.append(label);
      };
      makeInput('Название группы','name','Например, Телефоны');
      makeInput('Иконка группы','icon','📱');
      const flags=document.createElement('div');flags.className='fields';
      const collapsed=document.createElement('label');collapsed.className='check';
      const collapseInput=document.createElement('input');collapseInput.type='checkbox';
      collapseInput.checked=Boolean(initialGroup.collapsed);
      collapseInput.addEventListener('change',()=>{
        const group=current();if(!group)return;
        group.collapsed=collapseInput.checked;this._fire();
      });
      collapsed.append(collapseInput,document.createTextNode('Сворачивать при открытии'));flags.append(collapsed);
      const send=document.createElement('label');send.className='check';
      const sendInput=document.createElement('input');sendInput.type='checkbox';
      sendInput.checked=initialGroup.show_send_button!==false;
      sendInput.addEventListener('change',()=>{
        const group=current();if(!group)return;
        group.show_send_button=sendInput.checked;this._fire();
      });
      send.append(sendInput,document.createTextNode('Кнопка отправки всей группе'));flags.append(send);
      const members=document.createElement('div');members.className='fields';members.style.marginTop='8px';
      ids.forEach(id=>{
        const label=document.createElement('label');label.className='check';
        const cb=document.createElement('input');cb.type='checkbox';
        cb.checked=(initialGroup.room_ids||[]).includes(id);
        cb.addEventListener('change',()=>{
          const group=current();if(!group)return;
          group.room_ids=Array.isArray(group.room_ids)?group.room_ids:[];
          if(cb.checked&&!group.room_ids.includes(id)){
            for(const other of this._config.groups||[]){
              if(other.id!==groupId)other.room_ids=(other.room_ids||[]).filter(x=>x!==id);
            }
            group.room_ids.push(id);
          }else{
            group.room_ids=group.room_ids.filter(x=>x!==id);
          }
          this._fire();
        });
        label.append(cb,document.createTextNode(this._config.room_names?.[id]||this._rooms[id]?.name||id));
        members.append(label);
      });
      const remove=document.createElement('button');remove.type='button';
      remove.textContent='Удалить группу';
      remove.style.cssText='margin-top:8px;padding:7px 10px;border:1px solid var(--divider-color);border-radius:8px;background:transparent;color:var(--error-color);cursor:pointer';
      remove.addEventListener('click',()=>{
        this._config.groups=(this._config.groups||[]).filter(item=>item.id!==groupId);
        this._addGroupFields();this._fire();
      });
      box.append(fields,flags,document.createTextNode('Устройства в группе'),members,remove);
      container.append(box);
    });
    if(!ids.length){
      const note=document.createElement('div');note.className='muted';
      note.textContent='Список устройств пока не загружен.';container.append(note);
    }
  }

  _addRoomFields() {
    const container=this.querySelector('#room-fields'); if (!container || !this._rooms) return; container.innerHTML='';
    for (const [id, room] of Object.entries(this._rooms)) {
      if (id==='all') continue;
      const name=document.createElement('label'); name.textContent=`Название: ${this._config.room_names?.[id] || room.name || id}`;
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
