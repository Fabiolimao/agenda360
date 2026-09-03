// ==========================================
// MÓDULO: RELATÓRIOS E MOTOR DA FOLHA DE PONTO (ACT)
// ==========================================
async function carregarDropdownsRelatorios() {
    try {
        const url = (tipoAcesso === 'gestor' && gestorUnidadeId) ? `/api/relatorios/agencia/${agendaId}?unidade_id=${gestorUnidadeId}` : `/api/relatorios/agencia/${agendaId}`;

        const [resU, resData, resAss] = await Promise.all([
            fetch(`/api/unidades/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } }),
            fetch(url, { headers: { 'Authorization': 'Bearer ' + token } }),
            fetch(`/api/assinaturas/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } })
        ]);

        const unids = await resU.json();
        dadosRelatorios = await resData.json();
        dadosAssinaturas = await resAss.json();

        // 📍 PASSO 1: A GUILHOTINA (Limpa a data na chegada aos Relatórios)
        if (Array.isArray(dadosRelatorios)) {
            dadosRelatorios.forEach(e => {
                if (e.data_inicio) e.data_inicio = e.data_inicio.split('T')[0];
                if (e.data_fim) e.data_fim = e.data_fim.split('T')[0];
            });
        }

        const selE = document.getElementById('repEmpresa');
        if (tipoAcesso === 'gestor' && gestorUnidadeId) {
            const u = Array.isArray(unids) ? unids.find(x => x.id == gestorUnidadeId) : null;
            selE.innerHTML = u ? `<option value="${u.id}">🏢 ${u.nome_empresa} - ${u.nome_unidade}</option>` : '<option value="">Unidade Local</option>';
            selE.disabled = true;
        } else {
            selE.innerHTML = '<option value="">-- Todas as Empresas --</option>';
            if (Array.isArray(unids)) unids.forEach(u => selE.innerHTML += `<option value="${u.id}">${u.nome_empresa} - ${u.nome_unidade}</option>`);
            selE.disabled = false;
        }

        const funcUnicos = new Map();
        if (Array.isArray(dadosRelatorios)) {
            dadosRelatorios.forEach(e => {
                if (e.funcionario_id && e.nome_func && String(e.funcionario_id) !== 'A_DEFINIR' && String(e.funcionario_id) !== 'null') {
                    if (!funcUnicos.has(e.funcionario_id)) funcUnicos.set(e.funcionario_id, e.nome_func);
                }
            });
        }

        const selF = document.getElementById('repFuncionario');
        selF.innerHTML = '<option value="">-- Todos os Funcionários --</option>';
        const selAssF = document.getElementById('assFuncionario');
        if (selAssF) selAssF.innerHTML = '<option value="">-- Escolher Trabalhador --</option>';

        funcUnicos.forEach((nome, id) => {
            selF.innerHTML += `<option value="${id}">${nome}</option>`;
            if (selAssF) selAssF.innerHTML += `<option value="${id}">${nome}</option>`;
        });

        processarFiltroRelatorio();
        if (tipoAcesso !== 'gestor') renderizarTabelaAssinaturas();
    } catch (e) {
        console.error("Erro ao carregar ecrã de relatórios:", e);
    }
}

document.getElementById('formSolicitarAssinatura')?.addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    const payload = { agencia_id: agendaId, funcionario_id: document.getElementById('assFuncionario').value, mes: document.getElementById('assMes').value, ano: document.getElementById('assAno').value }; 
    const res = await fetch('/api/assinaturas/solicitar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(payload) }); 
    const data = await res.json(); 
    if (res.ok) { alert(data.mensagem); carregarDropdownsRelatorios(); } else alert(data.erro); 
});

function renderizarTabelaAssinaturas() {
    const tbody = document.getElementById('tabelaAssinaturas'); if (!tbody) return; tbody.innerHTML = ''; 
    if (!Array.isArray(dadosAssinaturas) || dadosAssinaturas.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">Nenhuma assinatura solicitada.</td></tr>'; return; } 
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']; 
    dadosAssinaturas.forEach(a => {
        const cor = a.status === 'Assinado' ? 'color: var(--success-color);' : 'color: var(--warning-color);';
        tbody.innerHTML += `<tr><td data-label="Trabalhador"><b>${a.nome_func}</b></td><td data-label="Mês Fechado">${meses[a.mes - 1]} / ${a.ano}</td><td data-label="Estado" style="font-weight:bold; ${cor}">${a.status}</td><td data-label="Carimbo Digital" style="font-size:0.8rem; color:#64748b;">${a.carimbo_digital || 'A aguardar...'}</td><td data-label="Ações"><button class="btn-small btn-delete" onclick="apagarAssinatura(${a.id})">🗑 Anular</button></td></tr>`;
    });
}

async function apagarAssinatura(id) { 
    if (confirm('Tem a certeza que deseja anular este pedido de assinatura?')) { 
        await fetch(`/api/assinaturas/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }); 
        carregarDropdownsRelatorios(); 
    } 
}

function processarFiltroRelatorio() {
    if (!Array.isArray(dadosRelatorios)) return;

    const cardGrelha = document.getElementById('cardGrelhaMensal');
    const cardResultados = document.getElementById('cardResultadosRelatorio');
    if (cardGrelha) cardGrelha.style.display = 'none';
    if (cardResultados) cardResultados.style.display = 'block';

    let printHeader = document.getElementById('cabecalhoPrintListaTurnos');
    if (!printHeader) {
        printHeader = document.createElement('div');
        printHeader.id = 'cabecalhoPrintListaTurnos';
        printHeader.innerHTML =
            '<style media="print">#cabecalhoPrintListaTurnos { display: flex !important; width: 100%; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-family: sans-serif; } .no-print { display: none !important; }</style>' +
            '<style media="screen">#cabecalhoPrintListaTurnos { display: none !important; }</style>' +
            '<img src="/logo_agenda_360.jpeg" style="max-height: 60px; width: auto;" alt="Logo" onerror="this.style.display=\'none\'">' +
            '<div style="text-align: right;">' +
                '<h3 style="margin: 0; color: #1e293b; font-size: 16px;">LISTA DE TURNOS</h3>' +
                '<span style="font-size: 12px; color: #64748b; font-weight: bold;" id="dataEmissaoListaTurnos"></span>' +
            '</div>';
        cardResultados.insertBefore(printHeader, cardResultados.firstChild);
    }
    document.getElementById('dataEmissaoListaTurnos').innerText = 'Emitido em: ' + new Date().toLocaleDateString('pt-PT');

    const fEmpresa = document.getElementById('repEmpresa').value;
    const fFunc = document.getElementById('repFuncionario').value;
    const fStatus = document.getElementById('repStatus').value;
    const fDataIn = document.getElementById('repDataInicio').value;
    const fDataFim = document.getElementById('repDataFim').value;

    const escalasFiltradas = dadosRelatorios.filter(e => {
        return (fEmpresa ? e.unidade_id == fEmpresa : true) &&
            (fFunc ? e.funcionario_id == fFunc : true) &&
            (fStatus ? e.status_turno == fStatus : true) &&
            (fDataIn ? e.data_inicio >= fDataIn : true) &&
            (fDataFim ? e.data_inicio <= fDataFim : true);
    });

    const tbody = document.getElementById('corpoRelatorio');
    if (!tbody) return;
    tbody.innerHTML = '';
    let acumuladorMinutos = 0;
    const blocoAss = document.getElementById('blocoAssinatura');

    if (escalasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #64748b;">Nenhum registo atende aos filtros.</td></tr>';
        document.getElementById('totalHorasRelatorio').innerText = '00:00 h';
        if (blocoAss) blocoAss.style.display = 'none';
        return;
    }

    escalasFiltradas.forEach(e => {
        const p = e.minutos_pausa !== undefined ? e.minutos_pausa : (e.minutes_pausa !== undefined ? e.minutes_pausa : 0);
        let txtPausa = 'Sem Pausa';
        if (e.tem_pausa) {
            let pReal = (e.minutos_pausa_realizados !== null && e.minutos_pausa_realizados !== undefined) ? e.minutos_pausa_realizados : '-';
            let flag = e.pausa_status_flag || 'Pendente';

            let corBadge = '#fef3c7'; // Amarelo
            let corTexto = '#b45309';
            let icon = '☕';

            if (flag === 'Excedido') {
                corBadge = '#fee2e2'; corTexto = '#991b1b'; icon = '⚠️';
            } else if (flag === 'Cumprido' || flag === 'Abaixo') {
                corBadge = '#dcfce7'; corTexto = '#166534'; icon = '✅';
            }

            txtPausa = `<div style="font-size:0.75rem; color:#64748b; margin-bottom: 2px;">Previsto: <b>${p}</b> min</div>
                        <span style="color:${corTexto}; font-weight:bold; background:${corBadge}; padding:2px 6px; border-radius:4px; display:inline-block;" title="Status: ${flag}">
                        ${icon} Real: <b>${pReal}</b> min
                        </span>`;
        }
        let txtHoras = '00:00 h';
        let estiloLinha = '';
        let corStatus = 'color:var(--warning-color);';

        if (e.status_turno === 'Concluído') corStatus = 'color:var(--success-color);';
        if (e.status_turno === 'Falta' || e.status_turno === 'Cancelado' || e.status_turno === 'Agendamento Não efetivado') corStatus = 'color:var(--danger-color);';

        if (e.status_turno === 'Falta' || e.status_turno === 'Cancelado' || e.status_turno === 'Agendamento Não efetivado') {
            txtHoras = '<span style="color:var(--danger-color); font-weight:bold;">00:00 h</span>';
            estiloLinha = 'style="background: #fef2f2;"';
        } else if (e.status_turno === 'Concluído' && (!e.checkin_real || !e.checkout_real)) {
            txtHoras = '<span style="color:var(--danger-color); font-weight:bold;">⚠️ Ajuste</span>';
            estiloLinha = 'style="background: #fffbeb;"';
        } else if (e.checkin_real && e.checkout_real) {
            let [hIn, mIn] = e.checkin_real.split(':').map(Number);
            let [hOut, mOut] = e.checkout_real.split(':').map(Number);
            let minIn = hIn * 60 + mIn;
            let minOut = hOut * 60 + mOut;
            if (minOut < minIn) minOut += 24 * 60;
            let mTrab = minOut - minIn;
            if (e.tem_pausa) mTrab -= p;
            if (mTrab > 0) {
                acumuladorMinutos += mTrab;
                txtHoras = formatarMinutosParaHHMM(mTrab);
            }
        }

        let isAdefinir = (!e.funcionario_id || String(e.funcionario_id) === 'A_DEFINIR' || String(e.funcionario_id) === 'null');
        let txtNome = isAdefinir ? '<span style="color:var(--warning-color);">⏳ A Definir (Turno em Aberto)</span>' : (e.nome_func || 'Desconhecido');

        tbody.innerHTML += `<tr ${estiloLinha}><td data-label="Localização"><b>${e.nome_empresa}</b><br><small style="color:#64748b;">${e.morada_unidade || '-'}, ${e.cidade_unidade || ''}</small></td><td data-label="Funcionário"><b>${txtNome}</b><br><small style="color:var(--primary-color); font-weight:600;">${e.funcao}</small></td><td data-label="Data">${e.data_inicio}</td><td data-label="Estado"><span style="${corStatus} font-weight:bold;">${e.status_turno}</span></td><td data-label="Entrada Real"><span style="font-size:0.8rem;color:#64748b;">Previsto: ${e.hora_entrada}</span><br>Real: <b>${e.checkin_real || '--:--'}</b></td><td data-label="Saída Real"><span style="font-size:0.8rem;color:#64748b;">Previsto: ${e.hora_saida}</span><br>Real: <b>${e.checkout_real || '--:--'}</b></td><td data-label="Pausa">${txtPausa}</td><td data-label="Horas Efetivas" style="text-align: right; font-weight: bold;">${txtHoras}</td></tr>`;
    });

    document.getElementById('totalHorasRelatorio').innerText = formatarMinutosParaHHMM(acumuladorMinutos);

    if (blocoAss) {
        if (fFunc && fDataIn) {
            const selectFunc = document.getElementById('repFuncionario');
            const nomeFunc = selectFunc.options[selectFunc.selectedIndex].text;
            const dataObj = new Date(fDataIn);
            const mesFiltro = dataObj.getMonth() + 1;
            const anoFiltro = dataObj.getFullYear();
            const assinaturaAtiva = Array.isArray(dadosAssinaturas) ? dadosAssinaturas.find(x => x.funcionario_id == fFunc && x.mes == mesFiltro && x.ano == anoFiltro && x.status === 'Assinado') : null;
            if (assinaturaAtiva) {
                blocoAss.innerHTML = `<h3 style="font-size: 11pt; color: var(--success-color); margin-bottom: 10px;">✅ DECLARAÇÃO DE TEMPOS DE TRABALHO ASSINADA DIGITALMENTE</h3><div style="font-size: 9pt; color: #475569; text-align: justify; line-height: 1.5; margin-bottom: 20px;"><p>Nos termos e para os efeitos da legislação laboral, o trabalhador validou através de autenticação pessoal que o presente extrato reflete com exatidão os seus tempos de trabalho.</p></div><p style="font-size: 10pt; color: #0f172a; margin-bottom: 10px;"><strong>Funcionário:</strong> ${nomeFunc}</p><div style="margin-top: 20px; padding: 15px; background: #f0fdf4; border: 1px solid #10b981; border-radius: 6px; text-align: center;"><p style="margin: 0; font-size: 12pt; font-weight: bold; color: #0f172a;">${assinaturaAtiva.carimbo_digital}</p><p style="margin: 5px 0 0 0; font-size: 8pt; color: #64748b;">(Carimbo Criptográfico Inviolável)</p></div>`;
            } else {
                blocoAss.innerHTML = `<h3 style="font-size: 11pt; color: var(--primary-color); margin-bottom: 10px;">DECLARAÇÃO DE VALIDAÇÃO DE TEMPOS DE TRABALHO</h3><div style="font-size: 9pt; color: #475569; text-align: justify; line-height: 1.5; margin-bottom: 20px;"><p>Nos termos da lei, declaro que tomei conocimiento e concordo expressamente com o presente extrato, confirmando a sua exatidão.</p></div><p style="font-size: 10pt; color: #0f172a; margin-bottom: 30px;"><strong>Data:</strong> ____ / ____ / ________</p><p style="font-size: 10pt; color: #0f172a;"><strong>Assinatura:</strong> ___________________________________________________________</p>`;
            }
            blocoAss.style.display = 'block';
        } else {
            blocoAss.style.display = 'none';
        }
    }
}

window.gerarGrelhaMensal = async function() {
    var fFunc = document.getElementById('repFuncionario').value;
    var fDataIn = document.getElementById('repDataInicio').value;
    var fEmpresa = document.getElementById('repEmpresa').value;

    if (!fFunc) return alert('❌ Selecione um Trabalhador específico.');
    if (!fDataIn) return alert('❌ Selecione uma Data Inicial (De).');

    var dataObj = new Date(fDataIn);
    var ano = dataObj.getFullYear();
    var mes = dataObj.getMonth() + 1;

    var selectFunc = document.getElementById('repFuncionario');
    var nomeFunc = selectFunc.options[selectFunc.selectedIndex].text;
    
    var dataEmissao = new Date().toLocaleDateString('pt-PT');

    var cardGrelha = document.getElementById('cardGrelhaMensal');
    var cardResultados = document.getElementById('cardResultadosRelatorio');
    if (cardResultados) cardResultados.style.display = 'none';
    if (cardGrelha) cardGrelha.style.display = 'block';

    var children = cardGrelha.children;
    for (var i = 0; i < children.length; i++) {
        if (children[i].id !== 'grelhaActUnificada') children[i].style.display = 'none';
    }

    var containerUnificado = document.getElementById('grelhaActUnificada');
    if (!containerUnificado) {
        containerUnificado = document.createElement('div');
        containerUnificado.id = 'grelhaActUnificada';
        cardGrelha.appendChild(containerUnificado);
    }
    
    containerUnificado.style.display = 'block';
    containerUnificado.innerHTML = '<h3 style="text-align:center; padding: 40px; color:#64748b;">⏳ A processar folha de ponto com motor ACT...</h3>';

    try {
        var resFolhaP = fetch('/api/folha-ponto/trabalhador/' + fFunc + '/' + ano + '/' + mes, { headers: { 'Authorization': 'Bearer ' + token } });
        var resAssP = fetch('/api/assinaturas/agencia/' + agendaId, { headers: { 'Authorization': 'Bearer ' + token } });

        var respostas = await Promise.all([resFolhaP, resAssP]);
        var resFolha = respostas[0];
        var resAss = respostas[1];

        var dadosFolha = await resFolha.json();
        var assinaturas = await resAss.json();

        var gruposValidos = dadosFolha.agrupamentos || [];
        var novoGrupos = [];
        
        if (typeof tipoAcesso !== 'undefined' && tipoAcesso === 'gestor' && typeof gestorUnidadeId !== 'undefined' && gestorUnidadeId) {
            for (var g1 = 0; g1 < gruposValidos.length; g1++) {
                if (gruposValidos[g1].unidade_id == gestorUnidadeId) novoGrupos.push(gruposValidos[g1]);
            }
            gruposValidos = novoGrupos;
        } else if (fEmpresa) {
            for (var g2 = 0; g2 < gruposValidos.length; g2++) {
                if (gruposValidos[g2].unidade_id == fEmpresa) novoGrupos.push(gruposValidos[g2]);
            }
            gruposValidos = novoGrupos;
        }

        if (gruposValidos.length === 0) {
            containerUnificado.innerHTML = '' +
                '<div class="no-print" style="text-align: right; margin-bottom: 15px;">' +
                    '<button class="btn-main" style="background: #64748b; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;" onclick="document.getElementById(\'cardGrelhaMensal\').style.display=\'none\'; document.getElementById(\'cardResultadosRelatorio\').style.display=\'block\';">⬅️ Voltar aos Resultados</button>' +
                '</div>' +
                '<h3 style="text-align:center; padding: 40px; color:#ef4444;">❌ Não há dados de ponto neste mês para o filtro selecionado.</h3>';
            return;
        }

        var nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
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

        var conteudoHTML = '' +
            '<style media="print">' +
                '@page { size: A4 portrait; margin: 0 !important; }' +
                'body.print-act-active * { visibility: hidden !important; }' +
                'body.print-act-active #print-master-act, body.print-act-active #print-master-act * { visibility: visible !important; }' +
                'body.print-act-active #print-master-act { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 1.5cm !important; margin: 0 !important; font-family: sans-serif; }' +
            '</style>' +
            '<div class="no-print" style="margin-bottom: 15px; text-align: right; display:flex; justify-content:space-between; align-items:center;">' +
                '<button class="btn-main" style="background: #64748b; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;" onclick="document.getElementById(\'cardGrelhaMensal\').style.display=\'none\'; document.getElementById(\'cardResultadosRelatorio\').style.display=\'block\';">⬅️ Voltar aos Resultados</button>' +
                '<button class="btn-main" style="background: #0284c7; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;" onclick="document.body.classList.add(\'print-act-active\'); window.print(); setTimeout(function() { document.body.classList.remove(\'print-act-active\'); }, 1000);">🖨️ Imprimir PDF Oficial</button>' +
            '</div>' +
            '<div id="print-master-act">';

        gruposValidos.forEach(function(grupo) {
            var assinaturaAtiva = null;
            if (Array.isArray(assinaturas)) {
                for (var a = 0; a < assinaturas.length; a++) {
                    if (assinaturas[a].funcionario_id == fFunc && assinaturas[a].mes == mes && assinaturas[a].ano == ano && assinaturas[a].cliente_id == grupo.cliente_id && assinaturas[a].unidade_id == grupo.unidade_id && assinaturas[a].status === 'Assinado') {
                        assinaturaAtiva = assinaturas[a];
                        break;
                    }
                }
            }
            
            var totNormais = 0, totNoturnas = 0, totExtra = 0, totEfetivas = 0;
            var linhasTabela = '';

            grupo.dias.forEach(function(d) {
                var dtObj = new Date(ano, mes - 1, d.dia);
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

                var dDiaStr = String(d.dia);
                if (dDiaStr.length < 2) dDiaStr = '0' + dDiaStr;

                linhasTabela += '<tr style="border-bottom: 1px solid #cbd5e1; ' + bgRow + '">' +
                    '<td style="padding: 4px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1;">' + dDiaStr + ' (' + diaSemana + ')</td>' +
                    '<td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">' + detalheFormatado + '</td>' +
                    '<td style="padding: 4px; text-align: center; color: #64748b; border: 1px solid #cbd5e1;">' + txtPausa + '</td>' +
                    '<td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">' + formataHoras(d.horas_normais) + '</td>' +
                    '<td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">' + formataHoras(d.horas_noturnas) + '</td>' +
                    '<td style="padding: 4px; text-align: center; color: #b45309; font-weight: bold; border: 1px solid #cbd5e1;">' + formataHoras(d.horas_extra) + '</td>' +
                    '<td style="padding: 4px; text-align: center; font-weight: bold; color: #1e293b; border: 1px solid #cbd5e1;">' + formataHoras(d.efetivo_horas) + '</td>' +
                '</tr>';
            });

            var blocoAssinaturaHTML = '';
            if (assinaturaAtiva) {
                blocoAssinaturaHTML = '' +
                    '<div style="background: #f0fdf4; border: 1px solid #10b981; border-radius: 6px; padding: 10px; margin-top: 15px; text-align: center; page-break-inside: avoid;">' +
                        '<h3 style="font-size: 11px; color: #15803d; margin: 0 0 4px 0;">✅ DECLARAÇÃO DE TEMPOS DE TRABALHO ASSINADA DIGITALMENTE</h3>' +
                        '<p style="margin: 0; font-size: 12px; font-weight: bold; color: #0f172a;">' + assinaturaAtiva.carimbo_digital + '</p>' +
                        '<p style="margin: 4px 0 0 0; font-size: 9px; color: #64748b;">(Carimbo Criptográfico Inviolável)</p>' +
                    '</div>';
            } else {
                blocoAssinaturaHTML = '' +
                    '<div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 15px; margin-top: 15px; text-align: center; page-break-inside: avoid;">' +
                        '<h3 style="font-size: 11px; color: #0284c7; margin: 0 0 4px 0;">DECLARAÇÃO DE VALIDAÇÃO DE TEMPOS DE TRABALHO</h3>' +
                        '<p style="font-size: 9px; color: #475569; margin-bottom: 15px;">Nos termos da lei, declaro que tomei conhecimento e concordo expressamente com o presente extrato, confirmando a sua exatidão.</p>' +
                        '<div style="display: flex; justify-content: space-around; margin-top: 20px;">' +
                            '<div style="text-align: left;"><p style="margin: 0; font-size: 10px; color: #0f172a;">Data: ____ / ____ / ________</p></div>' +
                            '<div style="text-align: right;"><p style="margin: 0; font-size: 10px; color: #0f172a;">Assinatura: _________________________________________</p></div>' +
                        '</div>' +
                    '</div>';
            }

            var nifAgencia = grupo.agencia_nif || 'N/D';
            var nifUnidade = grupo.unidade_nif || 'N/D';
            var nomeAgencia = typeof agendaNome !== 'undefined' ? agendaNome : 'N/D';
            var empresa = grupo.empresa || 'N/D';
            var unidade = grupo.unidade || 'N/D';
            var funcao = grupo.funcao || 'N/D';
            var mesStr = String(mes);
            if (mesStr.length < 2) mesStr = '0' + mesStr;

            conteudoHTML += '' +
                '<div class="act-page-break" style="padding: 1.5cm; box-sizing: border-box;">' +
                    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
                        '<img src="/logo_agenda_360.jpeg" style="max-height: 60px; width: auto;" onerror="this.style.display=\'none\'">' +
                        '<span style="font-size: 12px; font-weight: bold;">Emitido em: ' + dataEmissao + '</span>' +
                    '</div>' +
                    '<div style="border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 15px; font-size: 11px; background: #f8fafc; color: #0f172a; width: 100%; page-break-inside: avoid;">' +
                        '<div style="background: #f1f5f9; padding: 6px 10px; font-weight: bold; color: #1e293b; border-bottom: 1px solid #cbd5e1; font-size: 12px;">' +
                            '🏛️ Registo de Tempos de Trabalho (Folha Mensal ACT)' +
                        '</div>' +
                        '<div style="padding: 6px 10px; border-bottom: 1px solid #cbd5e1;">' +
                            '<div style="color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: bold;">Entidade Empregadora (Agência)</div>' +
                            '<div><strong>Nome:</strong> ' + nomeAgencia + ' | <strong>NIF:</strong> ' + nifAgencia + '</div>' +
                        '</div>' +
                        '<div style="padding: 6px 10px; border-bottom: 1px solid #cbd5e1;">' +
                            '<div style="color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: bold;">Local de Trabalho (Cliente / Unidade)</div>' +
                            '<div><strong>Nome:</strong> ' + empresa + ' - ' + unidade + ' | <strong>NIF:</strong> ' + nifUnidade + '</div>' +
                        '</div>' +
                        '<div style="padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">' +
                            '<div>' +
                                '<div style="color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: bold;">Dados do Trabalhador</div>' +
                                '<div><strong>Nome:</strong> ' + nomeFunc + ' | <strong>Função:</strong> ' + funcao + '</div>' +
                            '</div>' +
                            '<div style="text-align: right;">' +
                                '<div style="color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: bold;">Período</div>' +
                                '<div style="font-size: 12px; font-weight: bold; color: #1e293b;">' + mesStr + ' / ' + ano + '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 15px;">' +
                        '<table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: center; color: #0f172a; table-layout: fixed;">' +
                            '<thead>' +
                                '<tr style="background: #1e293b; color: white;">' +
                                    '<th style="padding: 4px; width: 14%; border: 1px solid #cbd5e1;">Dia</th>' +
                                    '<th style="padding: 4px; width: 22%; border: 1px solid #cbd5e1;">Entrada / Saída</th>' +
                                    '<th style="padding: 4px; width: 12%; border: 1px solid #cbd5e1;">Pausa</th>' +
                                    '<th style="padding: 4px; width: 13%; border: 1px solid #cbd5e1;">H. Normais</th>' +
                                    '<th style="padding: 4px; width: 13%; border: 1px solid #cbd5e1;">H. Noturnas</th>' +
                                    '<th style="padding: 4px; width: 13%; border: 1px solid #cbd5e1;">H. Extra</th>' +
                                    '<th style="padding: 4px; width: 13%; border: 1px solid #cbd5e1;">Total Efetivas</th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody>' +
                                linhasTabela +
                            '</tbody>' +
                            '<tfoot>' +
                                '<tr style="background: #e0f2fe; font-weight: bold;">' +
                                    '<td colspan="3" style="text-align: right; padding: 6px; border: 1px solid #cbd5e1;">TOTAL MENSAL:</td>' +
                                    '<td style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">' + formataHoras(totNormais) + 'h</td>' +
                                    '<td style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">' + formataHoras(totNoturnas) + 'h</td>' +
                                    '<td style="padding: 6px; text-align: center; color: #b45309; border: 1px solid #cbd5e1;">' + formataHoras(totExtra) + 'h</td>' +
                                    '<td style="padding: 6px; text-align: center; color: #1e293b; border: 1px solid #cbd5e1;">' + formataHoras(totEfetivas) + 'h</td>' +
                                '</tr>' +
                            '</tfoot>' +
                        '</table>' +
                    '</div>' +
                    blocoAssinaturaHTML +
                '</div>';
        });

        conteudoHTML += '</div>';
        conteudoHTML += '</div>';
        containerUnificado.innerHTML = conteudoHTML;

    } catch(e) {
        console.error(e);
        containerUnificado.innerHTML = '<h3 style="text-align:center; padding: 40px; color:#ef4444;">❌ Erro ao extrair dados do servidor.</h3>';
    }
};

window.exportarGrelhaMensalExcel = function () {
    const tbody = document.getElementById('tabelaGrelhaMensal');
    if (!tbody || tbody.rows.length <= 1) return alert("Sem dados.");
    let csv = '\uFEFFDia;Data;Local e Função;Horário;Entrada;Saída;Pausa;Horas Efetivas\n';

    tbody.querySelectorAll('tbody tr').forEach(row => {
        const cells = row.querySelectorAll('td, th');
        let rowData = [];
        cells.forEach(c => {
            let txt = c.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim();
            rowData.push(`"${txt}"`);
        });

        if (cells.length === 3) {
            csv += `"${cells[0].innerText.trim()}";"${cells[1].innerText.trim()}";"Folga / Sem Registo";"";"";"";"";""\n`;
        } else {
            csv += rowData.join(';') + '\n';
        }
    });

    const tfoot = tbody.querySelector('tfoot td:last-child');
    const total = tfoot ? tfoot.innerText.trim() : "00:00 h";
    csv += `;;;;;;;SOMATÓRIO TOTAL:;"${total.replace(' h', '')}"\n`;

    let link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.setAttribute("download", `Folha_Ponto_Mensal.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

function exportarExcelRelatorio() { 
    const tbody = document.getElementById('corpoRelatorio'); 
    if (!tbody || tbody.rows.length <= 1 && tbody.rows[0].cells.length === 1) return alert("Sem dados."); 
    let csv = '\uFEFFEmpresa;Localização;Funcionário;Função Alocada;Data;Estado;Check-in Real;Check-out Real;Pausa (min);Horas Efetivas\n'; 
    tbody.querySelectorAll('tr').forEach(row => { 
        const cells = row.querySelectorAll('td'); 
        if (cells.length < 8) return; 
        csv += `"${cells[0].querySelector('b').innerText}";"${cells[0].querySelector('small').innerText}";"${cells[1].querySelector('b').innerText}";"${cells[1].querySelector('small').innerText}";"${cells[2].innerText}";"${cells[3].innerText}";"${cells[4].innerText}";"${cells[5].innerText}";"${cells[6].innerText.replace('☕ ', '')}";"${cells[7].innerText.replace(' h', '')}"\n`; 
    }); 
    csv += `;;;;;;;SOMATÓRIO TOTAL:;;"${document.getElementById('totalHorasRelatorio').innerText.replace(' h', '')}"\n`; 
    let link = document.createElement("a"); 
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); 
    link.setAttribute("download", `Agenda360_Relatorio.csv`); 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
}
// ==========================================
// MÓDULO: MAPA SEMANAL DE ESCALAS
// ==========================================

window.abrirModalMapaSemanal = function() {
    const modal = document.getElementById('modalMapaSemanal');
    if (!modal) return alert("Modal do Mapa Semanal não encontrado.");
    
    // Popula as unidades com a mesma lista já carregada no calendário
    const selCal = document.getElementById('calUnidade'); 
    const selMapa = document.getElementById('mapaUnidadeSelect');
    if (selCal && selMapa) {
        selMapa.innerHTML = selCal.innerHTML;
    }

    // Define a data inicial para a Segunda-feira da semana atual
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    document.getElementById('mapaDataInicio').value = monday.toISOString().slice(0, 10);

    modal.style.display = 'flex';
};

window.gerarEImprimirMapa = async function () {
    const selMapa = document.getElementById('mapaUnidadeSelect');
    const unidadeId = selMapa.value;
    const dataInicio = document.getElementById('mapaDataInicio').value;

    if (!dataInicio) return alert("Escolha a data de início da semana.");

    // CORREÇÃO: Extrair o nome da Unidade diretamente do texto escolhido no dropdown
    let nomeUnidadeTxt = "Todas as Unidades";
    if (unidadeId && selMapa.selectedIndex >= 0) {
        nomeUnidadeTxt = selMapa.options[selMapa.selectedIndex].text;
    }

    const dIn = new Date(dataInicio);
    const diasSemana = [];
    const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let i = 0; i < 7; i++) {
        const d = new Date(dIn);
        d.setDate(dIn.getDate() + i);
        const dataStr = d.toISOString().slice(0, 10);
        const dataFormatada = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        diasSemana.push({ dateObj: d, dataStr, labelDia: nomesDias[d.getDay()], labelData: dataFormatada });
    }

    try {
        const res = await fetch(`/api/escalas/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } });
        let escalas = await res.json();

        // 📍 PASSO 1: A GUILHOTINA (Segurança também para o Mapa Semanal)
        if (Array.isArray(escalas)) {
            escalas.forEach(e => {
                if (e.data_inicio) e.data_inicio = e.data_inicio.split('T')[0];
                if (e.data_fim) e.data_fim = e.data_fim.split('T')[0];
            });
        }

        if (unidadeId) {
            escalas = escalas.filter(e => e.unidade_id == unidadeId);
        }

        escalas = escalas.filter(e => {
            return e.data_inicio >= diasSemana[0].dataStr &&
                e.data_inicio <= diasSemana[6].dataStr &&
                e.status_turno !== 'Cancelado' &&
                e.status_turno !== 'Falta';
        });

        const mapaPorFunc = {};
        escalas.forEach(e => {
            let funcId = e.funcionario_id || 'A_DEFINIR';
            let nomeFunc = funcId === 'A_DEFINIR' ? '❓ A Definir' : (e.nome_func || 'Desconhecido');
            let chaveFunc = `${funcId}_${nomeFunc}_${e.funcao}`;

            if (!mapaPorFunc[chaveFunc]) {
                mapaPorFunc[chaveFunc] = { nome: nomeFunc, funcao: e.funcao, turnos: {} };
            }

            if (mapaPorFunc[chaveFunc].turnos[e.data_inicio]) {
                mapaPorFunc[chaveFunc].turnos[e.data_inicio] += `<br>${e.hora_entrada} - ${e.hora_saida}`;
            } else {
                mapaPorFunc[chaveFunc].turnos[e.data_inicio] = `${e.hora_entrada} - ${e.hora_saida}`;
            }
        });

        // --- CONSTRUÇÃO DO HTML (CABEÇALHO + TABELA) ---
        let htmlConteudo = '';
        htmlConteudo += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-family: sans-serif;">';
        htmlConteudo += '<img src="/logo_agenda_360.jpeg" style="max-height: 60px; width: auto;" alt="Logo" onerror="this.style.display=\'none\'">';
        htmlConteudo += '<div style="text-align: right;">';
        htmlConteudo += '<h3 style="margin: 0; color: #1e293b; font-size: 16px;">MAPA SEMANAL DE ESCALAS</h3>';
        htmlConteudo += '<span style="font-size: 12px; color: #64748b; font-weight: bold;">Semana de ' + diasSemana[0].labelData + ' a ' + diasSemana[6].labelData + '</span>';
        htmlConteudo += '</div></div>';

        htmlConteudo += '<div style="margin-bottom: 15px; font-size: 12px; color: #475569;">';
        htmlConteudo += '<strong>Agência:</strong> ' + (typeof agendaNome !== 'undefined' ? agendaNome : 'Empresa de Trabalho Temporário') + ' | <strong>Local:</strong> ' + nomeUnidadeTxt;
        htmlConteudo += '</div>';

        htmlConteudo += '<table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: center;">';
        htmlConteudo += '<thead><tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1;">';
        htmlConteudo += '<th style="padding:8px; border:1px solid #e2e8f0; width:18%;">Trabalhador</th>';
        htmlConteudo += '<th style="padding:8px; border:1px solid #e2e8f0; width:12%;">Função</th>';
        diasSemana.forEach(dia => {
            htmlConteudo += `<th style="padding:8px; border:1px solid #e2e8f0; width:10%;">${dia.labelDia}<br><small style="font-weight:normal;">${dia.labelData}</small></th>`;
        });
        htmlConteudo += '</tr></thead><tbody>';

        const chaves = Object.keys(mapaPorFunc).sort((a, b) => mapaPorFunc[a].nome.localeCompare(mapaPorFunc[b].nome));

        if (chaves.length === 0) {
            htmlConteudo += `<tr><td colspan="9" style="text-align:center; padding: 20px; border:1px solid #e2e8f0;">Nenhum turno agendado para esta semana.</td></tr>`;
        } else {
            chaves.forEach(chave => {
                const f = mapaPorFunc[chave];
                htmlConteudo += `<tr>
                    <td style="padding:8px; border:1px solid #e2e8f0; text-align:left;"><b>${f.nome}</b></td>
                    <td style="padding:8px; border:1px solid #e2e8f0; color:var(--primary-color); font-size:0.9em; font-weight:600;">${f.funcao}</td>`;

                diasSemana.forEach(dia => {
                    if (f.turnos[dia.dataStr]) {
                        htmlConteudo += `<td style="padding:8px; border:1px solid #e2e8f0; background:#f0fdf4;"><b>${f.turnos[dia.dataStr]}</b></td>`;
                    } else {
                        htmlConteudo += `<td style="padding:8px; border:1px solid #e2e8f0; background:#fef2f2;"></td>`;
                    }
                });
                htmlConteudo += `</tr>`;
            });
        }
        htmlConteudo += `</tbody></table>`;

        document.getElementById('modalMapaSemanal').style.display = 'none';

        // Lógica de Impressão Segura (Iframe Isolado para não afetar o resto da página)
        var iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        var doc = iframe.contentWindow.document;
        doc.open();
        doc.write('<html><head><title>Mapa Semanal</title>');
        doc.write('<style>@page { size: A4 landscape; margin: 10mm; } body { font-family: sans-serif; }</style>');
        doc.write('</head><body>');
        doc.write(htmlConteudo);
        doc.write('</body></html>');
        doc.close();

        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(function() { document.body.removeChild(iframe); }, 2000);

    } catch (e) {
        console.error(e);
        alert("Erro ao gerar o mapa semanal.");
    }
};