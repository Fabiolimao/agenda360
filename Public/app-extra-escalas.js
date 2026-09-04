// ==========================================
// MÓDULO: CALENDÁRIO, TURNOS E VAGAS MÁGICAS
// ==========================================

async function carregarDadosServidor() {
    const token = localStorage.getItem('agenda360_func_token');
    const funcId = localStorage.getItem('agenda360_func_id');
    try {
        const resMe = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } });
        if(resMe.ok) {
            const meData = await resMe.json();
            localStorage.setItem('agenda360_gps_nivel', meData.gps_nivel || 2); 
        }

        const res = await fetch(`/api/escalas/funcionario/${funcId}`, { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) { fazerLogout(); return; } 
        const data = await res.json();
        escalasTrabalhador = Array.isArray(data) ? data : (data.escalas || []);
        
        // 📍 PASSO 1: A GUILHOTINA (Limpa a data das Escalas na App do Trabalhador)
        if (Array.isArray(escalasTrabalhador)) {
            escalasTrabalhador.forEach(e => {
                if (e.data_inicio) e.data_inicio = e.data_inicio.split('T')[0];
                if (e.data_fim) e.data_fim = e.data_fim.split('T')[0];
            });
        }
        
        if (typeof switchTabApp === 'function') switchTabApp('tabCalendario', document.getElementById('btnTabCal'));
        if (typeof verificarAssinaturasPendentes === 'function') verificarAssinaturasPendentes(); 
    } catch (err) { console.error(err); }
}

function gerarCalendarioApp() {
    const calMesApp = document.getElementById('calMesApp');
    const calAnoApp = document.getElementById('calAnoApp');
    if (!calMesApp || !calAnoApp) return;

    const mes = parseInt(calMesApp.value); 
    const ano = parseInt(calAnoApp.value);
    const grid = document.getElementById('gridCalendarioApp'); 
    if(!grid) return;
    grid.innerHTML = '';
    
    const primeiroDia = new Date(ano, mes, 1).getDay(); 
    const totalDias = new Date(ano, mes + 1, 0).getDate();

    for(let i = 0; i < primeiroDia; i++) grid.innerHTML += `<div class="cal-day" style="background:#f8fafc; border:none; cursor:default;"></div>`;
    
    for(let dia = 1; dia <= totalDias; dia++) {
        const dataStr = `${ano}-${String(mes+1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const turnosDia = escalasTrabalhador.filter(e => e.data_inicio === dataStr);
        
        let htmlDots = '';
        turnosDia.forEach(t => {
            let classeDot = 'dot-agendado';
            if (t.status_turno === 'Concluído' || t.status_turno === 'A Aguardar Validação') classeDot = 'dot-concluido';
            if (t.status_turno === 'Falta' || t.status_turno === 'Cancelado') classeDot = 'dot-falta';
            htmlDots += `<div class="cal-dot ${classeDot}"></div>`;
        });

        const isSelecionado = (dataStr === filtroDataApp) ? 'selected' : '';

        grid.innerHTML += `
            <div class="cal-day ${isSelecionado}" onclick="filtrarTurnosPorDia('${dataStr}')">
                <div class="dia-num">${dia}</div>
                <div class="cal-dot-container">${htmlDots}</div>
            </div>
        `;
    }
}

function filtrarTurnosPorDia(dataStr) { 
    filtroDataApp = dataStr; 
    gerarCalendarioApp(); 
    renderTurnosHome(); 
}

function renderTurnosHome() {
    const container = document.getElementById('listaEscalas');
    if(!container) return;
    const dataHojeStr = new Date().toISOString().slice(0,10);
    
    let titulo = `${dic[curLang]['js_shifts_of']} ${filtroDataApp.split('-').reverse().join('/')}`;
    if(filtroDataApp === dataHojeStr) titulo = dic[curLang]['js_today_shifts'];
    if(document.getElementById('tituloFiltroTurnos')) document.getElementById('tituloFiltroTurnos').innerText = titulo;

    const listagem = escalasTrabalhador.filter(e => e.data_inicio === filtroDataApp);

    if (listagem.length === 0) {
        container.innerHTML = `<div class="empty-state">${dic[curLang]['js_free_day']}</div>`; return;
    }

    container.innerHTML = '';
    listagem.forEach(e => {
        let btnHTML = ''; let statusClass = 'agendado';

        // 📍 BLINDAGEM MÁXIMA DE FUSO HORÁRIO PARA A APP
        const extrairHHMM = (valor) => {
            if (!valor) return '';
            const vStr = String(valor);
            if (vStr.includes('T')) return vStr.split('T')[1].substring(0, 5);
            if (vStr.includes(' ')) return vStr.split(' ')[1].substring(0, 5);
            return vStr.substring(0, 5);
        };

        let txtPausaCard = '';
        if (e.timestamp_inicio_pausa && e.timestamp_fim_pausa) {
            const hI = extrairHHMM(e.timestamp_inicio_pausa) || extrairHHMM(e.hora_inicio_pausa);
            const hF = extrairHHMM(e.timestamp_fim_pausa) || extrairHHMM(e.hora_fim_pausa);
            const pReal = e.minutos_pausa_realizados || '-';
            txtPausaCard = `<div class="shift-detail" style="color:#166534; font-weight:bold; margin-top:4px; background:#f0fdf4; padding:4px 8px; border-radius:4px; display:inline-block;">☕ Pausa: ${hI} - ${hF} (${pReal} min)</div>`;
        } else if (e.timestamp_inicio_pausa && !e.timestamp_fim_pausa) {
            const hI = extrairHHMM(e.timestamp_inicio_pausa) || extrairHHMM(e.hora_inicio_pausa);
            txtPausaCard = `<div class="shift-detail" style="color:#b45309; font-weight:bold; margin-top:4px; background:#fef3c7; padding:4px 8px; border-radius:4px; display:inline-block;">⏸️ Em Pausa (início ${hI})</div>`;
        }
        
        if (e.status_turno === 'Falta' || e.status_turno === 'Cancelado') {
            statusClass = 'falta';
            btnHTML = `<div style="text-align:center; font-weight:bold; color:var(--danger-color); margin-top:10px;">${e.status_turno === 'Falta' ? dic[curLang]['js_missed'] : dic[curLang]['js_canc']}</div>`;
        } else if (e.status_turno === 'Concluído' || e.status_turno === 'A Aguardar Validação') {
            statusClass = 'concluido';
            btnHTML = `<div style="text-align:center; font-weight:bold; color:var(--success-color); margin-top:10px;">${dic[curLang]['js_done']}</div>`;
        } else if (e.checkin_real && !e.checkout_real) {
            statusClass = 'curso';
            let botoesPausaHTML = '';
            if (!e.timestamp_inicio_pausa) {
                botoesPausaHTML = `<button class="btn-point" style="background:#d97706; color:white; margin-bottom:8px; font-weight:bold;" onclick="executarAcaoPausa(${e.id}, 'inicio_pausa')">☕ Iniciar Pausa</button>`;
            } else if (e.timestamp_inicio_pausa && !e.timestamp_fim_pausa) {
                botoesPausaHTML = `<button class="btn-point" style="background:#2563eb; color:white; margin-bottom:8px; font-weight:bold;" onclick="executarAcaoPausa(${e.id}, 'fim_pausa')">▶️ Terminar Pausa</button>`;
            }
            btnHTML = `${botoesPausaHTML}<button class="btn-point btn-out" onclick="abrirModalCheckout(${e.id})">${dic[curLang]['js_btn_out']}</button>`;
        } else {
            const agora = new Date();
            const [anoT, mesT, diaT] = e.data_inicio.split('-').map(Number);
            const [horaT, minT] = e.hora_entrada.split(':').map(Number);
            const dataTurnoObjeto = new Date(anoT, mesT - 1, diaT, horaT, minT);
            const diffMinutos = (dataTurnoObjeto - agora) / (1000 * 60);

            if (diffMinutos > 15) {
                btnHTML = `<button class="btn-point" disabled style="background:#cbd5e1; color:#94a3b8;">${dic[curLang]['js_locked']}</button>`;
            } else if (diffMinutos < -1440) {
                btnHTML = `<div style="text-align:center; font-weight:bold; color:var(--danger-color); margin-top:10px;">${dic[curLang]['js_expired']}</div>`;
            } else {
                btnHTML = `<button class="btn-point btn-in" onclick="abrirJanelaGPS(${e.id}, 'entrada')">${dic[curLang]['js_btn_in']}</button>`;
            }
        }

        container.innerHTML += `
            <div class="shift-card ${statusClass}">
                <div class="shift-header"><span>📅 ${e.data_inicio}</span><span>${e.hora_entrada} - ${e.hora_saida}</span></div>
                <div class="shift-title">${e.nome_unidade}</div>
                <div class="shift-detail">📍 ${e.rua || '-'}, ${e.cidade || ''}</div>
                <div class="shift-detail">⚙️ ${e.funcao}</div>
                ${txtPausaCard}
                ${btnHTML}
            </div>
        `;
    });
}

// 📍 MÓDULO DA VAGA MÁGICA INDIVIDUAL
async function processarVagaMagica(vagaId) {
    let overlay = document.getElementById('modalVagaMagica');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modalVagaMagica';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:var(--bg-color, #F0F4F8); z-index:9999; display:flex !important; flex-direction:column !important; justify-content:center !important; align-items:center !important; padding:20px; box-sizing:border-box; margin:0;';
        document.body.appendChild(overlay);
    }
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    overlay.innerHTML = `<h2 style="color:var(--text-color); text-align:center;">A verificar disponibilidade... ⏳</h2>`;
    
    try {
        const token = localStorage.getItem('agenda360_func_token');
        const res = await fetch(`/api/escalas/vaga/${vagaId}`, { headers: { 'Authorization': 'Bearer ' + token } });
        
        if (!res.ok) {
            overlay.innerHTML = `
                <div style="background:white; padding:30px; border-radius:24px; box-shadow:0 10px 25px rgba(0,0,0,0.1); width:100%; max-width:400px; text-align:center;">
                    <span style="font-size:3rem; display:block;">❌</span>
                    <h2 style="color:var(--danger-color); margin-top:15px;">Erro ao ler o link</h2>
                    <p style="color:var(--text-muted); margin-bottom:25px;">Não foi possível validar esta vaga no servidor.</p>
                    <button class="btn-main" style="background:#64748b; width:100%;" onclick="fecharVagaMagica()">Ir para a minha App</button>
                </div>`;
            return;
        }
        
        const vaga = await res.json();
        
        if (vaga.status_turno !== 'Pendente') {
            overlay.innerHTML = `
                <div style="background:white; padding:30px; border-radius:24px; box-shadow:0 10px 25px rgba(0,0,0,0.1); width:100%; max-width:400px; border:2px solid var(--danger-color); text-align:center;">
                    <span style="font-size:3rem; display:block;">⚠️</span>
                    <h2 style="color:var(--danger-color); margin-top:15px; font-weight:800; letter-spacing:-1px;">VAGA FECHADA</h2>
                    <p style="color:#475569; margin-bottom:25px; line-height:1.5;">Este turno já foi aceite por outro colega ou já não se encontra disponível. Fica para a próxima!</p>
                    <button class="btn-main" style="background:#64748b; width:100%;" onclick="fecharVagaMagica()">Ir para o meu Calendário</button>
                </div>`;
        } else {
            if (vaga.data_inicio) vaga.data_inicio = vaga.data_inicio.split('T')[0];
            const dataFormatada = vaga.data_inicio.split('-').reverse().join('/');
            
            overlay.innerHTML = `
                <div style="background:white; padding:0; border-radius:24px; box-shadow:0 15px 35px -5px rgba(0,0,0,0.15); width:100%; max-width:400px; overflow:hidden; border:2px solid var(--success-color);">
                    <div style="background:var(--success-color); color:white; padding:20px; text-align:center;">
                        <span style="font-size:3rem; display:block; margin-bottom:10px;">⚡</span>
                        <h2 style="margin:0; font-weight:800; letter-spacing:-1px; font-size:1.6rem;">VAGA ENCONTRADA</h2>
                        <p style="margin:5px 0 0 0; opacity:0.9;">Sê o primeiro a aceitar e a vaga é tua!</p>
                    </div>
                    <div style="padding:25px; text-align:left;">
                        <div style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px dashed #cbd5e1;">
                            <strong style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Local de Trabalho</strong>
                            <div style="font-size:1.2rem; font-weight:800; color:var(--primary-color);">${vaga.nome_unidade}</div>
                        </div>
                        <div style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px dashed #cbd5e1;">
                            <strong style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Função</strong>
                            <div style="font-size:1.1rem; font-weight:700; color:#334155;">${vaga.funcao}</div>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:25px;">
                            <div>
                                <strong style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Data</strong>
                                <div style="font-size:1.1rem; font-weight:700; color:#b45309;">📅 ${dataFormatada}</div>
                            </div>
                            <div>
                                <strong style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase;">Horário</strong>
                                <div style="font-size:1.1rem; font-weight:700; color:#b45309;">⏰ ${vaga.hora_entrada} - ${vaga.hora_saida}</div>
                            </div>
                        </div>
                        <button class="btn-main" style="background:var(--success-color); font-size:1.1rem; padding:18px; box-shadow:0 8px 20px rgba(16, 185, 129, 0.3); width:100%;" onclick="aceitarVagaMagica(${vaga.id})">✅ Aceitar Turno</button>
                        <button class="btn-main" style="background:transparent; color:#64748b; border:none; margin-top:5px; box-shadow:none; width:100%;" onclick="fecharVagaMagica()">Recusar / Ignorar</button>
                    </div>
                </div>`;
        }
    } catch (e) {
        overlay.innerHTML = `<h2 style="color:var(--danger-color); text-align:center;">Falha de ligação. Tente novamente.</h2>`;
    }
}

async function aceitarVagaMagica(vagaId) {
    const btn = document.querySelector('#modalVagaMagica .btn-main');
    if(btn) { btn.innerText = "A Trancar Vaga... ⏳"; btn.disabled = true; }
    
    try {
        const token = localStorage.getItem('agenda360_func_token');
        const res = await fetch(`/api/escalas/vaga/${vagaId}/aceitar`, { 
            method: 'POST', 
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } 
        });
        
        if (res.ok) {
            document.getElementById('modalVagaMagica').innerHTML = `
                <div style="background:white; padding:40px 30px; border-radius:24px; box-shadow:0 10px 25px rgba(0,0,0,0.1); width:100%; max-width:400px; text-align:center;">
                    <span style="font-size:4rem; display:block; margin-bottom:15px;">🎉</span>
                    <h2 style="color:var(--success-color); font-weight:800; letter-spacing:-1px; margin-bottom:10px;">TURNO GARANTIDO!</h2>
                    <p style="color:#475569; margin-bottom:25px;">A vaga é sua. O turno já foi adicionado ao seu calendário oficial.</p>
                    <button class="btn-main" style="background:var(--primary-color); width:100%;" onclick="fecharVagaMagica()">Ver o Meu Calendário</button>
                </div>`;
        } else {
            const d = await res.json();
            alert(d.erro || "A vaga acabou de ser apanhada por outro colega! Fica para a próxima.");
            fecharVagaMagica();
        }
    } catch (e) {
        alert("Erro de servidor. Tente novamente.");
        if(btn) { btn.innerText = "✅ Aceitar Turno"; btn.disabled = false; }
    }
}

// 🛒 📍 MÓDULO DO CARRINHO DE COMPRAS DE LOTES
async function processarLoteMagico(loteIds) {
    let overlay = document.getElementById('modalVagaMagica');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modalVagaMagica';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:var(--bg-color, #F0F4F8); z-index:9999; display:flex !important; flex-direction:column !important; justify-content:center !important; align-items:center !important; padding:20px; box-sizing:border-box; margin:0;';
        document.body.appendChild(overlay);
    }
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    overlay.innerHTML = `<h2 style="color:var(--text-color); text-align:center;">A verificar lote de turnos... ⏳</h2>`;
    
    try {
        const token = localStorage.getItem('agenda360_func_token');
        const res = await fetch(`/api/escalas/lote/${loteIds}`, { headers: { 'Authorization': 'Bearer ' + token } });
        
        if (!res.ok) {
            overlay.innerHTML = `
                <div style="background:white; padding:30px; border-radius:24px; box-shadow:0 10px 25px rgba(0,0,0,0.1); width:100%; max-width:400px; text-align:center;">
                    <span style="font-size:3rem; display:block;">❌</span>
                    <h2 style="color:var(--danger-color); margin-top:15px;">Erro ao ler o Pacote</h2>
                    <p style="color:var(--text-muted); margin-bottom:25px;">Não foi possível validar estes turnos no servidor ou já foram todos preenchidos.</p>
                    <button class="btn-main" style="background:#64748b; width:100%;" onclick="fecharVagaMagica()">Ir para a minha App</button>
                </div>`;
            return;
        }
        
        const vagas = await res.json();
        
        if (Array.isArray(vagas)) {
            vagas.forEach(v => {
                if (v.data_inicio) v.data_inicio = v.data_inicio.split('T')[0];
                if (v.data_fim) v.data_fim = v.data_fim.split('T')[0];
            });
        }
        
        const vagasDisponiveis = vagas.filter(v => v.status_turno === 'Pendente');
        
        if (vagasDisponiveis.length === 0) {
            overlay.innerHTML = `
                <div style="background:white; padding:30px; border-radius:24px; box-shadow:0 10px 25px rgba(0,0,0,0.1); width:100%; max-width:400px; border:2px solid var(--danger-color); text-align:center;">
                    <span style="font-size:3rem; display:block;">⚠️</span>
                    <h2 style="color:var(--danger-color); margin-top:15px; font-weight:800; letter-spacing:-1px;">PACOTE FECHADO</h2>
                    <p style="color:#475569; margin-bottom:25px; line-height:1.5;">Todos os turnos deste pacote já foram aceites por outros colegas ou cancelados pela Agência. Fica para a próxima!</p>
                    <button class="btn-main" style="background:#64748b; width:100%;" onclick="fecharVagaMagica()">Ir para o meu Calendário</button>
                </div>`;
            return;
        }

        let listaHtml = '';
        vagasDisponiveis.forEach(v => {
            const dataFormatada = v.data_inicio.split('-').reverse().join('/');
            listaHtml += `
                <label style="display:flex; align-items:center; background:#f8fafc; padding:15px; border-radius:12px; margin-bottom:10px; border:1px solid #cbd5e1; cursor:pointer; transition: 0.2s;">
                    <input type="checkbox" class="lote-checkbox" value="${v.id}" style="width:22px; height:22px; margin-right:15px; cursor:pointer;" checked>
                    <div style="flex:1;">
                        <div style="font-weight:800; color:var(--primary-color); font-size:1rem;">📅 ${dataFormatada}</div>
                        <div style="font-size:0.9rem; color:#475569;">${v.nome_unidade}</div>
                        <div style="font-size:0.85rem; color:#b45309; font-weight:700;">⏰ ${v.hora_entrada} - ${v.hora_saida} | ${v.funcao}</div>
                    </div>
                </label>
            `;
        });

        overlay.innerHTML = `
            <div style="background:white; padding:0; border-radius:24px; box-shadow:0 15px 35px -5px rgba(0,0,0,0.15); width:100%; max-width:450px; overflow:hidden; border:2px solid var(--info-color); max-height: 90vh; display: flex; flex-direction: column;">
                <div style="background:var(--info-color); color:white; padding:20px; text-align:center; flex-shrink: 0;">
                    <span style="font-size:3rem; display:block; margin-bottom:10px;">🛒</span>
                    <h2 style="margin:0; font-weight:800; letter-spacing:-1px; font-size:1.6rem;">PACOTE DE TURNOS</h2>
                    <p style="margin:5px 0 0 0; opacity:0.9;">Desmarque os dias que não pode fazer e aceite o resto!</p>
                </div>
                <div style="padding:20px; overflow-y:auto; flex-grow: 1; background:var(--bg-color);">
                    ${listaHtml}
                </div>
                <div style="padding:20px; background:#ffffff; border-top:1px solid #cbd5e1; flex-shrink: 0;">
                    <button class="btn-main" style="background:var(--success-color); font-size:1.1rem; padding:18px; width:100%; box-shadow:0 8px 20px rgba(16, 185, 129, 0.3);" onclick="aceitarLoteMagico()">✅ Aceitar Dias Selecionados</button>
                    <button class="btn-main" style="background:transparent; color:#64748b; border:none; margin-top:5px; box-shadow:none; width:100%; padding:10px;" onclick="fecharVagaMagica()">Cancelar / Fechar Pacote</button>
                </div>
            </div>`;

    } catch (e) {
        overlay.innerHTML = `<h2 style="color:var(--danger-color); text-align:center;">Falha de ligação. Tente novamente.</h2>`;
    }
}

async function aceitarLoteMagico() {
    const selecionados = Array.from(document.querySelectorAll('.lote-checkbox:checked')).map(cb => cb.value);
    
    if (selecionados.length === 0) {
        alert("Por favor, selecione pelo menos um turno na lista para aceitar.");
        return;
    }

    const btn = document.querySelector('#modalVagaMagica .btn-main');
    if(btn) { btn.innerText = "A Processar no Servidor... ⏳"; btn.disabled = true; }
    
    try {
        const token = localStorage.getItem('agenda360_func_token');
        const res = await fetch('/api/escalas/lote/aceitar', { 
            method: 'POST', 
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selecionados })
        });
        
        const d = await res.json();
        
        if (res.ok) {
            let msgResultado = `<div style="text-align: left; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #cbd5e1; margin-bottom: 20px;">`;
            
            if (d.sucessos_qtd > 0) {
                msgResultado += `<p style="color:var(--success-color); font-weight:800; font-size: 1.1rem; margin-bottom:5px;">✅ Garantiu ${d.sucessos_qtd} turno(s)!</p>`;
            }
            if (d.falhas_qtd > 0) {
                msgResultado += `<p style="color:var(--danger-color); font-weight:800; font-size: 0.95rem; margin-bottom:5px;">❌ Perdeu ${d.falhas_qtd} turno(s) (Conflito de agenda ou já ocupado por outro colega).</p>`;
            }
            msgResultado += `</div>`;

            document.getElementById('modalVagaMagica').innerHTML = `
                <div style="background:white; padding:40px 30px; border-radius:24px; box-shadow:0 10px 25px rgba(0,0,0,0.1); width:100%; max-width:400px; text-align:center;">
                    <span style="font-size:4rem; display:block; margin-bottom:15px;">🎉</span>
                    <h2 style="color:var(--success-color); font-weight:800; letter-spacing:-1px; margin-bottom:15px;">CARRINHO FECHADO!</h2>
                    ${msgResultado}
                    <button class="btn-main" style="background:var(--primary-color); width:100%;" onclick="fecharVagaMagica()">Ver o Meu Calendário Oficial</button>
                </div>`;
        } else {
            alert(d.erro || "Ocorreu um erro ao processar o lote de turnos.");
            if(btn) { btn.innerText = "✅ Aceitar Dias Selecionados"; btn.disabled = false; }
        }
    } catch (e) {
        alert("Erro de servidor. Tente novamente.");
        if(btn) { btn.innerText = "✅ Aceitar Dias Selecionados"; btn.disabled = false; }
    }
}

function fecharVagaMagica() {
    const overlay = document.getElementById('modalVagaMagica');
    if (overlay) overlay.remove();
    window.history.replaceState({}, document.title, window.location.pathname);
    if(typeof aplicarNomesUI === 'function') aplicarNomesUI(); 
    mostrarTela('screenDashboard'); 
    carregarDadosServidor();
}

const tokenAtivoLocal = localStorage.getItem('agenda360_func_token');
const urlVaga = newSearchParams(window.location.search).get('vaga');
const urlLote = new URLSearchParams(window.location.search).get('lote');

if (tokenAtivoLocal) {
    if (urlLote) { 
        processarLoteMagico(urlLote); 
    } else if (urlVaga) { 
        processarVagaMagica(urlVaga); 
    } else { 
        if(typeof aplicarNomesUI === 'function') aplicarNomesUI(); 
        mostrarTela('screenDashboard'); 
        carregarDadosServidor(); 
    }
}