async function addFuncao(inputId) { const input = document.getElementById(inputId); if (!input.value) return alert("Digite a função."); await fetch('/api/funcoes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ agencia_id: agendaId, nome: input.value }) }); input.value = ''; renderizarFuncoesCheckboxes(); carregarDropdownsAgendamento(); }

async function renderizarFuncoesCheckboxes(valoresChecados = []) {
    try {
        const res = await fetch(`/api/funcoes/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } });
        const funcoes = await res.json();
        let html = (Array.isArray(funcoes) && funcoes.length) ? '' : 'Sem funções.';
        let badgesHtml = '';
        if (Array.isArray(funcoes)) {
            funcoes.forEach(f => {
                const nomeSeguro = sanitizarTexto(f.nome);
                html += `<label class="checkbox-item"><input type="checkbox" value="${nomeSeguro}" ${valoresChecados.includes(f.nome) ? 'checked' : ''}> ${nomeSeguro}</label>`;
                badgesHtml += `<span style="background:var(--primary-color); color:white; padding:5px 12px; border-radius:15px; font-size:0.85rem; font-weight:600; box-shadow:0 2px 4px rgba(0,0,0,0.1);">${nomeSeguro}</span>`;
            });
        }
        const contF = document.getElementById('containerFuncoesFunc');
        if (contF) contF.innerHTML = html;
        document.querySelectorAll('.containerFuncoesUnid').forEach(c => c.innerHTML = html);
        const contM = document.getElementById('containerFuncoesMaster');
        if (contM) contM.innerHTML = badgesHtml ? `<div style="display:flex; gap:8px; flex-wrap:wrap;">${badgesHtml}</div>` : '<p style="color:#64748b; font-size:0.9rem;">Nenhuma função definida.</p>';
    } catch (e) { }
}

function descarregarModeloCSV() { let csv = '\uFEFFNome Completo;Email;Telemovel;NIF;Nacionalidade;Idiomas\nExemplo Silva;exemplo@email.com;912345678;123456789;Portuguesa;Português, Inglês\n'; let link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); link.setAttribute("download", `Modelo_Importacao_Funcionarios.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); }

function processarImportacaoCSV(event) { const file = event.target.files[0]; if (!file) return; const btnUpload = document.getElementById('btnUploadCsv'); btnUpload.innerText = "A importar..."; btnUpload.disabled = true; const reader = new FileReader(); reader.onload = async function (e) { const text = e.target.result; const rows = text.split(/\r?\n/); let importados = 0; let erros = 0; for (let i = 1; i < rows.length; i++) { if (!rows[i].trim()) continue; const cols = rows[i].split(';'); if (cols.length >= 4) { const nifLido = cols[3].trim(); if (!nifLido) { erros++; continue; } const dados = { agencia_id: agendaId, nome_completo: cols[0].trim(), email: cols[1].trim(), telemovel: cols[2].trim(), nif: nifLido, nacionalidade: cols[4] ? cols[4].trim() : '', idiomas: cols[5] ? cols[5].trim() : '', senha: nifLido, funcoes_habilitadas: [] }; try { const res = await fetch('/api/funcionarios', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(dados) }); if (res.ok) importados++; else erros++; } catch (err) { erros++; } } else { erros++; } } alert(`Importação Concluída!\n✅ Sucesso: ${importados} trabalhadores registados.\n❌ Falhas/Repetidos: ${erros}`); listarFuncionarios(); event.target.value = ''; btnUpload.innerText = "📤 2. Fazer Upload do Ficheiro Preenchido"; btnUpload.disabled = false; }; reader.readAsText(file); }

async function listarFuncionarios() {
    const res = await fetch(`/api/funcionarios/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } }); 
    dadosFuncionarios = await res.json(); 
    const tbody = document.getElementById('tabelaFuncionarios'); tbody.innerHTML = ''; 
    if (Array.isArray(dadosFuncionarios)) dadosFuncionarios.forEach(f => {
        let corStatus = f.status === 'ativo' ? 'color: var(--success-color);' : 'color: var(--danger-color);'; 
        let txtStatus = f.status === 'ativo' ? 'ATIVO' : 'INATIVO'; 
        let btnStatus = f.status === 'ativo' ? `<button class="btn-small" style="background:var(--warning-color); color:black;" onclick="mudarStatusFunc(${f.id}, 'inativo')" title="Suspender Acesso">🚫</button>` : `<button class="btn-small" style="background:var(--success-color); color:white;" onclick="mudarStatusFunc(${f.id}, 'ativo')" title="Reativar Acesso">✅</button>`;
        
        tbody.innerHTML += `<tr><td data-label="Nome">${sanitizarTexto(f.nome_completo)}</td><td data-label="NIF / Telefone"><b>NIF:</b> ${sanitizarTexto(f.nif) || 'Não def.'}<br><small>${sanitizarTexto(f.telemovel)}</small></td><td class="esconder-mobile" data-label="E-mail">${sanitizarTexto(f.email)}</td><td data-label="Estado" style="font-weight:bold; font-size:0.8rem; ${corStatus}">${txtStatus}</td><td data-label="Ações"><button class="btn-small btn-view" onclick="verFuncionario(${f.id})">👁</button><button class="btn-small btn-edit" onclick="editarFuncionario(${f.id})">✎</button>${btnStatus}<button class="btn-small btn-delete" onclick="apagarFuncionario(${f.id})">🗑</button></td></tr>`;
    });
}

async function mudarStatusFunc(id, novoStatus) { if (confirm(`Tem a certeza que deseja colocar este funcionário como ${novoStatus.toUpperCase()}?`)) { await fetch('/api/funcionarios/status', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ id: id, novo_status: novoStatus }) }); listarFuncionarios(); carregarDropdownsAgendamento(); } }

// 📍 MÓDULO ROTA PARALELA: VISUALIZAR FUNCIONÁRIO COMPACTO SEM SCROLL
async function verFuncionario(id) {
    const f = dadosFuncionarios.find(x => x.id === id);
    if (!f) return;
    const fArr = JSON.parse(f.funcoes_habilitadas || '[]');
    const fArrSani = fArr.map(x => sanitizarTexto(x));

    let dispHTML = '';
    try {
        if (f.disponibilidade) {
            const disp = JSON.parse(f.disponibilidade);
            const diasH = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
            const diasId = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
            const turnos = [
                { id: 'manha', label: '🌅 Manhã' },
                { id: 'tarde', label: '☀️ Tarde' },
                { id: 'noite', label: '🌙 Noite' },
                { id: 'madrugada', label: '🦉 Madrug.' }
            ];

            let tableHTML = `<div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
                <table style="width:100%; table-layout: fixed; border-collapse: collapse; text-align:center; font-size:0.7rem; line-height:1.2; margin:0;">
                    <thead>
                        <tr style="background-color: #f1f5f9;">
                            <th style="border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; padding: 4px 2px; text-align: left; width: 28%;">Turno</th>`;
            diasH.forEach(d => {
                tableHTML += `<th style="border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; padding: 4px 0; width: 10.2%; font-size:0.6rem;">${d}</th>`;
            });
            tableHTML += `</tr></thead><tbody>`;

            turnos.forEach((t, i) => {
                let borderBot = i === turnos.length - 1 ? '' : 'border-bottom: 1px solid #cbd5e1;';
                tableHTML += `<tr>
                    <td style="border-right: 1px solid #cbd5e1; ${borderBot} padding: 4px 2px; text-align: left; font-weight: bold; background: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size:0.7rem;" title="${t.label}">${t.label}</td>`;
                diasId.forEach(d => {
                    const tem = disp.includes(`${d}_${t.id}`);
                    tableHTML += `<td style="border-right: 1px solid #cbd5e1; ${borderBot} padding: 4px 0;">${tem ? '✅' : '<span style="color:#e2e8f0;">-</span>'}</td>`;
                });
                tableHTML += `</tr>`;
            });
            tableHTML += `</tbody></table></div>`;

            dispHTML = `
                <div>
                    <strong style="display:block; margin-bottom:4px; font-size:0.85rem;">⏱️ Matriz de Disponibilidade:</strong>
                    ${tableHTML}
                </div>`;
        }
    } catch (e) { }

    let htmlAss = '<div style="border-top:1px dashed #e2e8f0; padding-top:10px;"><strong style="font-size:0.85rem; display:block; margin-bottom:5px;">📥 Folhas Assinadas:</strong><div style="display:flex; gap:6px; flex-wrap:wrap;">';
    try {
        const res = await fetch(`/api/assinaturas/funcionario/${id}`, { headers: { 'Authorization': 'Bearer ' + token } });
        const assinaturas = await res.json();
        const concluidas = Array.isArray(assinaturas) ? assinaturas.filter(a => a.status === 'Assinado') : [];
        if (concluidas.length > 0) {
            concluidas.forEach(a => {
                htmlAss += `<button class="btn-small" style="background:var(--success-color); color:white; border:none; padding:4px 8px; border-radius:6px; font-size:0.75rem; cursor:pointer; margin:0;" onclick="irParaRelatorioAssinado(${id}, ${a.mes}, ${a.ano})">🖨️ ${String(a.mes).padStart(2, '0')} / ${a.ano}</button>`;
            });
        } else {
            htmlAss += '<small style="color:#64748b;">O trabalhador ainda não assinou nenhum mês.</small>';
        }
    } catch (e) { }
    htmlAss += '</div></div>';

    let gpsHTML = f.consentimento_gps ?
        `<div style="padding:8px 10px; background:#dcfce7; border:1px solid var(--success-color); border-radius:6px; font-size:0.8rem;">✅ GPS assinado: <b>${sanitizarTexto(f.consentimento_gps)}</b><div style="margin-top:6px; display:flex; gap:5px; flex-wrap:wrap;"><button class="btn-action" style="font-size:0.7rem; padding:4px 8px; background:#00468b; margin:0;" onclick="imprimirTermoGPS(${f.id}, 'pt')">🖨️ (PT)</button><button class="btn-action" style="font-size:0.7rem; padding:4px 8px; background:#0ea5e9; margin:0;" onclick="imprimirTermoGPS(${f.id}, 'en')">🖨️ (EN)</button><button class="btn-action" style="font-size:0.7rem; padding:4px 8px; background:#f59e0b; margin:0;" onclick="imprimirTermoGPS(${f.id}, 'es')">🖨️ (ES)</button></div></div>` :
        `<div style="padding:8px 10px; background:#fee2e2; border:1px solid var(--danger-color); border-radius:6px; font-size:0.8rem; color:#b91c1c;">⚠️ Não assinou o consentimento de GPS.</div>`;

    let detalhesGrid = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.8rem; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="min-width:0;"><strong style="color:#475569;">Nome:</strong><br><span style="color:#0f172a; font-weight:600; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sanitizarTexto(f.nome_completo)}</span></div>
            <div style="min-width:0;"><strong style="color:#475569;">Estado:</strong><br><span style="font-weight:bold; color:${f.status === 'ativo' ? '#166534' : '#b91c1c'}; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sanitizarTexto(f.status).toUpperCase()}</span></div>
            <div style="min-width:0;"><strong style="color:#475569;">NIF:</strong><br><span style="color:#0f172a; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sanitizarTexto(f.nif) || 'Não def.'}</span></div>
            <div style="min-width:0;"><strong style="color:#475569;">Telemóvel:</strong><br><span style="color:#0f172a; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sanitizarTexto(f.telemovel)}</span></div>
            <div style="grid-column: span 2; min-width:0;"><strong style="color:#475569;">E-mail:</strong><br><span style="color:#0f172a; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sanitizarTexto(f.email)}</span></div>
            <div style="grid-column: span 2; min-width:0;"><strong style="color:#475569;">Cidade:</strong><br><span style="color:#0f172a; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sanitizarTexto(f.cidade) || 'Não def.'}</span></div>
            <div style="grid-column: span 2; min-width:0;"><strong style="color:#475569;">Funções:</strong><br><span style="color:#0f172a; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${fArrSani.length > 0 ? fArrSani.join(', ') : 'Nenhuma'}</span></div>
        </div>
    `;

    abrirVerDetalhes("Ficha de Funcionário", `<div style="display:flex; flex-direction:column; gap:12px; overflow-x:hidden;">${detalhesGrid}${dispHTML}${gpsHTML}${htmlAss}</div>`);
}

// 📍 MÓDULO ROTA PARALELA: IMPRESSÃO BLINDADA VIA IFRAME OCULTO
window.irParaRelatorioAssinado = async function(funcId, mes, ano) {
    if (!window.imprimirFolhaACTGestor) {
        window.imprimirFolhaACTGestor = function() {
            var printDiv = document.getElementById('print-master-act');
            if (!printDiv) return;
            var iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.width = '0px';
            iframe.style.height = '0px';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);

            var doc = iframe.contentWindow.document;
            doc.open();
            doc.write('<html><head><title>Folha de Ponto ACT</title>');
            doc.write('<style>@page { size: A4 portrait; margin: 10mm; } body { font-family: sans-serif; color: #0f172a; } .no-print { display: none !important; } table { width: 100%; border-collapse: collapse; font-size: 11px; text-align: center; } th, td { border: 1px solid #cbd5e1; padding: 4px; } th { background: #1e293b; color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; } tfoot td { background: #e0f2fe; font-weight: bold; color: black; -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>');
            doc.write('</head><body>');
            doc.write(printDiv.innerHTML);
            doc.write('</body></html>');
            doc.close();

            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(function() { document.body.removeChild(iframe); }, 2000);
        };
    }

    document.getElementById('modalVer').style.display = 'none';
    var modalFolha = document.getElementById('modalFolhaPontoGestor');
    var areaPrint = document.getElementById('areaPrintFolhaGestor');

    if (!modalFolha || !areaPrint) return alert('Erro de Interface.');

    var btnTopPrint = document.querySelector('#modalFolhaPontoGestor button[title="Imprimir Folha"]');
    if (btnTopPrint) {
        btnTopPrint.onclick = function(e) {
            e.preventDefault();
            window.imprimirFolhaACTGestor();
        };
    }

    areaPrint.innerHTML = '<h3 style="text-align:center; padding: 40px; color:#64748b;">⏳ A processar folha de ponto...</h3>';
    modalFolha.style.display = 'flex';

    try {
        var resAssP = fetch('/api/assinaturas/agencia/' + agendaId, { headers: { 'Authorization': 'Bearer ' + token } });
        var resFP = fetch('/api/funcionarios/agencia/' + agendaId, { headers: { 'Authorization': 'Bearer ' + token } });
        
        var respostas = await Promise.all([resAssP, resFP]);
        var resAss = respostas[0];
        var resF = respostas[1];
        
        var assinaturas = await resAss.json();
        var funcs = await resF.json();
        
        var assArray = Array.isArray(assinaturas) ? assinaturas : [];
        var ass = null;
        for (var i = 0; i < assArray.length; i++) {
            if (assArray[i].funcionario_id == funcId && assArray[i].mes == mes && assArray[i].ano == ano && assArray[i].status === 'Assinado') {
                ass = assArray[i];
                break;
            }
        }
        
        if (!ass) {
            areaPrint.innerHTML = '<h3 style="text-align:center; padding: 40px; color:#ef4444;">❌ Folha assinada não encontrada.</h3>';
            return;
        }

        var funcsArray = Array.isArray(funcs) ? funcs : [];
        var funcionario = null;
        for (var j = 0; j < funcsArray.length; j++) {
            if (funcsArray[j].id == funcId) {
                funcionario = funcsArray[j];
                break;
            }
        }
        var nomeFunc = funcionario ? funcionario.nome_completo : 'Trabalhador Desconhecido';

        var resFolha = await fetch('/api/folha-ponto/trabalhador/' + funcId + '/' + ano + '/' + mes, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        var dadosFolha = await resFolha.json();
        
        var grupo = null;
        if (dadosFolha.agrupamentos && dadosFolha.agrupamentos.length > 0) {
            for (var k = 0; k < dadosFolha.agrupamentos.length; k++) {
                if (dadosFolha.agrupamentos[k].cliente_id == ass.cliente_id && dadosFolha.agrupamentos[k].unidade_id == ass.unidade_id) {
                    grupo = dadosFolha.agrupamentos[k];
                    break;
                }
            }
        }
        
        if (!grupo) {
            areaPrint.innerHTML = '<h3 style="text-align:center; padding: 40px; color:#ef4444;">❌ Dados não encontrados no motor ACT.</h3>';
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
            var detalheSani = sanitizarTexto(detalheFormatado);

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
                '<td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">' + detalheSani + '</td>' +
                '<td style="padding: 4px; text-align: center; color: #64748b; border: 1px solid #cbd5e1;">' + txtPausa + '</td>' +
                '<td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">' + formataHoras(d.horas_normais) + '</td>' +
                '<td style="padding: 4px; text-align: center; border: 1px solid #cbd5e1;">' + formataHoras(d.horas_noturnas) + '</td>' +
                '<td style="padding: 4px; text-align: center; color: #b45309; font-weight: bold; border: 1px solid #cbd5e1;">' + formataHoras(d.horas_extra) + '</td>' +
                '<td style="padding: 4px; text-align: center; font-weight: bold; color: #1e293b; border: 1px solid #cbd5e1;">' + formataHoras(d.efetivo_horas) + '</td>' +
            '</tr>';
        });

        var nifAgencia = sanitizarTexto(grupo.agencia_nif) || 'N/D';
        var nifUnidade = sanitizarTexto(grupo.unidade_nif) || 'N/D';
        var nomeAgenciaSani = typeof agendaNome !== 'undefined' ? sanitizarTexto(agendaNome) : 'N/D';
        var empresaSani = sanitizarTexto(grupo.empresa) || 'N/D';
        var unidadeSani = sanitizarTexto(grupo.unidade) || 'N/D';
        var funcaoSani = sanitizarTexto(grupo.funcao) || 'N/D';
        var nomeFuncSani = sanitizarTexto(nomeFunc);
        
        var mesStr = String(mes);
        if (mesStr.length < 2) mesStr = '0' + mesStr;
        
        var dataEmissao = new Date().toLocaleDateString('pt-PT');

        areaPrint.innerHTML = '<div class="no-print" style="margin-bottom: 15px; text-align: right;">' +
                '<button class="btn-main" style="background: #0284c7; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;" onclick="window.imprimirFolhaACTGestor()">🖨️ Imprimir PDF Oficial</button>' +
            '</div>' +
            '<div id="print-master-act">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
                '<img src="/logo_agenda_360.jpeg" style="max-height: 60px; width: auto;" alt="Logo" onerror="this.style.display=\'none\'">' +
                '<span style="font-size: 12px; font-weight: bold;">Emitido em: ' + dataEmissao + '</span>' +
            '</div>' +
            '<div style="border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 15px; font-size: 11px; background: #f8fafc; color: #0f172a; width: 100%;">' +
                '<div style="background: #f1f5f9; padding: 6px 10px; font-weight: bold; color: #1e293b; border-bottom: 1px solid #cbd5e1; font-size: 12px;">' +
                    '🏛️ Registo de Tempos de Trabalho (Folha Mensal ACT)' +
                '</div>' +
                '<div style="padding: 6px 10px; border-bottom: 1px solid #cbd5e1;">' +
                    '<div style="color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: bold;">Entidade Empregadora (Agência)</div>' +
                    '<div><strong>Nome:</strong> ' + nomeAgenciaSani + ' | <strong>NIF:</strong> ' + nifAgencia + '</div>' +
                '</div>' +
                '<div style="padding: 6px 10px; border-bottom: 1px solid #cbd5e1;">' +
                    '<div style="color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: bold;">Local de Trabalho (Cliente / Unidade)</div>' +
                    '<div><strong>Nome:</strong> ' + empresaSani + ' - ' + unidadeSani + ' | <strong>NIF:</strong> ' + nifUnidade + '</div>' +
                '</div>' +
                '<div style="padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">' +
                    '<div>' +
                        '<div style="color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: bold;">Dados do Trabalhador</div>' +
                        '<div><strong>Nome:</strong> ' + nomeFuncSani + ' | <strong>Função:</strong> ' + funcaoSani + '</div>' +
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
            '<div style="background: #f0fdf4; border: 1px solid #10b981; border-radius: 6px; padding: 10px; margin-top: 15px; text-align: center; page-break-inside: avoid;">' +
                '<h3 style="font-size: 11px; color: #15803d; margin: 0 0 4px 0;">✅ DECLARAÇÃO DE TEMPOS DE TRABALHO ASSINADA DIGITALMENTE</h3>' +
                '<p style="margin: 0; font-size: 12px; font-weight: bold; color: #0f172a;">' + sanitizarTexto(ass.carimbo_digital) + '</p>' +
                '<p style="margin: 4px 0 0 0; font-size: 9px; color: #64748b;">(Carimbo Criptográfico Inviolável)</p>' +
            '</div>' +
            '</div>';

    } catch (e) {
        console.error(e);
        areaPrint.innerHTML = '<h3 style="text-align:center; padding: 40px; color:#ef4444;">❌ Erro ao processar folha de ponto.</h3>';
    }
};

function editarFuncionario(id) {
    const f = dadosFuncionarios.find(x => x.id === id);
    if (!f) return;

    if (document.getElementById('uCodPostal')) document.getElementById('uCodPostal').value = '';

    document.getElementById('fIdEdit').value = f.id;
    document.getElementById('fNome').value = f.nome_completo;
    document.getElementById('fEmail').value = f.email;
    document.getElementById('fTel').value = f.telemovel;
    document.getElementById('fNif').value = f.nif || '';
    document.getElementById('fNac').value = f.nacionalidade || '';
    document.getElementById('fIdiomas').value = f.idiomas || '';

    // 📍 BLINDAGEM: Reseta o cadeado de segurança ao editar
    document.getElementById('fSenha').value = '';
    if (document.getElementById('toggleEditaSenhaFunc')) {
        document.getElementById('toggleEditaSenhaFunc').checked = false;
        document.getElementById('boxSenhaFunc').style.display = 'none';
    }

    if (document.getElementById('fCidade')) document.getElementById('fCidade').value = f.cidade || '';

    renderizarFuncoesCheckboxes(JSON.parse(f.funcoes_habilitadas || '[]'));

    const checkboxesDisp = document.querySelectorAll('#matrizDisponibilidade input[type="checkbox"]');
    try {
        if (f.disponibilidade) {
            const matrizAtiva = JSON.parse(f.disponibilidade);
            checkboxesDisp.forEach(cb => cb.checked = matrizAtiva.includes(cb.value));
        } else {
            checkboxesDisp.forEach(cb => cb.checked = true);
        }
    } catch (e) { checkboxesDisp.forEach(cb => cb.checked = true); }

    document.getElementById('btnSalvarFunc').innerText = 'Atualizar Ficha';
    document.getElementById('btnCancelarFunc').style.display = 'inline-block';
    document.getElementById('fNome').focus();
    destacarFormulario('formFuncionario');
}

function cancelarEdicaoFunc() {
    removerDestaqueFormulario();
    document.getElementById('formFuncionario').reset();
    document.getElementById('fIdEdit').value = '';

    // 📍 BLINDAGEM: Reseta o cadeado ao cancelar
    if (document.getElementById('toggleEditaSenhaFunc')) {
        document.getElementById('toggleEditaSenhaFunc').checked = false;
        document.getElementById('boxSenhaFunc').style.display = 'none';
        removerDestaqueFormulario();
    }

    document.getElementById('btnSalvarFunc').innerText = 'Guardar Ficha';
    document.getElementById('btnCancelarFunc').style.display = 'none';
    renderizarFuncoesCheckboxes();

    const checkboxesDisp = document.querySelectorAll('#matrizDisponibilidade input[type="checkbox"]');
    checkboxesDisp.forEach(cb => cb.checked = true);
}

// 📍 BLINDAGEM: Motor que respeita os novos cadeados do Trabalhador
document.getElementById('formFuncionario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idEdit = document.getElementById('fIdEdit').value;
    const senhaRaw = document.getElementById('fSenha').value;
    const nifRaw = document.getElementById('fNif').value;

    const senhaLimpa = senhaRaw.trim();
    // Remove espaços a mais do NIF por segurança para garantir que o login não falhe
    const nifLimpo = nifRaw.trim().replace(/\s+/g, ''); 

    if (!idEdit && !senhaLimpa && !nifLimpo) return alert('É obrigatório definir o NIF ou uma Senha provisória inicial.');
    if (senhaLimpa && senhaLimpa.length < 6) return alert('A senha do trabalhador deve ter no mínimo 6 caracteres ou dígitos.');

    const checkedFuncoes = document.querySelectorAll('#containerFuncoesFunc input[type="checkbox"]:checked');
    const checkedDisponibilidade = document.querySelectorAll('#matrizDisponibilidade input[type="checkbox"]:checked');
    const dispValores = Array.from(checkedDisponibilidade).map(c => c.value);
    const cidadeVal = document.getElementById('fCidade') ? document.getElementById('fCidade').value.trim() : '';

    const dados = {
        agencia_id: agendaId,
        nome_completo: document.getElementById('fNome').value.trim(),
        email: document.getElementById('fEmail').value.trim(),
        telemovel: document.getElementById('fTel').value.trim(),
        nif: nifLimpo,
        nacionalidade: document.getElementById('fNac').value.trim(),
        idiomas: document.getElementById('fIdiomas').value.trim(),
        cidade: cidadeVal,
        senha: senhaLimpa,
        funcoes_habilitadas: Array.from(checkedFuncoes).map(c => c.value),
        disponibilidade: dispValores
    };

    const toggleFunc = document.getElementById('toggleEditaSenhaFunc');
    if (idEdit) {
        // Se está a editar e o cadeado estiver desligado (ou senha vazia), apaga a senha do pacote
        if ((toggleFunc && !toggleFunc.checked) || !dados.senha) {
            delete dados.senha;
        }
    } else {
        // Se está a criar novo e a caixa ficou vazia ou o cadeado desligado, força a senha a ser o NIF exato
        if (!dados.senha || (toggleFunc && !toggleFunc.checked)) {
            dados.senha = nifLimpo;
        }
    }

    const res = await fetch(idEdit ? `/api/funcionarios/${idEdit}` : '/api/funcionarios', { method: idEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(dados) });
    const data = await res.json();
    if (res.ok) {
        alert(data.message || data.mensagem || 'Guardado com sucesso!');
        cancelarEdicaoFunc();
        listarFuncionarios();
        carregarDropdownsAgendamento();
    } else {
        alert(data.erro || 'Erro ao guardar a ficha.');
    }
});

async function apagarFuncionario(id) { if (confirm("CUIDADO: Deseja APAGAR definitivamente este registo do sistema?")) { try { const res = await fetch(`/api/funcionarios/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }); const d = await res.json(); if (res.ok) { alert(d.mensagem); listarFuncionarios(); carregarDropdownsAgendamento(); } else { alert(d.erro); } } catch (err) { alert("Erro ao comunicar com o servidor."); } } }

async function listarClientes() {
    try {
        const res = await fetch(`/api/clientes/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } }); dadosClientes = await res.json(); const tbody = document.getElementById('tabelaGrupos'); if (tbody) {
            tbody.innerHTML = ''; if (Array.isArray(dadosClientes)) dadosClientes.forEach(c => {
                tbody.innerHTML += `<tr><td data-label="Grupo / Empresa"><b>${sanitizarTexto(c.nome_empresa)}</b></td><td data-label="NIF">${sanitizarTexto(c.nif) || '-'}</td><td data-label="Responsável">${sanitizarTexto(c.nome_responsavel) || '-'}<br><small style="color:var(--primary-color)">${sanitizarTexto(c.telefone) || ''} | ${sanitizarTexto(c.email) || ''}</small></td><td data-label="Ações"><button class="btn-small btn-edit" onclick="editarGrupo(${c.id})">✎</button><button class="btn-small btn-delete" onclick="apagarGrupo(${c.id})">🗑</button></td></tr>`;
            });
        } const sel = document.getElementById('uGrupoSelect'); if (sel) { sel.innerHTML = '<option value="">-- Escolha primeiro o Grupo --</option>'; if (Array.isArray(dadosClientes)) dadosClientes.forEach(c => { sel.innerHTML += `<option value="${c.id}">🏢 ${sanitizarTexto(c.nome_empresa)}</option>`; }); }
    } catch (e) { console.error("Erro ao listar grupos:", e); }
}
document.getElementById('formGrupo')?.addEventListener('submit', async (e) => { e.preventDefault(); const idEdit = document.getElementById('gIdEdit').value; const payload = { agencia_id: agendaId, nome_empresa: document.getElementById('gNomeG').value, nif: document.getElementById('gNif').value, nome_responsavel: document.getElementById('gRespNome').value, telefone: document.getElementById('gRespTel').value, email: document.getElementById('gRespEmail').value, observacoes: document.getElementById('gObs').value }; const method = idEdit ? 'PUT' : 'POST'; const url = idEdit ? `/api/clientes/${idEdit}` : '/api/clientes'; const btn = document.getElementById('btnSalvarGrupo'); btn.innerText = "A gravar..."; btn.disabled = true; try { const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(payload) }); if (res.ok) { alert('Grupo / Sede guardado com sucesso!'); cancelarEdicaoGrupo(); listarClientes(); } else { const d = await res.json(); alert(d.erro); } } catch (err) { alert('Erro de servidor ao gravar Grupo.'); } btn.innerText = idEdit ? "Atualizar Grupo" : "Gravar Grupo"; btn.disabled = false; });
function editarGrupo(id) { const g = dadosClientes.find(x => x.id === id); if (!g) return; document.getElementById('gIdEdit').value = g.id; document.getElementById('gNomeG').value = g.nome_empresa || ''; document.getElementById('gNif').value = g.nif || ''; document.getElementById('gRespNome').value = g.nome_responsavel || ''; document.getElementById('gRespTel').value = g.telefone || ''; document.getElementById('gRespEmail').value = g.email || ''; document.getElementById('gObs').value = g.observacoes || ''; document.getElementById('btnSalvarGrupo').innerText = 'Atualizar Grupo'; document.getElementById('btnCancelarGrupo').style.display = 'inline-block'; document.getElementById('gNomeG').focus(); destacarFormulario('formGrupo'); }
function cancelarEdicaoGrupo() {
    removerDestaqueFormulario(); document.getElementById('formGrupo').reset(); document.getElementById('gIdEdit').value = ''; document.getElementById('btnSalvarGrupo').innerText = 'Gravar Grupo'; document.getElementById('btnCancelarGrupo').style.display = 'none'; removerDestaqueFormulario();
}
async function apagarGrupo(id) { if (confirm("ATENÇÃO: Ao apagar o Grupo vai aniquilar TODAS as Unidades (Hotéis) que pertencem a ele.\nTem a certeza absoluta?")) { try { const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }); if (res.ok) { listarClientes(); listarUnidades(); } } catch (e) { } } }

async function listarUnidades() {
    try {
        const res = await fetch(`/api/unidades/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } }); dadosUnidades = await res.json(); const tbody = document.getElementById('tabelaUnidades'); tbody.innerHTML = ''; if (Array.isArray(dadosUnidades)) dadosUnidades.forEach(u => {
            tbody.innerHTML += `<tr><td data-label="Grupo Pai"><b>${sanitizarTexto(u.nome_empresa)}</b></td><td data-label="Unidade / Hotel">${sanitizarTexto(u.nome_unidade)}</td><td class="esconder-mobile" data-label="Cidade">${sanitizarTexto(u.cidade)}</td><td data-label="Ações"><button class="btn-small btn-view" onclick="verUnidade(${u.id})">👁</button><button class="btn-small btn-edit" onclick="editarUnidade(${u.id})">✎</button><button class="btn-small btn-delete" onclick="apagarUnidade(${u.id})">🗑</button></td></tr>`;
        });
    } catch (e) { }
}

function verUnidade(id) { const u = dadosUnidades.find(x => x.id === id); if (!u) return; abrirVerDetalhes("Detalhes da Unidade", `<div class="detalhe-linha"><strong>Unidade:</strong> ${sanitizarTexto(u.nome_unidade)}</div><div class="detalhe-linha"><strong>Morada:</strong> ${sanitizarTexto(u.rua) || '-'}, ${sanitizarTexto(u.cidade) || '-'}</div><div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px dashed var(--action-color); margin-top:15px;"><h4 style="margin:0 0 10px 0; color:var(--primary-color);">👨‍💼 Gestor / Contacto Local</h4><div class="detalhe-linha" style="border:none; margin:0; padding:2px 0;"><strong>Nome:</strong> ${sanitizarTexto(u.contato_nome) || 'Não definido'}</div><div class="detalhe-linha" style="border:none; margin:0; padding:2px 0;"><strong>Telefone:</strong> ${sanitizarTexto(u.telefone) || 'N/A'}</div><div class="detalhe-linha" style="border:none; margin:0; padding:2px 0;"><strong>E-mail:</strong> ${sanitizarTexto(u.email) || 'N/A'}</div></div>`); }

function toggleValidacao() {
    const chk = document.getElementById('uExigeValidacao').checked;
    const wrapper = document.getElementById('uExigeValidacao').closest('.toggle-wrapper');
    if (wrapper) { if (chk) wrapper.classList.add('active'); else wrapper.classList.remove('active'); }
}

document.getElementById('formUnidade')?.addEventListener('submit', async (e) => { e.preventDefault(); const idEdit = document.getElementById('uIdEdit').value; const cliente_id = document.getElementById('uGrupoSelect').value; if (!cliente_id) return alert("❌ Tem obrigatoriamente de escolher a qual Grupo pertence esta Unidade!"); const checkedU = document.querySelectorAll('.containerFuncoesUnid input[type="checkbox"]:checked'); const payload = { cliente_id: cliente_id, nome_unidade: document.getElementById('uNome').value, contato_nome: document.getElementById('uContato').value, telefone: document.getElementById('uTel').value, email: document.getElementById('uEmail').value, rua: document.getElementById('uRua').value, cidade: document.getElementById('uCidade').value, latitude: document.getElementById('uLat').value, longitude: document.getElementById('uLng').value, exige_validacao: document.getElementById('uExigeValidacao').checked, funcoes_frequentes: Array.from(checkedU).map(c => c.value) }; const method = idEdit ? 'PUT' : 'POST'; const url = idEdit ? `/api/unidades/${idEdit}` : '/api/unidades'; const btn = document.getElementById('btnSalvarUnidade'); btn.innerText = "A gravar..."; btn.disabled = true; try { const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(payload) }); if (res.ok) { alert('Unidade / Hotel guardado com sucesso!'); cancelarEdicaoUnidade(); listarUnidades(); carregarDropdownsAgendamento(); } else { const d = await res.json(); alert(d.erro); } } catch (err) { alert('Erro de servidor.'); } btn.innerText = idEdit ? "Atualizar Unidade" : "Gravar Unidade"; btn.disabled = false; });
function editarUnidade(id) { const u = dadosUnidades.find(x => x.id === id); if (!u) return; document.getElementById('uIdEdit').value = u.id; document.getElementById('uGrupoSelect').value = u.cliente_id; document.getElementById('uNome').value = u.nome_unidade || ''; document.getElementById('uContato').value = u.contato_nome || ''; document.getElementById('uTel').value = u.telefone || ''; document.getElementById('uEmail').value = u.email || ''; document.getElementById('uRua').value = u.rua || ''; document.getElementById('uCidade').value = u.cidade || ''; document.getElementById('uLat').value = u.latitude || ''; document.getElementById('uLng').value = u.longitude || ''; document.getElementById('uExigeValidacao').checked = (u.exige_validacao === 1); toggleValidacao(); if (document.getElementById('uCodPostal')) document.getElementById('uCodPostal').value = ''; const antigas = JSON.parse(u.funcoes_frequentes || '[]'); const checkboxes = document.querySelectorAll('.containerFuncoesUnid input[type="checkbox"]'); checkboxes.forEach(cb => cb.checked = antigas.includes(cb.value)); document.getElementById('btnSalvarUnidade').innerText = 'Atualizar Unidade'; document.getElementById('btnCancelarUnidade').style.display = 'inline-block'; document.getElementById('uNome').focus(); destacarFormulario('formUnidade'); }
function cancelarEdicaoUnidade() {
    removerDestaqueFormulario(); document.getElementById('formUnidade').reset(); document.getElementById('uIdEdit').value = ''; document.getElementById('uGrupoSelect').value = ''; document.getElementById('uExigeValidacao').checked = false; toggleValidacao(); if (document.getElementById('uCodPostal')) document.getElementById('uCodPostal').value = ''; renderizarFuncoesCheckboxes(); document.getElementById('btnSalvarUnidade').innerText = 'Gravar Unidade'; document.getElementById('btnCancelarUnidade').style.display = 'none'; removerDestaqueFormulario();
}
async function apagarUnidade(id) { if (confirm("Apagar unidade?")) { await fetch(`/api/unidades/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }); listarUnidades(); } }

// ==========================================
// GESTORES
// ==========================================
async function listarGestores() {
    try {
        const resU = await fetch(`/api/unidades/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } });
        const unids = await resU.json();
        const selU = document.querySelector('#formGestor #gUnidade');
        selU.innerHTML = '<option value="">-- Acesso Central (Ver abaixo) --</option>';
        if (Array.isArray(unids)) unids.forEach(u => selU.innerHTML += `<option value="${u.id}">${sanitizarTexto(u.nome_empresa)} - ${sanitizarTexto(u.nome_unidade)}</option>`);
        if (!document.getElementById('gNivelAcesso')) {
            const divNivel = document.createElement('div');
            divNivel.className = 'input-group';
            divNivel.innerHTML = `<label>Nível de Acesso Central:</label>
            <select id="gNivelAcesso" style="width:100%; padding:10px; border-radius:5px; border:1px solid #ccc; margin-bottom:10px;">
                <option value="CORPORATIVO">⭐ Gestor Master (Acesso Total)</option>
                <option value="OPERACIONAL">👔 Gestor Operacional (Restrito a Escalas)</option>
            </select><small style="color:#64748b;">(Se selecionar um Hotel acima, esta opção é ignorada e o gestor será Cliente Local).</small>`;
            selU.parentNode.insertBefore(divNivel, selU.nextSibling);
        }
        const res = await fetch(`/api/gestores/agencia/${agendaId}`, { headers: { 'Authorization': 'Bearer ' + token } });
        dadosGestores = await res.json();
        const tbody = document.getElementById('tabelaGestores'); tbody.innerHTML = '';
        if (Array.isArray(dadosGestores)) dadosGestores.forEach(g => {
            const txtU = g.nome_unidade ? `<span style="color:var(--primary-color);font-weight:bold;">🏢 Cliente (${sanitizarTexto(g.nome_unidade)})</span>` : (g.tipo_perfil === 'OPERACIONAL' ? '👔 Gestor Operacional' : '⭐ Gestor Master');
            let corStatus = g.status === 'ativo' ? 'color: var(--success-color);' : 'color: var(--danger-color);';
            let btnStatus = g.status === 'ativo' ? `<button class="btn-small" style="background:var(--warning-color); color:black;" onclick="mudarStatusGestor(${g.id}, 'inativo')" title="Suspender Acesso">🚫</button>` : `<button class="btn-small" style="background:var(--success-color); color:white;" onclick="mudarStatusGestor(${g.id}, 'ativo')" title="Reativar Acesso">✅</button>`;
            tbody.innerHTML += `<tr><td data-label="Nome e Acesso"><b>${sanitizarTexto(g.nome_gestor)}</b><br><small>${txtU}</small></td><td data-label="E-mail">${sanitizarTexto(g.email)}</td><td data-label="Estado" style="font-weight:bold; font-size:0.8rem; ${corStatus}">${sanitizarTexto(g.status).toUpperCase()}</td><td data-label="Ações"><button class="btn-small btn-edit" onclick="editarGestor(${g.id})">✎</button>${btnStatus}<button class="btn-small btn-delete" onclick="apagarGestor(${g.id})">🗑</button></td></tr>`;
        });
    } catch (e) { }
}
async function mudarStatusGestor(id, novoStatus) { if (confirm(`Colocar este gestor como ${novoStatus.toUpperCase()}?`)) { await fetch('/api/gestores/status', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ id: id, novo_status: novoStatus }) }); listarGestores(); } }

function editarGestor(id) {
    const g = dadosGestores.find(x => x.id === id); if (!g) return;
    document.getElementById('gIdEditGestor').value = g.id;
    document.getElementById('gNome').value = g.nome_gestor;
    document.getElementById('gEmail').value = g.email;

    // 📍 BLINDAGEM: Reseta o cadeado do Gestor
    document.getElementById('gSenha').value = '';
    if (document.getElementById('toggleEditaSenhaGestor')) {
        document.getElementById('toggleEditaSenhaGestor').checked = false;
        document.getElementById('boxSenhaGestor').style.display = 'none';
    }

    document.getElementById('gUnidade').value = g.unidade_id || '';
    const selNiv = document.getElementById('gNivelAcesso'); if (selNiv) selNiv.value = g.tipo_perfil === 'OPERACIONAL' ? 'OPERACIONAL' : 'CORPORATIVO';
    document.getElementById('btnSalvarGestor').innerText = 'Atualizar Acesso'; document.getElementById('btnCancelarGestor').style.display = 'inline-block';
    destacarFormulario('formGestor');
}

function cancelarEdicaoGestor() {
    removerDestaqueFormulario();
    document.getElementById('formGestor').reset();
    document.getElementById('gIdEditGestor').value = '';

    // 📍 BLINDAGEM: Reseta o cadeado do Gestor ao cancelar
    if (document.getElementById('toggleEditaSenhaGestor')) {
        document.getElementById('toggleEditaSenhaGestor').checked = false;
        document.getElementById('boxSenhaGestor').style.display = 'none';
        removerDestaqueFormulario();
    }

    document.getElementById('btnSalvarGestor').innerText = 'Criar Acesso'; document.getElementById('btnCancelarGestor').style.display = 'none';
}

// 📍 BLINDAGEM: Motor que respeita os novos cadeados do Gestor Local
document.getElementById('formGestor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idEdit = document.getElementById('gIdEditGestor').value;
    const senha = document.getElementById('gSenha').value.trim();
    if (senha && !/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(senha)) return alert('A senha não cumpre os requisitos! Mínimo de 8 caracteres, 1 Maiúscula e 1 Número.');
    const nivel = document.getElementById('gNivelAcesso') ? document.getElementById('gNivelAcesso').value : 'CORPORATIVO';

    const dados = {
        agencia_id: agendaId,
        nome_gestor: document.getElementById('gNome').value.trim(),
        email: document.getElementById('gEmail').value.trim(),
        senha: senha,
        unidade_id: document.getElementById('gUnidade').value,
        nivel_acesso: nivel
    };

    const toggleGestor = document.getElementById('toggleEditaSenhaGestor');
    if (idEdit) {
        // Se estiver a editar e o cadeado estiver desligado, apaga a senha do pacote
        if ((toggleGestor && !toggleGestor.checked) || !dados.senha) {
            delete dados.senha;
        }
    } else {
        // Se estiver a criar novo e a caixa estiver vazia, força a senha padrão
        if (!dados.senha || (toggleGestor && !toggleGestor.checked)) {
            dados.senha = 'Senha123!';
        }
    }

    try {
        const res = await fetch(idEdit ? `/api/gestores/${idEdit}` : '/api/gestores', { method: idEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(dados) });
        if (res.ok) {
            alert('Acesso Concluído!');
            cancelarEdicaoGestor();
            listarGestores();
        } else {
            const d = await res.json(); alert(d.erro);
        }
    } catch (err) { alert("Erro de servidor."); }
});

async function apagarGestor(id) { if (confirm("Deseja APAGAR definitivamente este registo?")) { await fetch(`/api/gestores/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }); listarGestores(); } }