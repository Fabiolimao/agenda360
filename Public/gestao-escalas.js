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

// BLOQUEIO VISUAL E LÓGICO NA CRIAÇÃO DE PEDIDOS (ISOLADO PARA EVITAR CONFLITOS DE VARIÁVEIS)
(function() {
    const dataHojeStr = new Date().toISOString().slice(0, 10);
    const inputSolDataIn = document.getElementById('solDataIn');
    const inputSolDataAte = document.getElementById('solDataAte');
    if(inputSolDataIn) inputSolDataIn.min = dataHojeStr;
    if(inputSolDataAte) inputSolDataAte.min = dataHojeStr;
})();

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
window.carregarSelectsCalendario = async function() {
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
};

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
        if (!Array.isArray(todasEscalas)) return;

        todasEscalas.forEach(e => {
            if (e.data_inicio) e.data_inicio = e.data_inicio.split('T')[0];
            if (e.data_fim) e.data_fim = e.data_fim.split('T')[0];
        });
        if (Array.isArray(todasSols)) {
            todasSols.forEach(s => {
                if (s.data_inicio) s.data_inicio = s.data_inicio.split('T')[0];
            });
        }

        if (tipoAcesso === 'gestor' && gestorUnidadeId) {
            dadosEscalas = todasEscalas.filter(e => e.unidade_id == gestorUnidadeId);
            dadosSolicitacoes = Array.isArray(todasSols) ? todasSols.filter(s => s.unidade_id == gestorUnidadeId) : [];
        } else {
            dadosEscalas = todasEscalas;
            dadosSolicitacoes = Array.isArray(todasSols) ? todasSols : [];
        }

        const scales = dadosEscalas.filter(e => (funcId ? e.funcionario_id == funcId : true) && (unidadeId ? e.unidade_id == unidadeId : true));
        const dataHojeStr = new Date().toISOString().slice(0, 10);
        
        const sols = dadosSolicitacoes.filter(s =>
            (unidadeId ? s.unidade_id == unidadeId : true)
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
                    const isExpirado = (s.data_inicio < dataHojeStr) || s.status.includes('Cancelado') || s.status.includes('Recusado') || s.status.includes('Expirado');
                    const corFundo = isExpirado ? '#fef2f2' : '#fffbeb';
                    const corBorda = isExpirado ? 'var(--danger-color)' : 'var(--warning-color)';
                    const corTexto = isExpirado ? '#991b1b' : '#b45309';
                    const icon = isExpirado ? '❌' : '⏳';
                    
                    blocosDia.push(`<div class="cal-escala" style="background:${corFundo}; border-left:3px solid ${corBorda}; color:${corTexto}; cursor:pointer;" onclick="abrirResumoDia('${dataAtualStr}'); event.stopPropagation();" title="Pedido B2B">${icon} ${pendentes}x ${sanitizarTexto(s.funcao)}</div>`);
                }
            });

            turnosDia.forEach(t => {
                let isVagaCancelada = (!t.funcionario_id || String(t.funcionario_id) === 'A_DEFINIR') && (t.status_turno === 'Agendamento Não efetivado' || t.status_turno === 'Cancelado');
                let isAdefinir = (!t.funcionario_id || String(t.funcionario_id) === 'A_DEFINIR') && !isVagaCancelada;
                let cor = 'laranja';

                if (isAdefinir) cor = 'laranja';
                else if (t.status_turno === 'Concluído') cor = 'verde';
                else if (t.status_turno === 'Falta' || t.status_turno === 'Cancelado' || t.status_turno === 'Agendamento Não efetivado') cor = 'vermelha';
                else if (new Date(t.data_inicio) < new Date() && !t.checkin_real) cor = 'vermelha';

                let txtNomeCurto = isVagaCancelada ? '❌ Vaga Cancelada' : (isAdefinir ? '⏳ A Definir' : (t.nome_func ? sanitizarTexto(t.nome_func.split(' ')[0]) : 'Desconhecido'));
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
        (unidadeId ? e.unidade_id == unidadeId : true)
    );

    const solsDia = dadosSolicitacoes.filter(s => s.data_inicio === dataStr && (unidadeId ? s.unidade_id == unidadeId : true));

    let html = `<div style="display:flex; flex-direction:column; gap:10px;">`;
    const formatarHora = (h) => h && h.length >= 5 ? h.substring(0, 5) : '--:--';
    
    // Extrator blindado para capturar horários convertendo de UTC para Fuso de Lisboa
    const extrairHHMM = (valor) => {
        if (!valor) return null;
        if (String(valor).includes('Z') || String(valor).includes('T')) {
            const dataObj = new Date(valor);
            if (!isNaN(dataObj)) return dataObj.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' });
        }
        const vStr = String(valor);
        if (vStr.includes(' ')) return vStr.split(' ')[1].substring(0, 5);
        return vStr.substring(0, 5);
    };

    solsDia.forEach(s => {
        const pendentes = s.quantidade - (s.alocados ? parseInt(s.alocados) : 0);
        if (pendentes > 0) {
            const isExpirado = (s.data_inicio < new Date().toISOString().slice(0, 10)) || s.status.includes('Cancelado') || s.status.includes('Recusado') || s.status.includes('Expirado');
            const corFundo = isExpirado ? '#fef2f2' : '#fffbeb';
            const corBordaPrincipal = isExpirado ? '#fca5a5' : '#fcd34d';
            const corBordaEsquerda = isExpirado ? '#ef4444' : '#f59e0b';
            const corTextoTitulo = isExpirado ? '#991b1b' : '#b45309';
            const corTextoSecundario = isExpirado ? '#7f1d1d' : '#78350f';
            const icon = isExpirado ? '❌' : '🛎️';

            html += `
            <div style="background:${corFundo}; border:1px solid ${corBordaPrincipal}; border-left:4px solid ${corBordaEsquerda}; padding:12px; border-radius:6px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                    <div>
                        <b style="color:${corTextoTitulo}; font-size:1.05rem;">${icon} Pedido B2B: ${sanitizarTexto(s.nome_unidade)}</b><br>
                        <span style="color:${corTextoSecundario};">Por alocar: <b>${pendentes}x ${sanitizarTexto(s.funcao)}</b></span><br>
                        <small style="color:${corTextoSecundario};">Horário: ${formatarHora(s.hora_entrada)} às ${formatarHora(s.hora_saida)}</small>
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
        let isVagaCancelada = (!t.funcionario_id || String(t.funcionario_id) === 'A_DEFINIR') && (t.status_turno === 'Agendamento Não efetivado' || t.status_turno === 'Cancelado');
        let isAdefinir = (!t.funcionario_id || String(t.funcionario_id) === 'A_DEFINIR') && !isVagaCancelada;
        let txtNome = isVagaCancelada ? '<span style="color:var(--danger-color);font-weight:bold;">❌ Vaga Não Preenchida</span>' : (isAdefinir ? '<span style="color:var(--warning-color);">⏳ A Definir (Turno em Aberto)</span>' : (sanitizarTexto(t.nome_func) || 'Desconhecido'));
        let statusInfo = sanitizarTexto(t.status_turno);
        let corBorda = '#cbd5e1'; let corFundo = '#ffffff';

        if (t.status_turno === 'Concluído') corBorda = 'var(--success-color)';
        else if (t.status_turno === 'Falta' || t.status_turno === 'Cancelado' || t.status_turno === 'Agendamento Não efetivado') { corBorda = 'var(--danger-color)'; corFundo = '#fef2f2'; }
        else if (t.status_turno === 'A Aguardar Validação') corBorda = 'var(--warning-color)';
        else if (t.status_turno === 'Pendente') { corBorda = 'var(--warning-color)'; corFundo = '#fffbeb'; }
        else if (isAdefinir) { corBorda = '#f59e0b'; corFundo = '#fffbeb'; }

        let hIn = formatarHora(t.hora_entrada);
        let hOut = formatarHora(t.hora_saida);
        let hInReal = formatarHora(t.checkin_real);
        let hOutReal = formatarHora(t.checkout_real);
        
        let statusReal = (t.checkin_real) ? `${hInReal} às ${t.checkout_real ? hOutReal : '...'}` : 'A aguardar';
        
        // 📍 SEPARAÇÃO DEFINITIVA DAS PAUSAS (Previsão vs Realidade)
        let pPrev = t.tem_pausa ? `${t.minutos_pausa || 0} min` : '0 min';
        
        let pRealFormat = 'A aguardar';
        if (t.checkin_real) {
            let pInReal = extrairHHMM(t.timestamp_inicio_pausa);
            let pOutReal = extrairHHMM(t.timestamp_fim_pausa);
            let pTotalReal = (t.minutos_pausa_realizados !== null && t.minutos_pausa_realizados !== undefined) ? `${t.minutos_pausa_realizados} min` : '...';
            
            if (pInReal) {
                pRealFormat = `${pInReal} às ${pOutReal ? pOutReal : '...'} (${pTotalReal})`;
            } else if (t.checkout_real) {
                pRealFormat = 'Sem registo';
            }
        }

        html += `
        <div style="background:${corFundo}; border:1px solid #e2e8f0; border-left:4px solid ${corBorda}; padding:15px; border-radius:8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:5px;">
                <b style="font-size:1.1rem; color:var(--primary-color);">${txtNome}</b>
                <span style="font-size:0.8rem; font-weight:bold; padding:4px 8px; border-radius:12px; background:#e2e8f0; color:#334155;">${statusInfo}</span>
            </div>
            
            <div style="font-size:0.9rem; color:#475569; margin-bottom:15px; line-height:1.6;">
                <div style="display:flex; align-items:center; gap:6px;">📍 <span>${sanitizarTexto(t.nome_unidade)}</span></div>
                <div style="display:flex; align-items:center; gap:6px;">⚙️ <span>${sanitizarTexto(t.funcao)}</span></div>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px; margin-bottom:10px;">
                <div style="font-size:0.75rem; font-weight:bold; color:#64748b; margin-bottom:4px; display:flex; align-items:center; gap:5px;">🕒 TURNO</div>
                <div style="font-size:0.85rem; color:#334155;">
                    <div style="margin-bottom:3px;">Previsto: <b>${hIn} às ${hOut}</b></div>
                    <div>Realizado: <b>${statusReal}</b></div>
                </div>
            </div>`;

        if (t.tem_pausa) {
            html += `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px; margin-bottom:15px;">
                <div style="font-size:0.75rem; font-weight:bold; color:#64748b; margin-bottom:4px; display:flex; align-items:center; gap:5px;">☕ PAUSA</div>
                <div style="font-size:0.85rem; color:#334155;">
                    <div style="margin-bottom:3px;">Prevista: <b>${pPrev}</b></div>
                    <div>Realizada: <b>${pRealFormat}</b></div>
                </div>
            </div>`;
        } else {
             html += `<div style="margin-bottom:15px;"></div>`;
        }

        html += `
            <div style="text-align:right; border-top:1px dashed #cbd5e1; padding-top:12px; display:flex; justify-content:flex-end; gap:8px;">
        `;

        if (tipoAcesso === 'gestor') {
            html += `<button class="btn-action" style="background:#f59e0b; color:white; border:none; font-size:0.85rem; font-weight:bold; padding:8px 12px; border-radius:6px; cursor:pointer;" onclick="document.getElementById('modalVer').style.display='none'; irParaAgendamento('${dataStr}', ${t.id})">✏️ Editar Turno</button>`;
            
            if (t.status_turno === 'A Aguardar Validação') {
                html += `<button class="btn-action" style="background:var(--warning-color); color:black; font-size:0.85rem; padding:8px 12px; border-radius:6px;" onclick="document.getElementById('modalVer').style.display='none'; abrirValidacaoPonto(${t.id})">🛡️ Validar Turno</button>`;
            }
        } else {
            html += `<button class="btn-action" style="background:var(--warning-color); color:black; font-size:0.85rem;" onclick="document.getElementById('modalVer').style.display='none'; irParaAgendamento('${dataStr}', ${t.id})">✏️ Editar Turno</button>`;

            if ((t.status_turno === 'Pendente' || isAdefinir) && window.whatsappAtivo) {
                html += `<button class="btn-action" style="background:#25D366; color:white; border:none; font-size:0.85rem;" onclick="enviarOfertaWhatsApp(${t.id})">📲 Ofertar via WhatsApp</button>`;
            }
        }

        html += `</div></div>`;
    });

    html += `</div>`;
    let d = new Date(dataStr);
    let dataF = d.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    abrirVerDetalhes(`📅 Resumo do Dia: ${dataF}`, html);
};

async function apagarEscala(id) { 
    if (confirm("Tem a certeza que deseja apagar/cancelar este turno?")) { 
        try { 
            const res = await fetch(`/api/escalas/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }); 
            if (res.ok) { listarEscalas(); } else { const d = await res.json(); alert(d.erro || "Erro ao apagar o turno."); } 
        } catch (e) { alert("Erro de comunicação com o servidor."); } 
    } 
}