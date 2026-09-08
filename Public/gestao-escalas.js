// ==========================================
// MÓDULO: SOLICITAÇÕES B2B E EXTRAS
// ==========================================
async function carregarDropdownsSolicitacoes() {
    try {
        const [resU, resF] = await Promise.all([fetch(`/api/unidades/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } }), fetch(`/api/funcoes/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } })]);
        const unids = await resU.json();
        const funcoes = await resF.json();
        const selU = document.getElementById('solUnidade'); selU.innerHTML = '';
        const boxNovoPedido = document.getElementById('boxNovoPedidoCliente');

        if (tipoAcesso === 'gestor') {
            boxNovoPedido.style.display = 'block';
            document.getElementById('tituloListaPedidos').innerText = 'Os Meus Pedidos';
            const u = Array.isArray(unids) ? unids.find(x => x.id == gestorUnidadeId) : null;
            selU.innerHTML = u ? `<option value="${u.id}">${sanitizarTexto(u.nome_empresa)} - ${sanitizarTexto(u.nome_unidade)}</option>` : '';
        } else {
            boxNovoPedido.style.display = 'none'; document.getElementById('tituloListaPedidos').innerText = 'Central de Pedidos (Clientes)';
        }

        const selF = document.getElementById('solFuncao'); selF.innerHTML = '<option value="">-- Função Necessária --</option>';
        if (Array.isArray(funcoes)) funcoes.forEach(f => selF.innerHTML += `<option value="${f.nome}">${sanitizarTexto(f.nome)}</option>`);
    } catch (e) { console.error(e); }
}

function toggleMultiploSol() {
    const multi = document.getElementById('solMultiplo').checked;
    document.getElementById('divConfigMultiploSol').style.display = multi ? 'flex' : 'none';
    document.getElementById('lblDataSolIn').innerText = multi ? 'Data Início (A partir do dia)' : 'Data do Serviço';
    const wrapper = document.getElementById('solMultiplo').closest('.toggle-wrapper');
    if (wrapper) { if (multi) wrapper.classList.add('active'); else wrapper.classList.remove('active'); }
}

function togglePausaSol() {
    const chk = document.getElementById('solPausa').checked;
    document.getElementById('divSolMinutos').style.display = chk ? 'block' : 'none';
    const wrapper = document.getElementById('solPausa').closest('.toggle-wrapper');
    if (wrapper) { if (chk) wrapper.classList.add('active'); else wrapper.classList.remove('active'); }
}

// BLOQUEIO VISUAL E LÓGICO NA CRIAÇÃO DE PEDIDOS
const dataHojeStr = new Date().toISOString().slice(0, 10);
const inputSolDataIn = document.getElementById('solDataIn');
const inputSolDataAte = document.getElementById('solDataAte');
if(inputSolDataIn) inputSolDataIn.min = dataHojeStr;
if(inputSolDataAte) inputSolDataAte.min = dataHojeStr;

document.getElementById('formSolicitacaoExtra')?.addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    const btn = e.target.querySelector('button[type="submit"]'); 
    btn.innerText = "A Enviar..."; 
    btn.disabled = true; 
    
    const baseDados = { 
        agencia_id: agendaId, 
        unidade_id: document.getElementById('solUnidade').value, 
        funcao: document.getElementById('solFuncao').value, 
        quantidade: document.getElementById('solQuantidade').value, 
        hora_entrada: document.getElementById('solHoraIn').value, 
        hora_saida: document.getElementById('solHoraOut').value, 
        tem_pausa: document.getElementById('solPausa').checked ? 1 : 0, 
        minutos_pausa: document.getElementById('solMinutos').value 
    }; 
    
    const isMultiplo = document.getElementById('solMultiplo').checked; 
    const dataHojeValidacao = new Date().toISOString().slice(0, 10);

    try { 
        if (!isMultiplo) { 
            const dataInStr = document.getElementById('solDataIn').value;
            if (dataInStr < dataHojeValidacao) {
                alert("Operação Bloqueada: Não é possível solicitar equipa para uma data que já passou.");
                btn.innerText = "Enviar Pedido à Agência"; 
                btn.disabled = false; 
                return;
            }

            baseDados.data_inicio = dataInStr; 
            const res = await fetch('/api/solicitacoes', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, 
                body: JSON.stringify(baseDados) 
            }); 
            
            if (res.ok) { 
                alert("Pedido de Extras enviado com sucesso para a Agência!"); 
                document.getElementById('formSolicitacaoExtra').reset(); 
                toggleMultiploSol(); 
                togglePausaSol(); 
                window.abaAtivaSolicitacoes = 'pendentes'; 
                mudarAbaSolicitacoes('pendentes'); 
                listarSolicitacoes(); 
            } else { 
                const d = await res.json(); 
                alert(d.erro); 
            } 
        } else { 
            const dataInStr = document.getElementById('solDataIn').value;
            const dataAteStr = document.getElementById('solDataAte').value;

            if (dataInStr < dataHojeValidacao) {
                alert("Operação Bloqueada: A data de início não pode ser no passado.");
                btn.innerText = 'Enviar Pedido à Agência'; 
                btn.disabled = false; 
                return;
            }

            const dataIn = new Date(dataInStr); 
            const dataAte = new Date(dataAteStr); 
            const diasValidos = Array.from(document.querySelectorAll('.dia-semana-sol:checked')).map(cb => parseInt(cb.value)); 
            
            if (dataAte < dataIn) { 
                alert("A data final tem de ser maior que a inicial!"); 
                btn.innerText = 'Enviar Pedido à Agência'; 
                btn.disabled = false; 
                return; 
            } 
            
            let enviados = 0; 
            for (let d = new Date(dataIn); d <= dataAte; d.setDate(d.getDate() + 1)) { 
                if (diasValidos.includes(d.getDay())) { 
                    const dataStr = d.toISOString().slice(0, 10); 
                    const payload = { ...baseDados, data_inicio: dataStr }; 
                    await fetch('/api/solicitacoes', { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, 
                        body: JSON.stringify(payload) 
                    }); 
                    enviados++; 
                } 
            } 
            alert(`✅ Foram enviados ${enviados} pedidos de Extras à Agência com sucesso!`); 
            document.getElementById('formSolicitacaoExtra').reset(); 
            toggleMultiploSol(); 
            togglePausaSol(); 
            window.abaAtivaSolicitacoes = 'pendentes'; 
            mudarAbaSolicitacoes('pendentes'); 
            listarSolicitacoes(); 
        } 
    } catch (err) { 
        alert('Erro de comunicação com o servidor.'); 
    } 
    btn.innerText = "Enviar Pedido à Agência"; 
    btn.disabled = false; 
});

window.mudarAbaSolicitacoes = function (aba) {
    window.abaAtivaSolicitacoes = aba;
    const btnPend = document.getElementById('btnAbaSolPendentes');
    const btnHist = document.getElementById('btnAbaSolHistorico');

    if (aba === 'pendentes') {
        if(btnPend) { btnPend.style.background = 'var(--primary-color)'; btnPend.style.color = 'white'; btnPend.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }
        if(btnHist) { btnHist.style.background = '#e2e8f0'; btnHist.style.color = '#475569'; btnHist.style.boxShadow = 'none'; }
    } else {
        if(btnHist) { btnHist.style.background = 'var(--primary-color)'; btnHist.style.color = 'white'; btnHist.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }
        if(btnPend) { btnPend.style.background = '#e2e8f0'; btnPend.style.color = '#475569'; btnPend.style.boxShadow = 'none'; }
    }
    renderizarTabelaSolicitacoes();
};

async function listarSolicitacoes() { 
    try { 
        const res = await fetch(`/api/solicitacoes/agencia/${agendaId}`, { 
            headers: { 'Authorization': 'Bearer ' + token } 
        }); 
        let sols = await res.json(); 
        if (!Array.isArray(sols)) return; 

        sols.forEach(s => {
            if (s.data_inicio) s.data_inicio = s.data_inicio.split('T')[0];
            if (s.data_pedido) s.data_pedido = s.data_pedido.split('T')[0];
        });

        const dataHojeStr = new Date().toISOString().slice(0, 10);
        let houveAtualizacao = false;

        for (let s of sols) {
            const mAloc = s.alocados ? parseInt(s.alocados) : 0;
            if (s.data_inicio < dataHojeStr && mAloc < s.quantidade && !s.status.includes('Recusado') && !s.status.includes('Cancelado') && !s.status.includes('Expirado')) {
                await fetch(`/api/solicitacoes/${s.id}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ novo_status: 'Não Atendido / Expirado' })
                });
                s.status = 'Não Atendido / Expirado';
                houveAtualizacao = true;
            }
        }

        if (tipoAcesso === 'gestor' && gestorUnidadeId) { 
            sols = sols.filter(s => s.unidade_id == gestorUnidadeId); 
        } 
        
        dadosSolicitacoes = sols; 

        if (houveAtualizacao && typeof verificarAlertasDashboard === 'function') {
            verificarAlertasDashboard();
        }

        if (window.abaAtivaSolicitacoes) {
            mudarAbaSolicitacoes(window.abaAtivaSolicitacoes);
        } else {
            mudarAbaSolicitacoes('pendentes');
        }
    } catch (e) { 
        console.error("Erro ao listar e processar solicitações:", e);
    } 
}

function renderizarTabelaSolicitacoes() {
    const tbody = document.getElementById('tabelaSolicitacoes');
    if (!tbody) return;
    tbody.innerHTML = '';

    let solsFiltradas = [];
    if (window.abaAtivaSolicitacoes === 'historico') {
        solsFiltradas = dadosSolicitacoes.filter(s => {
            const mAloc = s.alocados ? parseInt(s.alocados) : 0;
            const dataHojeStr = new Date().toISOString().slice(0, 10);
            return (mAloc >= s.quantidade) || s.status.includes('Recusado') || s.status.includes('Cancelado') || s.status.includes('Expirado') || (s.data_inicio < dataHojeStr);
        });
    } else {
        solsFiltradas = dadosSolicitacoes.filter(s => {
            const mAloc = s.alocados ? parseInt(s.alocados) : 0;
            const dataHojeStr = new Date().toISOString().slice(0, 10);
            return (mAloc < s.quantidade) && !s.status.includes('Recusado') && !s.status.includes('Cancelado') && !s.status.includes('Expirado') && !(s.data_inicio < dataHojeStr);
        });
    }

    if (solsFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:20px;">Nenhum pedido nesta secção.</td></tr>';
        return;
    }

    solsFiltradas.forEach(s => {
        const mathAloc = s.alocados ? parseInt(s.alocados) : 0;
        const isTotal = (mathAloc >= s.quantidade);
        let statusDisplay = sanitizarTexto(s.status);
        let corStatus = 'color:#64748b';

        const dataHojeStr = new Date().toISOString().slice(0, 10);
        const isExpirado = (s.data_inicio < dataHojeStr) && !isTotal;

        if (s.status.includes('Recusado') || s.status.includes('Cancelado')) {
            corStatus = 'color:var(--danger-color)';
        } else if (isTotal) {
            statusDisplay = 'Atendido'; corStatus = 'color:var(--success-color)';
        } else if (isExpirado || s.status.includes('Expirado')) {
            statusDisplay = 'Não Atendido'; corStatus = 'color:var(--danger-color)';
        } else if (mathAloc > 0) {
            statusDisplay = `Em curso (${mathAloc}/${s.quantidade})`; corStatus = 'color:var(--info-color)';
        } else {
            statusDisplay = 'Pendente'; corStatus = 'color:var(--warning-color)';
        }

        const txtPausa = s.tem_pausa ? `${s.minutos_pausa}m Pausa` : 'Sem Pausa';
        let htmlBotoes = '';
        if (tipoAcesso !== 'gestor') {
            if (!isTotal && !s.status.includes('Recusado') && !s.status.includes('Cancelado') && !isExpirado && !s.status.includes('Expirado')) {
                htmlBotoes += `<button class="btn-small" style="background:var(--success-color); color:white;" onclick="atenderSolicitacaoMagica(${s.id})">🪄 Atender</button> `;
            }
            htmlBotoes += `<button class="btn-small" style="background:var(--info-color); color:white;" onclick="verEquipaSolicitacao(${s.id})">👁️ Ver Equipa</button> `;
            htmlBotoes += `<button class="btn-small btn-delete" onclick="apagarSolicitacao(${s.id})">🗡</button>`;
        } else {
            htmlBotoes += `<button class="btn-small" style="background:var(--info-color); color:white;" onclick="verEquipaSolicitacao(${s.id})">👁️ Ver Equipa</button> `;
            if (statusDisplay === 'Pendente') htmlBotoes += `<button class="btn-small btn-delete" onclick="apagarSolicitacao(${s.id})">🗡 Cancelar</button>`;
        }

        tbody.innerHTML += `<tr><td data-label="Data Solicitada">${new Date(s.data_pedido).toLocaleDateString('pt-PT')}</td><td data-label="Local & Função"><b>${sanitizarTexto(s.nome_unidade)}</b><br><small style="color:var(--primary-color)">${s.quantidade}x ${sanitizarTexto(s.funcao)}</small></td><td data-label="Horário & Pausa">📅 ${s.data_inicio}<br><small>${s.hora_entrada} - ${s.hora_saida} (${txtPausa})</small></td><td data-label="Estado Alocação"><b style="${corStatus}">${statusDisplay}</b></td><td data-label="Ações">${htmlBotoes}</td></tr>`;
    });
}

async function verEquipaSolicitacao(id) { try { const res = await fetch(`/api/solicitacoes/${id}/trabalhadores`, { headers: { 'Authorization': 'Bearer ' + token } }); const trabs = await res.json(); let html = ''; if (!Array.isArray(trabs) || trabs.length === 0) { html = '<p>Ainda não há equipa alocada a este pedido.</p>'; } else { html = '<ul style="list-style:none; padding:0;">'; trabs.forEach(t => { html += `<li style="padding:10px; border-bottom:1px solid #eee;">👤 <b>${sanitizarTexto(t.nome_completo)}</b> <small>(${sanitizarTexto(t.status_turno)})</small></li>`; }); html += '</ul>'; } abrirVerDetalhes("Equipa Alocada ao Pedido", html); } catch (e) { alert("Erro ao procurar equipa."); } }
async function apagarSolicitacao(id) { if (confirm("Tem a certeza que deseja cancelar e apagar este pedido? As escalas já criadas NÃO serão apagadas automaticamente.")) { await fetch(`/api/solicitacoes/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }); listarSolicitacoes(); gerarCalendario(); } }
async function atenderSolicitacaoMagica(id) { const sol = dadosSolicitacoes.find(s => s.id === id); if (!sol) return; magicSolId = sol.id; magicQtd = sol.quantidade; magicAlocados = sol.alocados ? parseInt(sol.alocados) : 0; if (magicAlocados >= magicQtd) { alert("Este pedido já foi totalmente atendido!"); return; } navegar('escalas', document.querySelector('#menuEscalas a')); await carregarDropdownsAgendamento(); cancelarEdicaoEscala(); document.getElementById('escUnidade').value = sol.unidade_id; document.getElementById('escFuncao').value = sol.funcao; document.getElementById('escDataIn').value = sol.data_inicio; document.getElementById('escHoraIn').value = sol.hora_entrada; document.getElementById('escHoraOut').value = sol.hora_saida; if (sol.tem_pausa) { document.getElementById('escPausa').checked = true; document.getElementById('escMinutos').value = sol.minutos_pausa; togglePausaEsc(); } atualizarUIMagica(); destacarFormulario('formEscala'); }
function atualizarUIMagica() { document.getElementById('bannerMagico').style.display = 'flex'; document.getElementById('txtBannerMagico').innerText = `🪄 A Atender Pedido (${magicAlocados}/${magicQtd} Alocados)`; const box = document.getElementById('linhaAgendamentoMultiplo'); box.style.border = '2px solid var(--success-color)'; box.style.background = '#f0fdf4'; }
function cancelarMagica() {
    magicSolId = null; magicQtd = 0; magicAlocados = 0; cancelarEdicaoEscala(); removerDestaqueFormulario();
}
async function verificarAlertasDashboard() { const dashAlerts = document.getElementById('boxAlertasDashboard'); if (!dashAlerts) return; try { const res = await fetch(`/api/solicitacoes/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } }); let sols = await res.json(); dashAlerts.innerHTML = ''; if (!Array.isArray(sols)) return; if (tipoAcesso !== 'gestor') { const pendentes = sols.filter(s => { const mAloc = s.alocados ? parseInt(s.alocados) : 0; return mAloc < s.quantidade && !s.status.includes('Recusado') && !s.status.includes('Cancelado') && !s.status.includes('Expirado'); }); if (pendentes.length > 0) { dashAlerts.innerHTML = `<div style="background:#fffbeb; border:2px solid var(--warning-color); padding:15px; border-radius:8px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;"><div><h3 style="color:#b45309; margin:0 0 5px 0;">🔔 Alerta de Operação B2B</h3><p style="color:#78350f; margin:0;">Existem <b>${pendentes.length}</b> pedidos de clientes a aguardar alocação de equipa.</p></div><button class="btn-action" style="background:var(--warning-color); color:black;" onclick="navegar('solicitacoes', document.querySelector('#menuSolicitacoes a'))">Ver Pedidos</button></div>`; } } else { sols = sols.filter(s => s.unidade_id == gestorUnidadeId); const concluidos = sols.filter(s => { const mAloc = s.alocados ? parseInt(s.alocados) : 0; return mAloc >= s.quantidade; }); if (concluidos.length > 0) { dashAlerts.innerHTML = `<div style="background:#f0fdf4; border:2px solid var(--success-color); padding:15px; border-radius:8px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;"><div><h3 style="color:#065f46; margin:0 0 5px 0;">✅ Pedidos Atendidos</h3><p style="color:#064e3b; margin:0;">Os seus pedidos recentes de equipa foram totalmente preenchidos pela Agência.</p></div><button class="btn-action" style="background:var(--success-color);" onclick="navegar('solicitacoes', document.querySelector('#menuSolicitacoes a'))">Ver Equipa</button></div>`; } } } catch (e) { } }

// ==========================================
// MÓDULO: CALENDÁRIO OPERACIONAL
// ==========================================
async function carregarSelectsCalendario() {
    try {
        const [resF, resU] = await Promise.all([
            fetch(`/api/funcionarios/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } }),
            fetch(`/api/unidades/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } })
        ]);
        const funcs = await resF.json();
        const unids = await resU.json();

        dadosFuncionarios = Array.isArray(funcs) ? funcs : [];
        dadosUnidades = Array.isArray(unids) ? unids : [];

        const selF = document.getElementById('calFunc');
        if(selF) {
            selF.innerHTML = '<option value="">-- Todos --</option>';
            if (Array.isArray(funcs)) funcs.forEach(f => selF.innerHTML += `<option value="${f.id}">${sanitizarTexto(f.nome_completo)}</option>`);
        }

        const selU = document.getElementById('calUnidade');
        if(selU) {
            selU.innerHTML = '<option value="">-- Todas --</option>';
            if (tipoAcesso === 'gestor' && gestorUnidadeId) {
                const u = Array.isArray(unids) ? unids.find(x => x.id == gestorUnidadeId) : null;
                if (u) selU.innerHTML = `<option value="${u.id}">${sanitizarTexto(u.nome_empresa)} - ${sanitizarTexto(u.nome_unidade)}</option>`;
                selU.disabled = true;
            } else {
                if (Array.isArray(unids)) unids.forEach(u => selU.innerHTML += `<option value="${u.id}">${sanitizarTexto(u.nome_empresa)} - ${sanitizarTexto(u.nome_unidade)}</option>`);
                selU.disabled = false;
            }
        }

        const selFiltroFunc = document.getElementById('filtroEscFunc');
        if(selFiltroFunc) {
            selFiltroFunc.innerHTML = '<option value="ALL">👷 Todos os Trabalhadores</option><option value="A_DEFINIR" style="color:var(--warning-color); font-weight:bold;">⏳ A Definir (Vagas)</option>';
            if (Array.isArray(funcs)) {
                funcs.forEach(f => {
                    if (f.status === 'ativo') {
                        selFiltroFunc.innerHTML += `<option value="${f.id}">${sanitizarTexto(f.nome_completo)}</option>`;
                    }
                });
            }
        }
        
        const selFiltroUnid = document.getElementById('filtroEscUnidade');
        const selFiltroCli = document.getElementById('filtroEscCliente');
        
        if(selFiltroUnid) {
            selFiltroUnid.innerHTML = '<option value="ALL">📍 Todos os Locais</option>';
            let unidsValidas = Array.isArray(unids) ? unids : [];
            if(tipoAcesso === 'gestor' && gestorUnidadeId) unidsValidas = unidsValidas.filter(u => u.id == gestorUnidadeId);
            unidsValidas.forEach(u => selFiltroUnid.innerHTML += `<option value="${u.id}">${sanitizarTexto(u.nome_unidade)}</option>`);
        }
        
        if(selFiltroCli) {
            selFiltroCli.innerHTML = '<option value="ALL">🏢 Todas as Empresas</option>';
            if(tipoAcesso !== 'gestor') {
                const clientes = {};
                if(Array.isArray(unids)) {
                    unids.forEach(u => { 
                        if(u.cliente_id && u.nome_empresa && !clientes[u.cliente_id]) clientes[u.cliente_id] = u.nome_empresa; 
                    });
                }
                for (const [id, nome] of Object.entries(clientes)) {
                    selFiltroCli.innerHTML += `<option value="${nome}">${sanitizarTexto(nome)}</option>`;
                }
            } else if (selFiltroCli.parentElement) {
                selFiltroCli.parentElement.style.display = 'none';
            }
        }

        gerarCalendario();
    } catch (e) { console.error("Erro selects calendário:", e); }
}

async function gerarCalendario() {
    const funcId = document.getElementById('calFunc').value;
    let unidadeId = document.getElementById('calUnidade').value;
    if (tipoAcesso === 'gestor') { unidadeId = gestorUnidadeId; }
    const mes = parseInt(document.getElementById('calMes').value);
    const ano = parseInt(document.getElementById('calAno').value);
    const grid = document.getElementById('gridCalendario');
    if(!grid) return;
    grid.innerHTML = '';
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();

    try {
        const [resE, resS] = await Promise.all([
            fetch(`/api/escalas/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } }),
            fetch(`/api/solicitacoes/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } })
        ]);
        let todasEscalas = await resE.json();
        let todasSols = await resS.json();
        
        const agora = new Date();

        if (Array.isArray(todasEscalas)) {
            todasEscalas.forEach(e => {
                if (e.data_inicio) e.data_inicio = e.data_inicio.split('T')[0];
                if (e.data_fim) e.data_fim = e.data_fim.split('T')[0];

                // 📍 MOTOR DE AUTO-LIMPEZA DO GESTOR (Visível Imediatamente no Calendário)
                if (e.status_turno === 'Agendado' || e.status_turno === 'Pendente' || !e.status_turno) {
                    if (e.data_inicio && e.hora_entrada) {
                        const [anoT, mesT, diaT] = e.data_inicio.split('-').map(Number);
                        const [horaT, minT] = e.hora_entrada.split(':').map(Number);
                        const dataTurnoObjeto = new Date(anoT, mesT - 1, diaT, horaT, minT);
                        const diffMinutos = (dataTurnoObjeto - agora) / (1000 * 60);
                        
                        if (diffMinutos < -120) {
                            const isVaga = (!e.funcionario_id || String(e.funcionario_id) === 'A_DEFINIR');
                            e.status_turno = isVaga ? 'Agendamento Não efetivado' : 'Falta';
                            try {
                                fetch(`/api/escalas/${e.id}`, { 
                                    method: 'PUT', 
                                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, 
                                    body: JSON.stringify({ status_turno: e.status_turno }) 
                                }).catch(()=>{});
                            } catch(err){}
                        }
                    }
                }
            });
        }

        if (Array.isArray(todasSols)) {
            todasSols.forEach(s => {
                if (s.data_inicio) s.data_inicio = s.data_inicio.split('T')[0];
                if (s.data_pedido) s.data_pedido = s.data_pedido.split('T')[0];
            });
        }

        if (!Array.isArray(todasEscalas)) return;

        if (tipoAcesso === 'gestor' && gestorUnidadeId) {
            dadosEscalas = todasEscalas.filter(e => e.unidade_id == gestorUnidadeId);
            dadosSolicitacoes = Array.isArray(todasSols) ? todasSols.filter(s => s.unidade_id == gestorUnidadeId) : [];
        } else {
            dadosEscalas = todasEscalas;
            dadosSolicitacoes = Array.isArray(todasSols) ? todasSols : [];
        }

        const scales = dadosEscalas.filter(e => 
            (funcId ? e.funcionario_id == funcId : true) && 
            (unidadeId ? e.unidade_id == unidadeId : true) &&
            e.status_turno !== 'Cancelado' &&
            e.status_turno !== 'Agendamento Não efetivado'
        );

        const dataHojeStr = new Date().toISOString().slice(0, 10);
        const sols = dadosSolicitacoes.filter(s =>
            (unidadeId ? s.unidade_id == unidadeId : true) &&
            s.status !== 'Cancelado' &&
            s.status !== 'Recusado' &&
            !(s.data_inicio < dataHojeStr && (s.alocados ? parseInt(s.alocados) : 0) < s.quantidade)
        );

        for (let i = 0; i < primeiroDia; i++) grid.innerHTML += `<div class="cal-day empty-pad" style="background:#f8fafc; border:none; cursor:default;"></div>`;

        for (let dia = 1; dia <= totalDias; dia++) {
            const dataAtualStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            const turnosDia = scales.filter(e => e.data_inicio === dataAtualStr);
            const solsDia = sols.filter(s => s.data_inicio === dataAtualStr);

            let blocosDia = [];

            solsDia.forEach(s => {
                const pendentes = s.quantidade - (s.alocados ? parseInt(s.alocados) : 0);
                if (pendentes > 0) {
                    blocosDia.push(`<div class="cal-escala" style="background:#fffbeb; border-left:3px solid var(--warning-color); color:#b45309; cursor:pointer;" onclick="abrirResumoDia('${dataAtualStr}'); event.stopPropagation();" title="Pedido B2B">⏳ ${pendentes}x ${sanitizarTexto(s.funcao)}</div>`);
                }
            });

            turnosDia.forEach(t => {
                let isAdefinir = (!t.funcionario_id || String(t.funcionario_id) === 'A_DEFINIR');
                let cor = 'laranja';

                if (isAdefinir) cor = 'laranja';
                else if (t.status_turno === 'Concluído') cor = 'verde';
                else if (t.status_turno === 'Falta') cor = 'vermelha';
                else if (new Date(t.data_inicio) < new Date() && !t.checkin_real) cor = 'vermelha';

                let txtNomeCurto = isAdefinir ? '⏳ A Definir' : (t.nome_func ? sanitizarTexto(t.nome_func.split(' ')[0]) : 'Desconhecido');
                let txt = '';
                if (tipoAcesso === 'gestor') { txt = `👤 ${txtNomeCurto} - ${sanitizarTexto(t.funcao)}`; }
                else { txt = funcId ? sanitizarTexto(t.nome_unidade) : `${txtNomeCurto} - ${sanitizarTexto(t.nome_unidade)}`; }

                blocosDia.push(`<div class="cal-escala ${cor}" style="cursor:pointer;" onclick="abrirResumoDia('${dataAtualStr}'); event.stopPropagation();">${txt} (${t.hora_entrada})</div>`);
            });

            let hideMobileClass = (blocosDia.length === 0) ? 'empty-pad' : '';

            let conteudoHTML = `<div class="dia-num">${dia}</div>`;
            if (blocosDia.length <= 2) {
                conteudoHTML += blocosDia.join('');
            } else {
                conteudoHTML += blocosDia[0];
                conteudoHTML += blocosDia[1];
                conteudoHTML += `<div class="cal-escala" style="background:#e2e8f0; color:#334155; text-align:center; cursor:pointer; font-weight:bold; border:1px solid #cbd5e1;" onclick="abrirResumoDia('${dataAtualStr}'); event.stopPropagation();">+ ${blocosDia.length - 2} Turnos</div>`;
            }

            let clickDay = tipoAcesso === 'gestor' ? '' : `onclick="if(event.target.classList.contains('cal-day') || event.target.classList.contains('dia-num')) { irParaAgendamento('${dataAtualStr}', null); }"`;
            grid.innerHTML += `<div class="cal-day ${hideMobileClass}" ${clickDay}>${conteudoHTML}</div>`;
        }
    } catch (e) { console.error("Erro carregar grelha", e); }
}

window.abrirResumoDia = function (dataStr) {
    const funcId = document.getElementById('calFunc').value;
    let unidadeId = document.getElementById('calUnidade').value;
    if (tipoAcesso === 'gestor') unidadeId = gestorUnidadeId;

    const turnosDia = dadosEscalas.filter(e => 
        e.data_inicio === dataStr && 
        (funcId ? e.funcionario_id == funcId : true) && 
        (unidadeId ? e.unidade_id == unidadeId : true) &&
        e.status_turno !== 'Cancelado' &&
        e.status_turno !== 'Agendamento Não efetivado'
    );

    const solsDia = dadosSolicitacoes.filter(s => s.data_inicio === dataStr && (unidadeId ? s.unidade_id == unidadeId : true) && s.status !== 'Cancelado' && s.status !== 'Recusado');

    let html = `<div style="display:flex; flex-direction:column; gap:10px;">`;

    solsDia.forEach(s => {
        const pendentes = s.quantidade - (s.alocados ? parseInt(s.alocados) : 0);
        if (pendentes > 0) {
            html += `
            <div style="background:#fffbeb; border:1px solid #fcd34d; border-left:4px solid #f59e0b; padding:12px; border-radius:6px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                    <div>
                        <b style="color:#b45309; font-size:1.05rem;">🛎️ Pedido B2B: ${sanitizarTexto(s.nome_unidade)}</b><br>
                        <span style="color:#78350f;">Por alocar: <b>${pendentes}x ${sanitizarTexto(s.funcao)}</b></span><br>
                        <small style="color:#92400e;">Horário: ${s.hora_entrada} às ${s.hora_saida}</small>
                    </div>
                    ${(tipoAcesso !== 'gestor' && dataStr >= new Date().toISOString().slice(0, 10)) ? `<button class="btn-action" style="background:var(--success-color); color:white; font-size:0.8rem; padding:6px 12px;" onclick="document.getElementById('modalVer').style.display='none'; atenderSolicitacaoMagica(${s.id})">🪄 Atender Pedido</button>` : ''}
                </div>
            </div>`;
        }
    });

    if (turnosDia.length === 0 && solsDia.length === 0) {
        html += `<p style="text-align:center; color:#64748b; margin-top:20px;">Sem turnos agendados para este dia.</p>`;
    }

    turnosDia.forEach(t => {
        let isAdefinir = (!t.funcionario_id || String(t.funcionario_id) === 'A_DEFINIR');
        let txtNome = isAdefinir ? '<span style="color:var(--warning-color);">⏳ A Definir (Turno em Aberto)</span>' : (sanitizarTexto(t.nome_func) || 'Desconhecido');
        let statusInfo = sanitizarTexto(t.status_turno);
        let corBorda = '#cbd5e1'; let corFundo = '#f8fafc';

        if (t.status_turno === 'Concluído') corBorda = 'var(--success-color)';
        else if (t.status_turno === 'Falta') { corBorda = 'var(--danger-color)'; corFundo = '#fef2f2'; }
        else if (t.status_turno === 'A Aguardar Validação') corBorda = 'var(--warning-color)';
        else if (t.status_turno === 'Pendente') { corBorda = 'var(--warning-color)'; corFundo = '#fffbeb'; }
        else if (isAdefinir) { corBorda = '#f59e0b'; corFundo = '#fffbeb'; }

        let pReal = (t.minutos_pausa_realizados !== null && t.minutos_pausa_realizados !== undefined)
            ? t.minutos_pausa_realizados + 'm'
            : (t.status_turno === 'Concluído' ? '0m' : '-');
        let txtP = t.tem_pausa ? `(Previsto: ${t.minutos_pausa || 0}m | Real: ${pReal})` : '(Sem pausa)';

        html += `
        <div style="background:${corFundo}; border:1px solid #e2e8f0; border-left:4px solid ${corBorda}; padding:12px; border-radius:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:5px;">
                <b style="font-size:1.05rem; color:var(--primary-color);">${txtNome}</b>
                <span style="font-size:0.8rem; font-weight:bold; padding:4px 8px; border-radius:12px; background:#e2e8f0; color:#334155;">${statusInfo}</span>
            </div>
            <div style="font-size:0.9rem; color:#475569; margin-bottom:12px; line-height:1.5;">
                <b>Local:</b> ${sanitizarTexto(t.nome_unidade)}<br>
                <b>Função:</b> ${sanitizarTexto(t.funcao)}<br>
                <b>Horário:</b> ${t.hora_entrada} às ${t.hora_saida} ${txtP}<br>
                ${t.checkin_real ? `<b>Registo de Ponto:</b> ${sanitizarTexto(t.checkin_real)} - ${sanitizarTexto(t.checkout_real) || '--:--'}` : ''}
            </div>
            <div style="text-align:right; border-top:1px dashed #cbd5e1; padding-top:10px;">
        `;

        if (tipoAcesso === 'gestor') {
            if (t.status_turno === 'A Aguardar Validação') {
                html += `<button class="btn-action" style="background:var(--warning-color); color:black; font-size:0.85rem;" onclick="document.getElementById('modalVer').style.display='none'; abrirValidacaoPonto(${t.id})">🛡️ Validar Turno</button>`;
            }
        } else {
            html += `<button class="btn-action" style="background:var(--warning-color); color:black; font-size:0.85rem;" onclick="document.getElementById('modalVer').style.display='none'; irParaAgendamento('${dataStr}', ${t.id})">✏️ Editar Turno</button>`;

            if ((t.status_turno === 'Pendente' || isAdefinir) && window.whatsappAtivo) {
                html += ` <button class="btn-action" style="background:#25D366; color:white; border:none; font-size:0.85rem;" onclick="enviarOfertaWhatsApp(${t.id})">📲 Ofertar via WhatsApp</button>`;
            }
        }

        html += `</div></div>`;
    });

    html += `</div>`;
    let d = new Date(dataStr);
    let dataF = d.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    abrirVerDetalhes(`📅 Resumo do Dia: ${dataF}`, html);
};

// ==========================================
// MÓDULO: GESTÃO DE ESCALAS E TURNOS
// ==========================================
async function carregarDropdownsAgendamento() { 
    const [resF, resU, resFunc] = await Promise.all([fetch(`/api/funcionarios/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } }), fetch(`/api/unidades/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } }), fetch(`/api/funcoes/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } })]); 
    const funcs = await resF.json(); 
    const unids = await resU.json(); 
    const funcoes = await resFunc.json(); 
    const funcsAtivos = Array.isArray(funcs) ? funcs.filter(f => f.status === 'ativo') : []; 
    const selF = document.getElementById('escFunc'); 
    selF.innerHTML = '<option value="">-- Escolher --</option><option value="A_DEFINIR" style="font-weight: bold; color: #d97706;">⏳ A Definir (Turno em Aberto)</option>'; 
    funcsAtivos.forEach(f => selF.innerHTML += `<option value="${f.id}">${sanitizarTexto(f.nome_completo)}</option>`); 
    const selU = document.getElementById('escUnidade'); 
    selU.innerHTML = '<option value="">-- Escolher --</option>'; 
    if (Array.isArray(unids)) unids.forEach(u => selU.innerHTML += `<option value="${u.id}">${sanitizarTexto(u.nome_empresa)} - ${sanitizarTexto(u.nome_unidade)}</option>`); 
    const selFunc = document.getElementById('escFuncao'); 
    selFunc.innerHTML = '<option value="">-- Escolher --</option>'; 
    if (Array.isArray(funcoes)) funcoes.forEach(f => selFunc.innerHTML += `<option value="${f.nome}">${sanitizarTexto(f.nome)}</option>`); 
}

function irParaAgendamento(dataStr, idEscala) { 
    navegar('escalas', document.querySelectorAll('.nav-links a')[4]); 
    setTimeout(() => { 
        if (idEscala) editarEscala(idEscala); 
        else { cancelarEdicaoEscala(); document.getElementById('escDataIn').value = dataStr; } 
    }, 300); 
}

window.mudarAbaEscalas = function (aba) {
    window.abaAtivaEscalas = aba;
    const btnPend = document.getElementById('btnAbaEscPendentes');
    const btnVal = document.getElementById('btnAbaEscValidacao');
    const btnHist = document.getElementById('btnAbaEscHistorico');

    [btnPend, btnVal, btnHist].forEach(b => {
        if(b) { b.style.background = '#e2e8f0'; b.style.color = '#475569'; b.style.boxShadow = 'none'; }
    });

    if (aba === 'pendentes' && btnPend) {
        btnPend.style.background = 'var(--primary-color)'; btnPend.style.color = 'white'; btnPend.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    } else if (aba === 'validacao' && btnVal) {
        btnVal.style.background = 'var(--primary-color)'; btnVal.style.color = 'white'; btnVal.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    } else if (aba === 'historico' && btnHist) {
        btnHist.style.background = 'var(--primary-color)'; btnHist.style.color = 'white'; btnHist.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    }

    renderizarTabelaEscalas();
};

async function listarEscalas() {
    try {
        const res = await fetch(`/api/escalas/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } });
        let todasAsEscalas = await res.json();
        
        const agora = new Date();
        
        if (Array.isArray(todasAsEscalas)) {
            todasAsEscalas.forEach(e => {
                if (e.data_inicio) e.data_inicio = e.data_inicio.split('T')[0];
                if (e.data_fim) e.data_fim = e.data_fim.split('T')[0];
                
                if (e.status_turno === 'Agendado' || e.status_turno === 'Pendente' || !e.status_turno) {
                    if (e.data_inicio && e.hora_entrada) {
                        const [anoT, mesT, diaT] = e.data_inicio.split('-').map(Number);
                        const [horaT, minT] = e.hora_entrada.split(':').map(Number);
                        const dataTurnoObjeto = new Date(anoT, mesT - 1, diaT, horaT, minT);
                        const diffMinutos = (dataTurnoObjeto - agora) / (1000 * 60);
                        
                        if (diffMinutos < -120) {
                            const isVaga = (!e.funcionario_id || String(e.funcionario_id) === 'A_DEFINIR');
                            e.status_turno = isVaga ? 'Agendamento Não efetivado' : 'Falta';
                            try {
                                fetch(`/api/escalas/${e.id}`, { 
                                    method: 'PUT', 
                                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, 
                                    body: JSON.stringify({ status_turno: e.status_turno }) 
                                }).catch(()=>{});
                            } catch(err){}
                        }
                    }
                }
            });
        }

        if (tipoAcesso === 'gestor' && gestorUnidadeId) {
            dadosEscalas = Array.isArray(todasAsEscalas) ? todasAsEscalas.filter(e => e.unidade_id == gestorUnidadeId) : [];
        } else {
            dadosEscalas = todasAsEscalas;
        }
        
        if (window.abaAtivaEscalas) {
            mudarAbaEscalas(window.abaAtivaEscalas);
        } else {
            mudarAbaEscalas('pendentes');
        }
    } catch (e) { console.error("Erro ao listar escalas", e); }
}

window.aplicarFiltrosEscalas = function() {
    renderizarTabelaEscalas();
};

function renderizarTabelaEscalas() {
    const tbody = document.getElementById('tabelaEscalas');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(dadosEscalas)) return;

    const fCliente = document.getElementById('filtroEscCliente') ? document.getElementById('filtroEscCliente').value : 'ALL';
    const fUnidade = document.getElementById('filtroEscUnidade') ? document.getElementById('filtroEscUnidade').value : 'ALL';
    const fFunc = document.getElementById('filtroEscFunc') ? document.getElementById('filtroEscFunc').value : 'ALL';

    let escalasFiltradas = [];

    if (window.abaAtivaEscalas === 'pendentes') {
        escalasFiltradas = dadosEscalas.filter(e => e.status_turno === 'Agendado' || e.status_turno === 'Pendente' || !e.status_turno);
    } else if (window.abaAtivaEscalas === 'validacao') {
        escalasFiltradas = dadosEscalas.filter(e => e.status_turno === 'A Aguardar Validação');
    } else if (window.abaAtivaEscalas === 'historico') {
        escalasFiltradas = dadosEscalas.filter(e => e.status_turno === 'Concluído' || e.status_turno === 'Falta' || e.status_turno === 'Cancelado' || e.status_turno === 'Agendamento Não efetivado');
        escalasFiltradas.sort((a, b) => new Date(b.data_inicio) - new Date(a.data_inicio));
    }

    escalasFiltradas = escalasFiltradas.filter(e => {
        let matchFunc = true;
        if (fFunc !== 'ALL') {
            if (fFunc === 'A_DEFINIR') {
                matchFunc = (!e.funcionario_id || String(e.funcionario_id) === 'A_DEFINIR');
            } else {
                matchFunc = (String(e.funcionario_id) === String(fFunc));
            }
        }
        let matchUnid = true;
        if (fUnidade !== 'ALL') {
            matchUnid = (String(e.unidade_id) === String(fUnidade));
        }
        let matchCli = true;
        if (fCliente !== 'ALL') {
            matchCli = (e.nome_empresa === fCliente); 
        }
        return matchFunc && matchUnid && matchCli;
    });

    if (escalasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:20px;">Nenhum turno atende aos filtros atuais.</td></tr>';
        return;
    }

    escalasFiltradas.forEach(e => {
        let statusOriginal = sanitizarTexto(e.status_turno || 'Agendado');
        let txt = statusOriginal;
        if (e.checkin_real && !e.checkout_real && txt !== 'Falta' && txt !== 'Cancelado' && txt !== 'Agendamento Não efetivado') txt += ' (Em curso)';
        if (txt === 'Falta' || txt === 'Cancelado' || txt === 'Agendamento Não efetivado') txt = `<span style="color:var(--danger-color);font-weight:bold;">${txt}</span>`;
        else if (txt === 'Concluído') txt = `<span style="color:var(--success-color);font-weight:bold;">${txt}</span>`;
        else if (txt === 'A Aguardar Validação') txt = `<span style="color:var(--warning-color);font-weight:bold;">⏳ ${txt}</span>`;
        else if (txt === 'Pendente') txt = `<span style="color:var(--warning-color);font-weight:bold; background:#fffbeb; padding:2px 8px; border-radius:12px; border:1px dashed #fcd34d;">${txt}</span>`;

        let isVagaCancelada = (!e.funcionario_id || String(e.funcionario_id) === 'A_DEFINIR') && (e.status_turno === 'Agendamento Não efetivado' || e.status_turno === 'Cancelado');
        let isAdefinir = (!e.funcionario_id || String(e.funcionario_id) === 'A_DEFINIR') && !isVagaCancelada;
        let txtNome = isVagaCancelada ? '<span style="color:var(--danger-color);">❌ Vaga Não Preenchida</span>' : (isAdefinir ? '<span style="color:var(--warning-color);">⏳ A Definir / Vaga Aberta</span>' : (sanitizarTexto(e.nome_func) || 'Desconhecido'));

        const p = e.minutos_pausa !== undefined ? e.minutos_pausa : (e.minutes_pausa !== undefined ? e.minutes_pausa : 0);
        let txtPausaPrincipal = 'Sem Pausa';
        if (e.tem_pausa) {
            let pReal = (e.minutos_pausa_realizados !== null && e.minutos_pausa_realizados !== undefined) ? e.minutos_pausa_realizados : '-';
            let flag = e.pausa_status_flag || 'Pendente';

            let corBadge = '#fef3c7';
            let corTexto = '#b45309';
            let icon = '☕';

            if (flag === 'Excedido') {
                corBadge = '#fee2e2'; corTexto = '#991b1b'; icon = '⚠️';
            } else if (flag === 'Cumprido' || flag === 'Abaixo') {
                corBadge = '#dcfce7'; corTexto = '#166534'; icon = '✅';
            }

            txtPausaPrincipal = `<div style="font-size:0.75rem; color:#64748b; margin-bottom: 2px;">Previsto: <b>${p}</b> min</div>
                        <span style="color:${corTexto}; font-weight:bold; background:${corBadge}; padding:2px 6px; border-radius:4px; display:inline-block;" title="Status: ${flag}">
                        ${icon} Real: <b>${pReal}</b> min
                        </span>`;
        }

        let botoesAcao = `<button class="btn-small btn-view" onclick="verEscala(${e.id})">👁</button>`;
        if (tipoAcesso === 'gestor' && e.status_turno === 'A Aguardar Validação') {
            botoesAcao += `<button class="btn-small" style="background:var(--warning-color); color:black;" onclick="abrirValidacaoPonto(${e.id})">🛡️ Validar</button>`;
        } else if (tipoAcesso !== 'gestor') {
            botoesAcao += `<button class="btn-small btn-edit" onclick="editarEscala(${e.id})">✎ Acerto</button>`;

            if ((e.status_turno === 'Pendente' || isAdefinir) && window.whatsappAtivo) {
                botoesAcao += `<button class="btn-small" style="background:#25D366; color:white; border:none; padding: 6px 12px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 6px rgba(37, 211, 102, 0.2);" onclick="enviarOfertaWhatsApp(${e.id})">📲 WhatsApp</button>`;
            }

            if (e.checkin_real) { botoesAcao += `<button class="btn-small" style="background:#cbd5e1; color:#64748b; cursor:not-allowed;" title="Bloqueado: Turno com ponto registado não pode ser apagado">🔒</button>`; } else { botoesAcao += `<button class="btn-small btn-delete" onclick="apagarEscala(${e.id})">🗑</button>`; }
        }
        tbody.innerHTML += `<tr><td data-label="Data">${e.data_inicio}</td><td data-label="Funcionário / Local"><b>${txtNome}</b><br><small>${sanitizarTexto(e.nome_unidade)}</small></td><td data-label="Horário">${e.hora_entrada}-${e.hora_saida}<br><div style="margin-top: 4px;">${txtPausaPrincipal}</div></td><td data-label="Estado">${txt}</td><td data-label="Ações"><div style="display:flex; gap:5px; flex-wrap:wrap;">${botoesAcao}</div></td></tr>`;
    });
}

function enviarOfertaWhatsApp(id) {
    const e = dadosEscalas.find(x => x.id === id);
    if (!e) return alert("Turno não encontrado.");

    const lotePossivel = dadosEscalas.filter(x =>
        x.unidade_id === e.unidade_id &&
        x.funcao === e.funcao &&
        (x.status_turno === 'Pendente' || String(x.funcionario_id) === 'A_DEFINIR')
    ).sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));

    if (lotePossivel.length > 1) {
        const diasTxt = lotePossivel.map(x => x.data_inicio.split('-').reverse().join('/')).join(', ');

        const querLote = confirm(`🛒 DETETÁMOS MÚLTIPLAS VAGAS!\n\nExistem ${lotePossivel.length} turnos pendentes para ${e.funcao} no local ${e.nome_unidade}:\n${diasTxt}\n\n• Clique [OK] para criar um Link de LOTE (Enviar todos juntos)\n• Clique [CANCELAR] para enviar APENAS a vaga deste dia isolado`);

        if (querLote) {
            const idsJuntos = lotePossivel.map(x => x.id).join(',');
            const linkLote = `${window.location.origin}/app-extra.html?lote=${idsJuntos}`;
            const textoLote = `NOVO PACOTE DE TURNOS 🛒\n\nTemos ${lotePossivel.length} turnos abertos para o local:\n📍 ${e.nome_unidade}\n⚙️ ${e.funcao}\n\nAbra o link abaixo, escolha os dias que tem disponibilidade, e aceite o paquete!\n${linkLote}`;

            navigator.clipboard.writeText(textoLote).then(() => {
                window.open(`https://wa.me/?text=${encodeURIComponent(textoLote)}`, '_blank');
            }).catch(() => { window.open(`https://wa.me/?text=${encodeURIComponent(textoLote)}`, '_blank'); });
            return; 
        }
    }

    const dataParts = e.data_inicio.split('-');
    const dataFormatada = `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}`;
    const linkMagico = `${window.location.origin}/app-extra.html?vaga=${e.id}`;

    const textoCard = `NOVA VAGA DE TURNO\n\nOlá! Temos um turno abierto e disponível:\n\n📍 Local: ${e.nome_unidade}\n⚙️ Función: ${e.funcao}\n📅 Data: ${dataFormatada}\n⏰ Horário: ${e.hora_entrada} às ${e.hora_saida}\n\nClique no link para aceitar.\n${linkMagico}`;

    const textoCodificado = encodeURIComponent(textoCard);

    navigator.clipboard.writeText(textoCard).then(() => {
        window.open(`https://wa.me/?text=${textoCodificado}`, '_blank');
    }).catch(err => {
        window.open(`https://wa.me/?text=${textoCodificado}`, '_blank');
    });
}

let idValidacaoAtiva = null;
function abrirValidacaoPonto(id) {
    const e = dadosEscalas.find(x => x.id === id);
    if (!e) return;
    idValidacaoAtiva = id;
    document.getElementById('txtObsValidacao').value = '';
    const p = e.minutos_pausa !== undefined ? e.minutos_pausa : (e.minutes_pausa !== undefined ? e.minutes_pausa : 0);

    let isAdefinir = (!e.funcionario_id || String(e.funcionario_id) === 'A_DEFINIR');
    let txtNome = isAdefinir ? '⏳ A Definir' : (sanitizarTexto(e.nome_func) || 'Desconhecido');

    const pReal = (e.minutos_pausa_realizados !== null && e.minutos_pausa_realizados !== undefined)
        ? e.minutos_pausa_realizados + 'm'
        : (e.status_turno === 'Concluído' ? '0m' : '-');
    let txtP = e.tem_pausa ? `Prev: ${p}m | Real: ${pReal}` : '0 min';

    document.getElementById('conteudoValidacaoPonto').innerHTML = `<div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Trabalhador:</span> <b>${txtNome}</b></div><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Função:</span> <b>${sanitizarTexto(e.funcao)}</b></div><div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #cbd5e1; padding-bottom:5px;"><span>Data do Serviço:</span> <b>${e.data_inicio}</b></div><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Entrada Registada:</span> <b style="color:var(--primary-color)">${sanitizarTexto(e.checkin_real) || '-'}</b></div><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Saída Registada:</span> <b style="color:var(--danger-color)">${sanitizarTexto(e.checkout_real) || '-'}</b></div><div style="display:flex; justify-content:space-between;"><span>Pausa Descontada:</span> <b style="color:var(--warning-color)">${txtP}</b></div></div>`;
    document.getElementById('modalValidarPonto').style.display = 'flex';
}

async function confirmarValidacaoPonto() { 
    if (!idValidacaoAtiva) return; 
    const obs = document.getElementById('txtObsValidacao').value; 
    const btn = document.querySelector('#modalValidarPonto .btn-save'); 
    btn.innerText = "A validar..."; btn.disabled = true; 
    try { 
        const res = await fetch('/api/escalas/' + idValidacaoAtiva + '/validar-cliente', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ obs_cliente: obs }) }); 
        if (res.ok) { 
            alert("✅ Turno validado e devolvido à Agência para fecho de contas!"); 
            document.getElementById('modalValidarPonto').style.display = 'none'; 
            listarEscalas(); gerarCalendario(); 
        } else { 
            const d = await res.json(); alert(d.erro); 
        } 
    } catch (e) { alert("Erro de comunicação com o servidor."); } 
    btn.innerText = "Confirmar e Validar Turno"; btn.disabled = false; 
}

function verEscala(id) {
    const e = dadosEscalas.find(x => x.id === id);
    if (!e) return;
    const p = e.minutos_pausa !== undefined ? e.minutos_pausa : (e.minutes_pausa !== undefined ? e.minutes_pausa : 0);
    let htmlObs = e.obs_cliente ? `<div style="margin-top:15px; padding:10px; background:#fef3c7; border:1px solid #f59e0b; border-radius:6px; color:#78350f;"><b>Nota do Hotel:</b> ${sanitizarTexto(e.obs_cliente)}</div>` : '';

    let isVagaCancelada = (!e.funcionario_id || String(e.funcionario_id) === 'A_DEFINIR') && (e.status_turno === 'Agendamento Não efetivado' || e.status_turno === 'Cancelado');
    let isAdefinir = (!e.funcionario_id || String(e.funcionario_id) === 'A_DEFINIR') && !isVagaCancelada;
    let txtNome = isVagaCancelada ? '❌ Vaga Não Preenchida' : (isAdefinir ? '⏳ A Definir (Turno em Aberto)' : (sanitizarTexto(e.nome_func) || 'Desconhecido'));

    const pReal = (e.minutos_pausa_realizados !== null && e.minutos_pausa_realizados !== undefined)
        ? e.minutos_pausa_realizados + 'm'
        : (e.status_turno === 'Concluído' ? '0m' : '-');
    let txtP = e.tem_pausa ? `Previsto: ${p}m | Real: ${pReal}` : 'Não';

    abrirVerDetalhes("Detalhes", `<b>Trabalhador:</b> ${txtNome}<br><b>Local:</b> ${sanitizarTexto(e.nome_unidade)}<br><b>Pausa:</b> ${txtP}<br><b>Check-in:</b> ${sanitizarTexto(e.checkin_real) || '-'}<br><b>Check-out:</b> ${sanitizarTexto(e.checkout_real) || '-'}${htmlObs}`);
}

function togglePausaEsc() {
    const chk = document.getElementById('escPausa').checked;
    document.getElementById('divMinutosPausa').style.display = chk ? 'block' : 'none';
    const realDiv = document.getElementById('divMinutosPausaReal');
    if (realDiv) realDiv.style.display = chk ? 'flex' : 'none';
    const wrapper = document.getElementById('escPausa').closest('.toggle-wrapper');
    if (wrapper) { if (chk) wrapper.classList.add('active'); else wrapper.classList.remove('active'); }
}

function toggleMultiplo() {
    const multi = document.getElementById('escMultiplo').checked;
    document.getElementById('divConfigMultiplo').style.display = multi ? 'flex' : 'none';
    document.getElementById('lblDataInicio').innerText = multi ? 'Data Início (A partir do dia)' : 'Data do Turno';
    const wrapper = document.getElementById('escMultiplo').closest('.toggle-wrapper');
    if (wrapper) { if (multi) wrapper.classList.add('active'); else wrapper.classList.remove('active'); }
}

function editarEscala(id) {
    const e = dadosEscalas.find(x => x.id === id); if (!e) return;
    const p = e.minutos_pausa !== undefined ? e.minutos_pausa : (e.minutes_pausa !== undefined ? e.minutes_pausa : 0);
    document.getElementById('escIdEdit').value = e.id;
    document.getElementById('escUnidade').value = e.unidade_id;
    document.getElementById('escFunc').value = e.funcionario_id || 'A_DEFINIR';
    document.getElementById('escFuncao').value = e.funcao;
    document.getElementById('escDataIn').value = e.data_inicio;
    document.getElementById('escHoraIn').value = e.hora_entrada;
    document.getElementById('escHoraOut').value = e.hora_saida;

    if (e.tem_pausa) {
        document.getElementById('escPausa').checked = true;
        document.getElementById('escMinutos').value = p;
        const inInput = document.getElementById('escHoraInicioPausa');
        const fimInput = document.getElementById('escHoraFimPausa');
        
        const extrairLiteral = (valor) => {
            if (!valor) return '';
            const vStr = String(valor);
            if (vStr.includes('T')) return vStr.split('T')[1].substring(0, 5);
            if (vStr.includes(' ')) return vStr.split(' ')[1].substring(0, 5);
            return vStr.substring(0, 5);
        };

        if (inInput) inInput.value = extrairLiteral(e.timestamp_inicio_pausa) || extrairLiteral(e.hora_inicio_pausa) || '';
        if (fimInput) fimInput.value = extrairLiteral(e.timestamp_fim_pausa) || extrairLiteral(e.hora_fim_pausa) || '';
    } else {
        document.getElementById('escPausa').checked = false;
        document.getElementById('escMinutos').value = 0;
        const inInput = document.getElementById('escHoraInicioPausa');
        const fimInput = document.getElementById('escHoraFimPausa');
        if (inInput) inInput.value = '';
        if (fimInput) fimInput.value = '';
    }
    togglePausaEsc();

    document.getElementById('linhaAgendamentoMultiplo').style.display = 'none';
    document.getElementById('linhaAcertoManual').style.display = 'block';
    const boxObs = document.getElementById('boxObsCliente');
    if (e.obs_cliente) { document.getElementById('lblObsCliente').innerText = `"${e.obs_cliente}"`; boxObs.style.display = 'block'; } else { boxObs.style.display = 'none'; }
    document.getElementById('escStatus').value = e.status_turno || 'Agendado';
    document.getElementById('escCheckinReal').value = e.checkin_real || '';
    document.getElementById('escCheckoutReal').value = e.checkout_real || '';
    document.getElementById('btnSalvarEscala').innerText = 'Gravar Acerto do Turno';
    document.getElementById('btnCancelarEscala').style.display = 'inline-block';
    destacarFormulario('formEscala');
}

function cancelarEdicaoEscala() {
    removerDestaqueFormulario();
    document.getElementById('formEscala').reset();
    document.getElementById('escIdEdit').value = '';
    document.getElementById('linhaAcertoManual').style.display = 'none';

    document.getElementById('escMultiplo').checked = false;
    toggleMultiplo();
    document.getElementById('escPausa').checked = false;
    const inInput = document.getElementById('escHoraInicioPausa');
    const fimInput = document.getElementById('escHoraFimPausa');
    if (inInput) inInput.value = '';
    if (fimInput) fimInput.value = '';
    togglePausaEsc();

    document.getElementById('escStatus').value = 'Agendado';
    document.getElementById('boxObsCliente').style.display = 'none';
    document.getElementById('btnSalvarEscala').innerText = 'Confirmar Agendamento';
    document.getElementById('btnCancelarEscala').style.display = 'none';
    if (magicSolId) {
        atualizarUIMagica();
        removerDestaqueFormulario();
    } else {
        document.getElementById('linhaAgendamentoMultiplo').style.display = 'block';
        document.getElementById('bannerMagico').style.display = 'none';
        document.getElementById('linhaAgendamentoMultiplo').style.border = '1px solid #e2e8f0';
        document.getElementById('linhaAgendamentoMultiplo').style.background = '#f8fafc';
    }
}

document.getElementById('formEscala').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const idEdit = document.getElementById('escIdEdit').value;
    const btn = document.getElementById('btnSalvarEscala');
    btn.innerText = "A processar...";
    btn.disabled = true;

    const funcEscolhido = document.getElementById('escFunc').value;
    
    const inInput = document.getElementById('escHoraInicioPausa');
    const fimInput = document.getElementById('escHoraFimPausa');
    const vInicio = (inInput && inInput.value) ? inInput.value : null;
    const vFim = (fimInput && fimInput.value) ? fimInput.value : null;

    const baseDados = {
        unidade_id: document.getElementById('escUnidade').value,
        funcionario_id: funcEscolhido,
        funcao: document.getElementById('escFuncao').value,
        hora_entrada: document.getElementById('escHoraIn').value,
        hora_saida: document.getElementById('escHoraOut').value,
        tem_pausa: document.getElementById('escPausa').checked ? 1 : 0,
        minutos_pausa: parseInt(document.getElementById('escMinutos').value) || 0,
        hora_inicio_pausa: vInicio,
        hora_fim_pausa: vFim,
        solicitacao_id: magicSolId
    };

    try {
        if (idEdit) {
            const dataTurno = document.getElementById('escDataIn').value;
            baseDados.data_inicio = dataTurno;
            baseDados.data_fim = dataTurno;
            baseDados.checkin_real = document.getElementById('escCheckinReal').value || null;
            baseDados.checkout_real = document.getElementById('escCheckoutReal').value || null;
            baseDados.status_turno = document.getElementById('escStatus') ? document.getElementById('escStatus').value : 'Agendado';
            
            baseDados.timestamp_inicio_pausa = vInicio ? `${dataTurno}T${vInicio}:00` : null;
            baseDados.timestamp_fim_pausa = vFim ? `${dataTurno}T${vFim}:00` : null;

            const res = await fetch(`/api/escalas/${idEdit}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(baseDados) });
            if (!res.ok) { const d = await res.json(); alert(d.erro); }
            else { alert('Turno corrigido!'); cancelarEdicaoEscala(); listarEscalas(); }
        } else {
            const isMultiplo = (document.getElementById('escMultiplo') && document.getElementById('escMultiplo').checked);

            if (!isMultiplo) {
                const dataTurno = document.getElementById('escDataIn').value;
                baseDados.data_inicio = dataTurno;
                baseDados.data_fim = dataTurno;
                baseDados.timestamp_inicio_pausa = vInicio ? `${dataTurno}T${vInicio}:00` : null;
                baseDados.timestamp_fim_pausa = vFim ? `${dataTurno}T${vFim}:00` : null;

                const res = await fetch('/api/escalas', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(baseDados) });

                if (!res.ok) {
                    const d = await res.json(); alert(d.erro);
                } else {
                    if (magicSolId) {
                        magicAlocados++;
                        if (magicAlocados >= magicQtd) {
                            alert("✅ Pedido do Cliente totalmente preenchido com sucesso!");
                            await fetch(`/api/solicitacoes/${magicSolId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ novo_status: 'Atendido' }) });
                            cancelarMagica(); listarEscalas();
                        } else {
                            alert(`✅ Trabalhador escalado!\n\nFalta(m) alocar: ${magicQtd - magicAlocados} pessoa(s).\nEscolha o próximo trabalhador na lista.`);
                            await fetch(`/api/solicitacoes/${magicSolId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ novo_status: `Em curso (${magicAlocados}/${magicQtd})` }) });
                            document.getElementById('escFunc').value = ''; atualizarUIMagica(); listarEscalas();
                        }
                    } else {
                        alert('Agendado com sucesso!'); cancelarEdicaoEscala(); listarEscalas();
                    }
                }
            } else {
                const dataIn = new Date(document.getElementById('escDataIn').value);
                const dataAte = new Date(document.getElementById('escDataAte').value);
                const diasValidos = Array.from(document.querySelectorAll('.dia-semana:checked')).map(cb => parseInt(cb.value));

                if (dataAte < dataIn) {
                    alert("A data final tem de ser maior que a inicial!");
                    btn.innerText = 'Confirmar Agendamento'; btn.disabled = false; return;
                }

                let teveErro = false;
                let conflitosStr = "";
                let atendidosArray = [];
                let loteGeradoIds = [];

                for (let d = new Date(dataIn); d <= dataAte; d.setDate(d.getDate() + 1)) {
                    if (diasValidos.includes(d.getDay())) {
                        const dataStr = d.toISOString().slice(0, 10);
                        let targetSolId = magicSolId;

                        if (magicSolId) {
                            const solOriginal = dadosSolicitacoes.find(s => s.id === magicSolId);
                            if (solOriginal) {
                                const matchingSol = dadosSolicitacoes.find(s => s.unidade_id == solOriginal.unidade_id && s.funcao === solOriginal.funcao && s.data_inicio === dataStr);
                                targetSolId = matchingSol ? matchingSol.id : null;
                            }
                        }

                        const payload = { 
                            ...baseDados, 
                            data_inicio: dataStr, 
                            data_fim: dataStr, 
                            solicitacao_id: targetSolId,
                            timestamp_inicio_pausa: vInicio ? `${dataStr}T${vInicio}:00` : null,
                            timestamp_fim_pausa: vFim ? `${dataStr}T${vFim}:00` : null
                        };
                        
                        const res = await fetch('/api/escalas', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(payload) });

                        if (!res.ok) {
                            const erroD = await res.json(); conflitosStr += `\n- Dia ${dataStr}: ${erroD.erro}`; teveErro = true;
                        } else {
                            if (targetSolId) atendidosArray.push(targetSolId);

                            if (funcEscolhido === 'A_DEFINIR') {
                                const resE = await fetch(`/api/escalas/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } });
                                const todasEscalasRecentes = await resE.json();
                                const rec = todasEscalasRecentes.find(x => x.data_inicio === dataStr && x.unidade_id == payload.unidade_id && x.funcao === payload.funcao && (!x.funcionario_id || x.funcionario_id === 'A_DEFINIR'));
                                if (rec) loteGeradoIds.push(rec.id);
                            }
                        }
                    }
                }

                if (conflitosStr) alert(`Agendamento processado com os seguintes conflitos:` + conflitosStr);

                if (atendidosArray.length > 0) {
                    const resS = await fetch(`/api/solicitacoes/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } });
                    const solsAtualizadas = await resS.json();
                    for (let id of atendidosArray) {
                        const s = solsAtualizadas.find(x => x.id === id);
                        if (s) {
                            let novoStatus = s.status;
                            const countAloc = s.alocados ? parseInt(s.alocados) : 0;
                            if (countAloc >= s.quantidade) novoStatus = 'Atendido';
                            else if (countAloc > 0) novoStatus = `Em curso (${countAloc}/${s.quantidade})`;
                            if (novoStatus !== s.status) {
                                await fetch(`/api/solicitacoes/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ novo_status: novoStatus }) });
                            }
                        }
                    }
                    alert('✅ Agendamento em Lote (B2B) concluído!');
                    cancelarMagica();
                } else {
                    if (!teveErro) {
                        if (funcEscolhido === 'A_DEFINIR' && loteGeradoIds.length > 0) {
                            const idsJuntos = loteGeradoIds.join(',');
                            const linkLote = `${window.location.origin}/app-extra.html?lote=${idsJuntos}`;

                            const msgGestor = `✅ Foram abertas ${loteGeradoIds.length} vagas!\n\nEnvie este link para a equipa escolher os dias:\n${linkLote}`;

                            if (window.whatsappAtivo) {
                                if (confirm(`${msgGestor}\n\nDeseja abrir o WhatsApp agora com este pacote?`)) {
                                    const selectUnidade = document.getElementById('escUnidade');
                                    const nomeH = selectUnidade.options[selectUnidade.selectedIndex].text;
                                    const textoW = `NOVO PACOTE DE TURNOS 🛒\n\nTemos ${loteGeradoIds.length} turnos abertos para o local:\n📍 ${nomeH}\n\nAbra o link abaixo, escolha os dias que tem disponibilidade, e aceite o pacote!\n${linkLote}`;
                                    navigator.clipboard.writeText(textoW).then(() => {
                                        window.open(`https://wa.me/?text=${encodeURIComponent(textoW)}`, '_blank');
                                    }).catch(() => { window.open(`https://wa.me/?text=${encodeURIComponent(textoW)}`, '_blank'); });
                                }
                            } else {
                                alert(msgGestor);
                            }
                        } else {
                            alert('✅ Agendamento Múltiplo processado com sucesso para o trabalhador selecionado!');
                        }
                    }
                    cancelarEdicaoEscala();
                }
                listarEscalas();
            }
        }
    } catch (err) { alert("Erro de comunicação com o servidor."); }
    btn.disabled = false;
});tn.innerText = idEdit ? 'Gravar Acerto do Turno' : 'Confirmar Agendamento';
    b

async function apagarEscala(id) { 
    if (confirm("Tem a certeza que deseja apagar/cancelar este turno?")) { 
        try { 
            const res = await fetch(`/api/escalas/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }); 
            if (res.ok) { listarEscalas(); } else { const d = await res.json(); alert(d.erro || "Erro ao apagar o turno."); } 
        } catch (e) { alert("Erro de comunicação com o servidor."); } 
    } 
}