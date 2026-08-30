// --- Modal Utilities ---
window.abrirModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
};
window.fecharModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
};
// -----------------------

// --- HELPERS EDICAO SEGURA ---
let formAtivoEdicao = null;
function destacarFormulario(formContainerId) {
    const container = document.getElementById(formContainerId);
    if (!container) return;

    // Mostra o overlay
    const overlay = document.getElementById('overlayEdicaoSegura');
    if (overlay) overlay.style.display = 'block';

    // Adiciona classe CSS
    container.classList.add('modo-edicao-destaque');
    formAtivoEdicao = formContainerId;
}

function removerDestaqueFormulario() {
    if (!formAtivoEdicao) return;
    const container = document.getElementById(formAtivoEdicao);
    if (container) {
        container.classList.remove('modo-edicao-destaque');
    }

    // Esconde o overlay
    const overlay = document.getElementById('overlayEdicaoSegura');
    if (overlay) overlay.style.display = 'none';
    formAtivoEdicao = null;
}
// -----------------------------

console.log("🚀 Motor Agenda360 Inicializado e Blindado!");

// 🛡️ MOTOR ANTI-XSS: Sanitização Global para evitar injeção de scripts
window.sanitizarTexto = function(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

// 🛡️ MIGRAÇÃO DE SEGURANÇA: Move chaves do LocalStorage (Persistente) para SessionStorage (Volátil)
const chavesSeguranca = ['agenda360_agencia_id', 'agenda360_agencia_nome', 'agenda360_tipo_acesso', 'agenda360_unidade_id', 'agenda360_token'];
chavesSeguranca.forEach(chave => {
    const valorLocal = localStorage.getItem(chave);
    if (valorLocal) {
        sessionStorage.setItem(chave, valorLocal);
        localStorage.removeItem(chave); // Destrói o rasto no armazenamento exposto
    }
});

const agendaId = sessionStorage.getItem('agenda360_agencia_id');
const agendaNome = sessionStorage.getItem('agenda360_agencia_nome');
const tipoAcesso = sessionStorage.getItem('agenda360_tipo_acesso');
const gestorUnidadeId = sessionStorage.getItem('agenda360_unidade_id');
const token = sessionStorage.getItem('agenda360_token');

window.whatsappAtivo = true;
window.perfilGestor = 'CORPORATIVO'; // Master por defeito

let dadosClientes = []; let dadosFuncionarios = []; let dadosUnidades = []; let dadosEscalas = []; let dadosGestores = []; let dadosRelatorios = []; let dadosAssinaturas = []; let dadosSolicitacoes = [];
let magicSolId = null; let magicQtd = 0; let magicAlocados = 0;
window.abaAtivaSolicitacoes = 'pendentes';
window.abaAtivaEscalas = 'pendentes'; // 📍 Nova variável global de Aba para Escalas

if (tipoAcesso === 'restrito_gestor') {
    document.getElementById('screenForcedPassword').style.display = 'flex';
    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.topbar').style.display = 'none';
    document.querySelector('.main-content').style.overflow = 'hidden';
} else if (!agendaId || !token) {
    window.location.href = '/';
} else if (!tipoAcesso) {
    alert("⚠️ Atualização de Segurança Requerida!\nPor favor, atualize a página, faça login novamente.");
    sessionStorage.clear(); localStorage.clear(); window.location.href = '/';
} else {
    const elNomeTop = document.getElementById('nome-agencia-topbar');

    fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(res => res.json())
        .then(data => {
            window.whatsappAtivo = (data.ofertas_whatsapp !== 0);
            window.perfilGestor = data.perfil || 'CORPORATIVO';

            // 📍 LER O NÍVEL DE GPS ATUAL DA AGÊNCIA PARA O DROPDOWN
            const gpsSelect = document.getElementById('gpsAgenciaSelect');
            if (gpsSelect && data.gps_nivel) {
                gpsSelect.value = data.gps_nivel;
            }

            if (window.perfilGestor === 'OPERACIONAL') {
                const menuAcesso = document.getElementById('menuAcessos');
                if (menuAcesso) menuAcesso.style.display = 'none';
            }

            if (elNomeTop) {
                let nomeSanitizado = sanitizarTexto(data.nome);
                let htmlNome = `${sanitizarTexto(agendaNome) || 'Empresa'} <span style="font-weight:normal; color:#64748b; margin-left:10px;">| 👤 Olá, <b style="color:var(--primary-color);">${nomeSanitizado}</b></span>`;

                if (tipoAcesso === 'admin' && window.perfilGestor !== 'OPERACIONAL') {
                    const btnColor = window.whatsappAtivo ? '#25D366' : '#64748b';
                    const btnText = window.whatsappAtivo ? '💬 WA Ligado' : '💬 WA Desligado';
                    htmlNome += `<button onclick="toggleWhatsAppMaster()" style="margin-left:20px; background:${btnColor}; color:white; border:none; padding:4px 10px; border-radius:15px; cursor:pointer; font-size:0.8rem; vertical-align: middle; transition: 0.3s;" title="Ligar/Desligar Botão WhatsApp para toda a equipa">${btnText}</button>`;
                }
                elNomeTop.innerHTML = htmlNome;
            }
        }).catch(e => console.error(e));

    const elNomePrint = document.getElementById('printNomeAgencia'); if (elNomePrint) elNomePrint.innerText = agendaNome || 'Empresa Gestora';
    const elDataPrint = document.getElementById('printDataEmissao'); if (elDataPrint) { const dA = new Date(); elDataPrint.innerText = dA.toLocaleDateString('pt-PT') + ' às ' + dA.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }); }

    if (tipoAcesso === 'gestor') {
        document.getElementById('menuFunc').style.display = 'none';
        document.getElementById('menuEmpresas').style.display = 'none';
        document.getElementById('menuAcessos').style.display = 'none';
        if (document.getElementById('cardAssinaturas')) document.getElementById('cardAssinaturas').style.display = 'none';
        if (document.getElementById('boxNovoPedidoCliente_btn')) document.getElementById('boxNovoPedidoCliente_btn').style.display = 'block';
        if (document.getElementById('cardLinkApp')) document.getElementById('cardLinkApp').style.display = 'none';

        document.getElementById('containerCalFunc').style.display = 'none';
        document.getElementById('containerCalUnidade').style.display = 'none';
        document.getElementById('tituloAppMaster').innerText = "Portal do Cliente 🏢";

        const menuEscalasL = document.querySelector('#menuEscalas a');
        if (menuEscalasL) menuEscalasL.innerHTML = '✅ Validação de Turnos';
        const cardEscala = document.getElementById('formEscala');
        if (cardEscala && cardEscala.parentElement) cardEscala.parentElement.style.display = 'none';

        setTimeout(() => navegar('dashboard', document.querySelector('#menuDashboard a')), 100);
    } else {
        setTimeout(() => {
            let menuAtivo = document.querySelector('.nav-links a.active');
            if (!menuAtivo) menuAtivo = document.querySelector('#menuDashboard a') || document.querySelector('.nav-links a');
            navegar('dashboard', menuAtivo);
        }, 100);
    }
}

window.toggleWhatsAppMaster = async function () {
    if (confirm("Deseja ligar/desligar o botão de Ofertas WhatsApp para TODOS os gestores da sua agência?")) {
        try {
            const res = await fetch('/api/agencias/toggle-whatsapp', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
            const d = await res.json();
            if (res.ok) { alert(d.mensagem); window.location.reload(); } else { alert(d.erro); }
        } catch (e) { alert("Erro ao comunicar com o servidor."); }
    }
};

window.gravarNivelGPS = async function () {
    const nivel = document.getElementById('gpsAgenciaSelect').value;
    try {
        const res = await fetch('/api/agencias/mudar-gps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ gps_nivel: nivel })
        });
        const d = await res.json();
        alert(d.mensagem || d.erro);
    } catch (e) { alert("Erro de comunicação com servidor."); }
};

document.getElementById('formForcedPassword')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const s1 = document.getElementById('forceNovaSenha1').value;
    const s2 = document.getElementById('forceNovaSenha2').value;
    if (s1 !== s2) return alert('As senhas não coincidem!');

    const btn = e.target.querySelector('button'); btn.innerText = "A gravar..."; btn.disabled = true;
    try {
        const res = await fetch('/api/gestores/mudar-senha-pessoal', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token_restrito: token, nova_senha: s1 })
        });
        if (res.ok) {
            alert('✅ Senha Pessoal guardada com sucesso!\n\nPor favor, faça o Login novamente com a sua nova senha para entrar no sistema.');
            fazerLogout();
        } else {
            const d = await res.json(); alert(d.erro);
        }
    } catch (err) { alert('Erro no servidor'); }
    btn.innerText = "Gravar e Aceder ao Sistema"; btn.disabled = false;
});

function formatarMinutosParaHHMM(minutosTotais) {
    if (isNaN(minutosTotais) || minutosTotais <= 0) return "00:00 h";
    const h = Math.floor(minutosTotais / 60);
    const m = Math.round(minutosTotais % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} h`;
}

function togglePassword(inputId, btn) { const input = document.getElementById(inputId); if (input.type === 'password') { input.type = 'text'; btn.innerText = '🙈'; } else { input.type = 'password'; btn.innerText = '👁️'; } }
function abrirSidebar() { document.getElementById('sidebar').classList.add('open'); document.getElementById('mobileOverlay').classList.add('active'); }
function fecharSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('mobileOverlay').classList.remove('active'); }

function navegar(idSecao, elementoMenu) {
    try {
        document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-links a').forEach(el => el.classList.remove('active'));
        const secao = document.getElementById(idSecao); if (secao) secao.classList.add('active');
        if (elementoMenu) elementoMenu.classList.add('active');
        if (window.innerWidth <= 768) { fecharSidebar(); }

        if (idSecao === 'dashboard') { carregarSelectsCalendario(); verificarAlertasDashboard(); }
        if (idSecao === 'solicitacoes') { carregarDropdownsSolicitacoes(); listarSolicitacoes(); }
        if (idSecao === 'funcionarios') { renderizarFuncoesCheckboxes(); listarFuncionarios(); }
        if (idSecao === 'empresas') { renderizarFuncoesCheckboxes(); listarClientes(); listarUnidades(); }
        if (idSecao === 'escalas') { carregarDropdownsAgendamento(); listarEscalas(); }
        if (idSecao === 'acessos') listarGestores();
        if (idSecao === 'relatorios') carregarDropdownsRelatorios();
    } catch (err) { console.error(err); }
}

async function fazerLogout() { 
    const tkn = sessionStorage.getItem('agenda360_token'); 
    if (tkn) { 
        try { await fetch('/api/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + tkn } }); } catch (e) { } 
    } 
    sessionStorage.clear(); localStorage.clear(); window.location.href = '/'; 
}

function copiarLinkApp() { navigator.clipboard.writeText(window.location.origin + '/app-extra.html'); document.getElementById('msgCopia').style.display = 'block'; setTimeout(() => document.getElementById('msgCopia').style.display = 'none', 3000); }
function abrirVerDetalhes(titulo, htmlConteudo) { document.getElementById('modalVerTitulo').innerText = titulo; document.getElementById('modalVerConteudo').innerHTML = htmlConteudo; document.getElementById('modalVer').style.display = 'flex'; }
function capturarCoordenadasGPS(btn) { if (navigator.geolocation) { btn.innerText = "A procurar satélite..."; navigator.geolocation.getCurrentPosition(pos => { document.getElementById('uLat').value = pos.coords.latitude.toFixed(6); document.getElementById('uLng').value = pos.coords.longitude.toFixed(6); btn.innerText = "📍 GPS Capturado!"; }, err => { alert("Não foi possível aceder ao GPS."); btn.innerText = "📍 Buscar GPS"; }); } else { alert("Navegador não suporta GPS."); } }

async function buscarGPSporMorada(btn) {
    const rua = document.getElementById('uRua').value.trim();
    const cp = document.getElementById('uCodPostal') ? document.getElementById('uCodPostal').value.trim() : '';
    const cidade = document.getElementById('uCidade').value.trim();

    if (!rua || !cidade) return alert("Preencha pelo menos a Rua e a Cidade para buscar o GPS no satélite.");

    const textoBusca = `${rua}, ${cp}, ${cidade}, Portugal`;

    btn.innerText = "A procurar satélite...";
    btn.disabled = true;

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(textoBusca)}`);
        const data = await res.json();

        if (data && data.length > 0) {
            document.getElementById('uLat').value = parseFloat(data[0].lat).toFixed(6);
            document.getElementById('uLng').value = parseFloat(data[0].lon).toFixed(6);
            btn.innerText = "✅ GPS Encontrado!";
            setTimeout(() => { btn.innerText = "🔍 Buscar GPS por Morada"; btn.disabled = false; }, 3000);
        } else {
            alert("Morada não encontrada no satélite. Verifique se tem o código postal ou a rua corretos.");
            btn.innerText = "🔍 Buscar GPS por Morada"; btn.disabled = false;
        }
    } catch (e) {
        alert("Erro ao comunicar com o satélite de mapas.");
        btn.innerText = "🔍 Buscar GPS por Morada"; btn.disabled = false;
    }
}