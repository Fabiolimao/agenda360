// ==========================================
// 📍 MÓDULO ISOLADO: RELATÓRIOS, VAGAS MÁGICAS E MOTOR ACT
// ==========================================

function gerarRelatorioApp() {
    const fMes = document.getElementById('repMesFiltro').value; 
    const fAno = document.getElementById('repAnoFiltro').value;
    if(!fMes || !fAno) return;
    
    const fMesStr = String(fMes).padStart(2, '0');
    const fAnoStr = String(fAno);
    const strMesConsulta = `${fAnoStr}-${fMesStr}`;
    const filtroStatus = document.getElementById('repFiltroStatusApp') ? document.getElementById('repFiltroStatusApp').value : '';

    const containerCartoes = document.getElementById('listaRelatorioApp'); 
    const tabelaPrint = document.getElementById('tabelaPrint');
    const blockPrint = document.getElementById('assinaturaPrint');

    if(document.getElementById('boxAssinarRodape')) document.getElementById('boxAssinarRodape').style.display = 'none'; 
    if(document.getElementById('boxCarimboVisual')) document.getElementById('boxCarimboVisual').style.display = 'none';

    const printHeader = document.querySelector('.print-only');
    const nomeTrabalhador = localStorage.getItem('agenda360_func_nome') || "Trabalhador";
    const nomeAgencia = localStorage.getItem('agenda360_func_agencia') || "Agenda360";
    
    const dNow = new Date();
    const emitidoEm = dNow.toLocaleDateString('pt-PT') + ' às ' + dNow.toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'});

    if (printHeader) {
        printHeader.innerHTML = `
            <div style="display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 2px solid var(--primary-color); padding-bottom: 15px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <img src="/logo_agenda_360.jpeg" alt="Agenda360 Logo" style="max-height: 55px; border-radius: 4px;" onerror="this.style.display='none'">
                    <div>
                        <h1 style="font-size: 15pt; margin: 0; color: #0f172a; text-transform: uppercase;">Extrato de Turnos (Consulta)</h1>
                        <p style="margin: 5px 0 0 0; font-size: 10pt; color: #475569;">Trabalhador: <strong style="color:var(--primary-color);">${nomeTrabalhador}</strong> | Entidade: <strong>${nomeAgencia}</strong></p>
                    </div>
                </div>
                <div style="text-align: right; font-size: 9pt; color: #64748b;">
                    <p style="margin:0;">Emitido em:</p>
                    <strong>${emitidoEm}</strong>
                </div>
            </div>
        `;
    }

    let turnosDoMes = escalasTrabalhador.filter(e => e.data_inicio.startsWith(strMesConsulta));
    if (filtroStatus) turnosDoMes = turnosDoMes.filter(e => e.status_turno === filtroStatus);
    turnosDoMes.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));

    let totalAgendadasMinutos = 0; let totalRealizadasMinutos = 0;
    let htmlContainerCartoes = '';
    let htmlNovoCorpoTabelaPrint = '';

    if(turnosDoMes.length === 0) {
        htmlContainerCartoes = `<div class="empty-state">Sem turnos associados neste mês para a seleção atual.</div>`;
        htmlNovoCorpoTabelaPrint = `<tr><td colspan="7" style="text-align:center; padding:15px;">Sem registos encontrados para este filtro.</td></tr>`;
    } else {
        turnosDoMes.forEach(e => {
            const p = e.minutos_pausa !== undefined ? e.minutos_pausa : (e.minutes_pausa !== undefined ? e.minutes_pausa : 0);
            let txtLinhaHoras = '-';
            
            let [hInP, mInP] = e.hora_entrada.split(':').map(Number); let [hOutP, mOutP] = e.hora_saida.split(':').map(Number);
            let minInP = hInP * 60 + mInP; let minOutP = hOutP * 60 + mOutP; if(minOutP < minInP) minOutP += 24 * 60;
            let mPlan = minOutP - minInP; if(e.tem_pausa) mPlan -= p;
            if(mPlan > 0 && e.status_turno !== 'Cancelado' && e.status_turno !== 'Falta') totalAgendadasMinutos += mPlan;
            
            if ((e.status_turno === 'Concluído' || e.status_turno === 'A Aguardar Validação') && e.checkin_real && e.checkout_real) {
                let [hInR, mInR] = e.checkin_real.split(':').map(Number); let [hOutR, mOutR] = e.checkout_real.split(':').map(Number);
                let minInR = hInR * 60 + mInR; let minOutR = hOutR * 60 + mOutR; if(minOutR < minInR) minOutR += 24 * 60;
                let mReal = minOutR - minInR; if(e.tem_pausa) mReal -= p;
                if(mReal > 0) {
                    totalRealizadasMinutos += mReal;
                    txtLinhaHoras = formatarMinutosParaHHMM(mReal);
                }
            }

            let corStatus = 'color:var(--warning-color)';
            let lblStatus = e.status_turno;
            if (lblStatus === 'Concluído' || lblStatus === 'A Aguardar Validação') { corStatus = 'color:var(--success-color)'; lblStatus = dic[curLang]['lbl_done']; }
            if (lblStatus === 'Falta' || lblStatus === 'Cancelado') { corStatus = 'color:var(--danger-color)'; lblStatus = dic[curLang]['lbl_missed']; }

            htmlContainerCartoes += `
                <div class="rep-card">
                    <div class="rep-info">
                        <div class="rep-data">📅 Dia ${e.data_inicio.split('-')[2]} (${e.data_inicio})</div>
                        <div class="rep-loc"><b>Local:</b> ${e.nome_unidade} | <b>Função:</b> ${e.funcao}</div>
                        <div class="rep-loc" style="margin-top: 5px; background: #f8fafc; padding: 5px; border-radius: 4px; border: 1px solid #e2e8f0;">
                            <span style="color:#64748b;">Previsto: ${e.hora_entrada} às ${e.hora_saida}</span><br>
                            <b style="color:var(--primary-color);">Realizado: ${e.checkin_real || '--:--'} às ${e.checkout_real || '--:--'}</b><br>
                            <span style="color:#b45309; font-size: 0.85rem; font-weight:bold;">${e.tem_pausa ? `☕ ${p} min Pausa` : 'Sem Pausa'}</span>
                        </div>
                        <div class="rep-status" style="${corStatus}; margin-top: 5px;">Estado: ${lblStatus}</div>
                    </div>
                    <div class="rep-horas">${txtLinhaHoras}</div>
                </div>
            `;

            let checkinPrint = e.checkin_real ? `<b>${e.checkin_real}</b>` : `<span style="font-size:7pt; color:#64748b;">Previsto:<br>${e.hora_entrada}</span>`;
            let checkoutPrint = e.checkout_real ? `<b>${e.checkout_real}</b>` : `<span style="font-size:7pt; color:#64748b;">Previsto:<br>${e.hora_saida}</span>`;
            let txtPausaPrint = e.tem_pausa ? `<span style="color:#b45309;">${p} min</span>` : '<span style="color:#94a3b8;">Sem Pausa</span>';

            if (e.status_turno === 'Falta' || e.status_turno === 'Cancelado') {
                txtLinhaHoras = `<span style="color:red; font-size:7pt; font-weight:bold;">${e.status_turno.toUpperCase()}</span>`;
                txtPausaPrint = '-'; checkinPrint = '-'; checkoutPrint = '-';
            }

            htmlNovoCorpoTabelaPrint += `
                <tr>
                    <td style="padding:6px !important; border-bottom:1px dashed #cbd5e1;">${e.data_inicio}</td>
                    <td style="padding:6px !important; border-bottom:1px dashed #cbd5e1;"><b>${e.nome_unidade}</b></td>
                    <td style="padding:6px !important; border-bottom:1px dashed #cbd5e1; font-size:8pt;">${e.funcao}</td>
                    <td style="padding:6px !important; text-align:center; border-bottom:1px dashed #cbd5e1;">${checkinPrint}</td>
                    <td style="padding:6px !important; text-align:center; border-bottom:1px dashed #cbd5e1;">${checkoutPrint}</td>
                    <td style="padding:6px !important; text-align:center; color:#b45309; border-bottom:1px dashed #cbd5e1;">${txtPausaPrint}</td>
                    <td style="padding:6px !important; text-align:right; color:var(--primary-color); border-bottom:1px dashed #cbd5e1;"><b>${txtLinhaHoras}</b></td>
                </tr>
            `;
        });
        
        htmlNovoCorpoTabelaPrint += `
            <tr style="background:#f1f5f9;">
                <td colspan="6" style="text-align:right; font-size:10pt; padding:10px !important;"><b>SOMATÓRIO DA SELEÇÃO:</b></td>
                <td style="text-align:right; font-size:11pt; color:var(--primary-color); padding:10px !important;"><b>${formatarMinutosParaHHMM(totalRealizadasMinutos)}</b></td>
            </tr>
        `;
    }
    
    if(containerCartoes) containerCartoes.innerHTML = htmlContainerCartoes;
    
    if (tabelaPrint) {
        tabelaPrint.innerHTML = `
            <thead>
                <tr>
                    <th style="width: 12%; padding: 6px !important; text-align:left; border-bottom:2px solid #cbd5e1;">Data</th>
                    <th style="width: 25%; padding: 6px !important; text-align:left; border-bottom:2px solid #cbd5e1;">Local de Trabalho</th>
                    <th style="width: 20%; padding: 6px !important; text-align:left; border-bottom:2px solid #cbd5e1;">Função</th>
                    <th style="width: 10%; padding: 6px !important; text-align:center; border-bottom:2px solid #cbd5e1;">Entrada</th>
                    <th style="width: 10%; padding: 6px !important; text-align:center; border-bottom:2px solid #cbd5e1;">Saída</th>
                    <th style="width: 10%; padding: 6px !important; text-align:center; border-bottom:2px solid #cbd5e1;">Pausa</th>
                    <th style="width: 13%; padding: 6px !important; text-align:right; border-bottom:2px solid #cbd5e1;">Horas</th>
                </tr>
            </thead>
            <tbody>${htmlNovoCorpoTabelaPrint}</tbody>
        `;
    }
    
    if(document.getElementById('lblHorasA-Trabalhar')) document.getElementById('lblHorasA-Trabalhar').innerText = formatarMinutosParaHHMM(totalAgendadasMinutos);
    if(document.getElementById('lblHorasTrabalhadas')) document.getElementById('lblHorasTrabalhadas').innerText = formatarMinutosParaHHMM(totalRealizadasMinutos);

    if (blockPrint) {
        blockPrint.innerHTML = `
            <div style="margin-top:15px; font-size:9pt; color:#64748b; text-align:center; border-top:1px dashed #cbd5e1; padding-top:10px;">
                <p><i>Este documento é um extrato de consulta pessoal. Para efeitos legais e de auditoria ACT, consulte a <b>Folha de Ponto Mensal Oficial</b> na página inicial.</i></p>
            </div>
        `;
    }
}

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
        const vagasDisponiveis = vagas.filter(v => v.status_turno === 'Pendente');
        
        if (vagasDisponiveis.length === 0) {
            overlay.innerHTML = `
                <div style="background:white; padding:30px; border-radius:24px; box-shadow:0 10px 25px rgba(0,0,0,0.1); width:100%; max-width:400px; border:2px solid var(--danger-color); text-align:center;">
                    <span style="font-size:3rem; display:block;">⚠️</span>
                    <h2 style="color:var(--danger-color); margin-top:15px; font-weight:800; letter-spacing:-1px;">PACOTE FECHADO</h2>
                    <p style="color:#475569; margin-bottom:25px; line-height:1.5;">Todos os turnos deste pacote já foram aceites por otros colegas ou cancelados pela Agência. Fica para a próxima!</p>
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
    if(typeof mostrarTela === 'function') mostrarTela('screenDashboard'); 
    if(typeof carregarDadosServidor === 'function') carregarDadosServidor();
}

window.imprimirFolhaIsolada = function(idBloco) {
    const todosBlocos = document.querySelectorAll('.bloco-folha-act');
    todosBlocos.forEach(b => b.style.setProperty('display', 'none', 'important'));
    document.getElementById(idBloco).style.setProperty('display', 'block', 'important');
    window.print();
    todosBlocos.forEach(b => b.style.setProperty('display', 'block', 'important'));
};

async function testarFolhaACT() {
    try {
        var meuId = localStorage.getItem('agenda360_func_id');
        var token = localStorage.getItem('agenda360_func_token');
        var mes = document.getElementById('actMesFiltro').value;
        var ano = document.getElementById('actAnoFiltro').value;
        var btn = document.querySelector('button[onclick="testarFolhaACT()"]');
        if (btn) btn.innerText = 'A Calcular...';
        
        var res = await fetch('/api/folha-ponto/trabalhador/' + meuId + '/' + ano + '/' + mes, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        var dados = await res.json();
        
        var resAss = await fetch('/api/assinaturas/funcionario/' + meuId, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        var assinaturasWorker = resAss.ok ? await resAss.json() : [];

        var box = document.getElementById('boxTesteACT');
        if (box) {
            box.style.display = 'block';
            box.style.background = 'transparent';
            box.style.padding = '0';
            box.style.color = 'inherit';
            
            if (!dados.agrupamentos || dados.agrupamentos.length === 0) {
                box.innerHTML = '<div style="padding: 20px; text-align:center; color:#64748b;">Nenhum registo encontrado neste per\u00edodo.</div>';
            } else {
                var htmlTudo = '';
                var nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'S\u00e1b'];
                var funcNome = localStorage.getItem('agenda360_func_nome') || 'Trabalhador';
                
                dados.agrupamentos.forEach(function(grupo, index) {
                    var assinaturaAtiva = null;
                    if (Array.isArray(assinaturasWorker)) {
                        for (var a = 0; a < assinaturasWorker.length; a++) {
                            var x = assinaturasWorker[a];
                            if (x.mes == dados.mes && x.ano == dados.ano && x.cliente_id == grupo.cliente_id && x.unidade_id == grupo.unidade_id && x.status === 'Assinado') {
                                assinaturaAtiva = x;
                                break;
                            }
                        }
                    }
                    
                    var nomeAgencia = grupo.empresa || 'N/D';
                    var nomeCliente = grupo.unidade || 'N/D';
                    var nomeFuncionario = funcNome;
                    var mesStr = String(dados.mes);
                    if (mesStr.length < 2) mesStr = '0' + mesStr;
                    var mesAno = mesStr + ' / ' + dados.ano;

                    htmlTudo += '<div id="folha-isolada-' + index + '" class="bloco-folha-act">';
                    
                    htmlTudo += '<div class="no-print" style="margin-bottom: 15px; text-align: right;">' +
                        '<button class="btn-main" style="background: #0ea5e9; color: white; margin-right: 10px;" onclick="imprimirFolhaIsolada(\'folha-isolada-' + index + '\')">\uD83D\uDDA8\uFE0F Imprimir PDF</button>';
                    
                    if (!assinaturaAtiva) {
                        var l_btn_sign = (typeof dic !== 'undefined' && dic[curLang] && dic[curLang]['btn_sign_unit']) ? dic[curLang]['btn_sign_unit'] : '\u270D\uFE0F Assinar Digitalmente esta Unidade';
                        htmlTudo += '<button class="btn-main" style="background: #10b981; color: white;" onclick="assinarUnidade(' + dados.mes + ', ' + dados.ano + ', ' + grupo.cliente_id + ', ' + grupo.unidade_id + ')">' + l_btn_sign + '</button>';
                    }
                    htmlTudo += '</div>';

                    htmlTudo += '<div style="background: white; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 25px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">';
                    
                    htmlTudo += '<style media="print">' +
                        '@page { size: A4 portrait; margin: 0 !important; }' +
                        'body.print-act-active * { visibility: hidden !important; }' +
                        'body.print-act-active #print-master-act, body.print-act-active #print-master-act * { visibility: visible !important; }' +
                        'body.print-act-active #print-master-act { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 1.5cm !important; margin: 0 !important; font-family: sans-serif; }' +
                        '</style>';

                    htmlTudo += '<div id="print-master-act">';

                    var dataEmissao = new Date().toLocaleDateString('pt-PT');
                    htmlTudo += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
                        '<img src="/logo_agenda_360.jpeg" style="max-height: 60px; width: auto;">' +
                        '<span style="font-size: 12px; font-weight: bold;">Emitido em: ' + dataEmissao + '</span>' +
                        '</div>';

                    htmlTudo += '<div style="background:#f1f5f9; padding:10px; border:1px solid #cbd5e1; margin-bottom:10px;">' +
                        '<strong>ENTIDADE EMPREGADORA:</strong> ' + nomeAgencia + '<br>' +
                        '<strong>LOCAL DE TRABALHO:</strong> ' + nomeCliente + '<br>' +
                        '<strong>TRABALHADOR:</strong> ' + nomeFuncionario + ' | <strong>PER\u00cdODO:</strong> ' + mesAno +
                        '</div>';

                    htmlTudo += '<table style="width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed;">' +
                        '<thead>' +
                        '<tr style="background:#e2e8f0;">' +
                        '<th style="border:1px solid #cbd5e1; padding:4px; width:18%;">DIA</th>' +
                        '<th style="border:1px solid #cbd5e1; padding:4px; width:26%;">ENTRADA / SA\u00cdDA</th>' +
                        '<th style="border:1px solid #cbd5e1; padding:4px; width:14%;">PAUSA</th>' +
                        '<th style="border:1px solid #cbd5e1; padding:4px; width:14%;">H. NORMAIS</th>' +
                        '<th style="border:1px solid #cbd5e1; padding:4px; width:14%;">H. NOTURNAS</th>' +
                        '<th style="border:1px solid #cbd5e1; padding:4px; width:14%;">H. EXTRA</th>' +
                        '<th style="border:1px solid #cbd5e1; padding:4px; width:14%;">TOTAL EFETIVAS</th>' +
                        '</tr>' +
                        '</thead>' +
                        '<tbody>';
                    
                    var totNormais = 0, totNoturnas = 0, totExtra = 0, totEfetivas = 0;
                    
                    grupo.dias.forEach(function(d) {
                        var dtObj = new Date(dados.ano, dados.mes - 1, d.dia);
                        var diaSemana = nomesDias[dtObj.getDay()];
                        var bgRow = (dtObj.getDay() === 0 || dtObj.getDay() === 6) ? 'background: #f1f5f9;' : '';
                        if (d.tipo === 'F') bgRow = 'background: #fff1f2; color: #e11d48;'; 
                        
                        totNormais += d.horas_normais || 0;
                        totNoturnas += d.horas_noturnas || 0;
                        totExtra += d.horas_extra || 0;
                        totEfetivas += d.efetivo_horas || 0;
                        
                        var detalheFormatado = d.detalhe;
                        if (d.detalhe === '-') detalheFormatado = (d.tipo === 'F') ? 'Folga' : d.tipo;

                        var txtPausa = '00:00';
                        if (d.tipo !== 'F' && d.detalhe && d.detalhe.indexOf('-') !== -1) {
                            var pts = d.detalhe.split('-');
                            if (pts.length === 2) {
                                var inParts = pts[0].trim().split(':');
                                var outParts = pts[1].trim().split(':');
                                var h1 = Number(inParts[0]), m1 = Number(inParts[1]);
                                var h2 = Number(outParts[0]), m2 = Number(outParts[1]);
                                
                                if (!isNaN(h1) && !isNaN(h2)) {
                                    var minIn = h1 * 60 + (m1 || 0);
                                    var minOut = h2 * 60 + (m2 || 0);
                                    if (minOut < minIn) minOut += 24 * 60;
                                    var gross = minOut - minIn;
                                    var efet = Math.round((d.efetivo_horas || 0) * 60);
                                    var p = gross - efet;
                                    if (p > 0) {
                                        var ph = Math.floor(p / 60);
                                        var pm = p % 60;
                                        var phs = String(ph);
                                        var pms = String(pm);
                                        if (phs.length < 2) phs = '0' + phs;
                                        if (pms.length < 2) pms = '0' + pms;
                                        txtPausa = phs + ':' + pms;
                                    }
                                }
                            }
                        } else if (d.tipo === 'F') { txtPausa = '-'; }

                        var formataHoras = function(h_dec) {
                            if (!h_dec) return '00:00';
                            var h = Math.floor(h_dec);
                            var m = Math.round((h_dec - h) * 60);
                            var hs = String(h);
                            var ms = String(m);
                            if (hs.length < 2) hs = '0' + hs;
                            if (ms.length < 2) ms = '0' + ms;
                            return hs + ':' + ms;
                        };

                        var dDiaStr = String(d.dia);
                        if (dDiaStr.length < 2) dDiaStr = '0' + dDiaStr;

                        htmlTudo += '<tr style="border-bottom: 1px solid #cbd5e1; ' + bgRow + '">' +
                            '<td style="border:1px solid #cbd5e1; padding: 4px; font-weight: bold; text-align: center;">' + dDiaStr + ' (' + diaSemana + ')</td>' +
                            '<td style="border:1px solid #cbd5e1; padding: 4px; text-align: center;">' + detalheFormatado + '</td>' +
                            '<td style="border:1px solid #cbd5e1; padding: 4px; text-align: center;">' + txtPausa + '</td>' +
                            '<td style="border:1px solid #cbd5e1; padding: 4px; text-align: center;">' + formataHoras(d.horas_normais) + '</td>' +
                            '<td style="border:1px solid #cbd5e1; padding: 4px; text-align: center;">' + formataHoras(d.horas_noturnas) + '</td>' +
                            '<td style="border:1px solid #cbd5e1; padding: 4px; text-align: center; color:#b45309; font-weight:bold;">' + formataHoras(d.horas_extra) + '</td>' +
                            '<td style="border:1px solid #cbd5e1; padding: 4px; text-align: center; font-weight: bold; color: #1e293b;">' + formataHoras(d.efetivo_horas) + '</td>' +
                            '</tr>';
                    });

                    var formataHorasTotal = function(h_dec) {
                        var h = Math.floor(h_dec);
                        var m = Math.round((h_dec - h) * 60);
                        var hs = String(h);
                        var ms = String(m);
                        if (hs.length < 2) hs = '0' + hs;
                        if (ms.length < 2) ms = '0' + ms;
                        return hs + ':' + ms;
                    };

                    htmlTudo += '</tbody>' +
                        '<tfoot>' +
                        '<tr style="background: #e0f2fe; font-weight: bold;">' +
                        '<td colspan="3" style="text-align: right; padding: 6px; border: 1px solid #cbd5e1;">TOTAL MENSAL:</td>' +
                        '<td style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">' + formataHorasTotal(totNormais) + 'h</td>' +
                        '<td style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">' + formataHorasTotal(totNoturnas) + 'h</td>' +
                        '<td style="padding: 6px; text-align: center; color: #b45309; border: 1px solid #cbd5e1;">' + formataHorasTotal(totExtra) + 'h</td>' +
                        '<td style="padding: 6px; text-align: center; color: #1e293b; border: 1px solid #cbd5e1;">' + formataHorasTotal(totEfetivas) + 'h</td>' +
                        '</tr>' +
                        '</tfoot>' +
                        '</table>';

                    if (assinaturaAtiva) {
                        htmlTudo += '<div style="background: #f0fdf4; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin-top: 20px; text-align: center;">' +
                            '<h3 style="font-size: 11px; color: #15803d; margin-bottom: 5px;">\u2705 DECLARA\u00c7\u00c3O DE TEMPOS DE TRABALHO ASSINADA DIGITALMENTE</h3>' +
                            '<p style="margin: 0; font-size: 12px; font-weight: bold; color: #0f172a;">' + assinaturaAtiva.carimbo_digital + '</p>' +
                            '<p style="margin: 5px 0 0 0; font-size: 9px; color: #64748b;">(Carimbo Criptogr\u00e1fico Inviol\u00e1vel)</p>' +
                            '</div>';
                    } else {
                        htmlTudo += '<div style="margin-top: 20px; padding: 15px; border-top: 1px dashed #cbd5e1;">' +
                            '<h3 style="font-size: 11px; color: #0ea5e9; margin-bottom: 10px;">DECLARA\u00c7\u00c3O DE VALIDA\u00c7\u00c3O DE TEMPOS DE TRABALHO</h3>' +
                            '<div style="font-size: 9px; color: #475569; text-align: justify; line-height: 1.5; margin-bottom: 20px;">' +
                                '<p>Nos termos da lei, declaro que tomei conhecimento e concordo expressamente com o presente extrato, confirmando a sua exatid\u00e3o.</p>' +
                            '</div>' +
                            '<p style="font-size: 10px; color: #0f172a; margin-bottom: 30px;"><strong>Data:</strong> ____ / ____ / ________</p>' +
                            '<p style="font-size: 10px; color: #0f172a;"><strong>Assinatura:</strong> ___________________________________________________________</p>' +
                            '</div>';
                    }
                    
                    htmlTudo += '</div></div></div>';
                });
                
                box.innerHTML = htmlTudo;
            }
        }
        
        if (btn) btn.innerText = '\uD83D\uDCCA Gerar Folha ACT (Fase 1)';
    } catch (e) {
        console.error("Erro ao testar Folha ACT:", e);
        alert('Falha de rede ao conectar \u00e0 API.');
    }
}

function popularMesesACT() {
    const sel = document.getElementById('actMesFiltro');
    if(!sel) return;
    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    let html = '';
    meses.forEach((m, i) => {
        const val = i + 1;
        html += `<option value="${val}">${m}</option>`;
    });
    sel.innerHTML = html;
    sel.value = new Date().getMonth() + 1;
    if(document.getElementById('actAnoFiltro')) document.getElementById('actAnoFiltro').value = new Date().getFullYear();
}

window.assinarUnidade = async function(mes, ano, cliente_id, unidade_id) {
    const msg = dic[curLang]['alert_sign_unit_desc'] || 'Confirma a assinatura desta unidade?';
    if (!confirm(msg)) return;
    
    try {
        const meuId = localStorage.getItem('agenda360_func_id');
        const token = localStorage.getItem('agenda360_func_token');
        const res = await fetch(`/api/assinaturas/assinar-unidade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ mes, ano, cliente_id, unidade_id })
        });
        
        const data = await res.json();
        if (res.ok) {
            alert(data.mensagem);
            testarFolhaACT();
        } else {
            alert(data.erro);
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao assinar.');
    }
};

// Inicialização segura em ambiente isolado
document.addEventListener('DOMContentLoaded', () => {
    popularMesesACT();
    const tokenAtivo = localStorage.getItem('agenda360_func_token');
    const vagaIdUrl = new URLSearchParams(window.location.search).get('vaga');
    const loteIdsUrl = new URLSearchParams(window.location.search).get('lote');

    if (tokenAtivo) {
        if (loteIdsUrl) { 
            processarLoteMagico(loteIdsUrl); 
        }
        else if (vagaIdUrl) { 
            processarVagaMagica(vagaIdUrl); 
        }
        else {
            if(typeof aplicarNomesUI === 'function') aplicarNomesUI();
            if(typeof mostrarTela === 'function') mostrarTela('screenDashboard');
            if(typeof carregarDadosServidor === 'function') carregarDadosServidor();
        }
    }
});