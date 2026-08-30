document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('logEmail').value.trim();
    const senha = document.getElementById('logSenha').value;
    const errBox = document.getElementById('errLogin');
    const btn = document.getElementById('btnLog');
    
    btn.innerText = "..."; btn.disabled = true; errBox.style.display = 'none';

    try {
        const res = await fetch('/api/funcionarios/login', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, senha })
        });
        const data = await res.json();

        if (res.ok) {
            tempEmail = email; tempSenhaAtual = senha;
            if (data.require_password_change) { mostrarTela('screenNovaSenha'); } 
            else if (data.require_profile_selection) { renderizarPerfis(data.perfis); mostrarTela('screenPerfis'); } 
            else { concluirLogin(data.token, data.funcionario_id, data.nome, data.nome_agencia); }
        } else { errBox.innerText = data.erro || "Acesso negado."; errBox.style.display = 'block'; }
    } catch (err) { errBox.innerText = "Erro ao contactar servidor."; errBox.style.display = 'block'; }
    btn.innerText = dic[curLang]['btn_enter']; btn.disabled = false;
});

document.getElementById('formNovaSenha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const s1 = document.getElementById('novaSenha1').value;
    const s2 = document.getElementById('novaSenha2').value;
    const errBox = document.getElementById('errSenha');
    if (s1 !== s2) { errBox.innerText = "Error: Mismatch"; errBox.style.display = 'block'; return; }
    
    try {
        const res = await fetch('/api/funcionarios/mudar-senha-pessoal', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: tempEmail, senha_atual: tempSenhaAtual, nova_senha: s1 })
        });
        if (res.ok) { alert('✅ OK!'); window.location.reload(); } 
        else { const d = await res.json(); errBox.innerText = d.erro; errBox.style.display = 'block'; }
    } catch (err) { errBox.innerText = "Erro."; errBox.style.display = 'block'; }
});

function renderizarPerfis(perfis) {
    const container = document.getElementById('listaPerfis'); container.innerHTML = '';
    perfis.forEach(p => { container.innerHTML += `<button class="btn-profile" onclick="escolherPerfil(${p.id})">🏢 ${p.agencia} <span>➔</span></button>`; });
}

async function escolherPerfil(idFuncionario) {
    try {
        const res = await fetch('/api/funcionarios/selecionar-perfil', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: tempEmail, senha_atual: tempSenhaAtual, funcionario_id: idFuncionario })
        });
        const data = await res.json();
        if (res.ok) { concluirLogin(data.token, data.funcionario_id, data.nome, data.nome_agencia); }
    } catch (err) {}
}

function concluirLogin(token, id, nome, agencia) {
    localStorage.setItem('agenda360_func_token', token);
    localStorage.setItem('agenda360_func_id', id);
    localStorage.setItem('agenda360_func_nome', nome);
    localStorage.setItem('agenda360_func_agencia', agencia);
    
    const vagaIdUrl = new URLSearchParams(window.location.search).get('vaga');
    const loteIdsUrl = new URLSearchParams(window.location.search).get('lote'); 
    
    if (loteIdsUrl) {
        processarLoteMagico(loteIdsUrl);
    } else if (vagaIdUrl) {
        processarVagaMagica(vagaIdUrl);
    } else {
        aplicarNomesUI(); mostrarTela('screenDashboard'); carregarDadosServidor();
    }
}

function aplicarNomesUI() {
    const nomeGuardado = localStorage.getItem('agenda360_func_nome') || "Trabalhador";
    const agenciaGuardada = localStorage.getItem('agenda360_func_agencia') || "Agenda360";
    if(document.getElementById('lblNome')) document.getElementById('lblNome').innerText = nomeGuardado.split(' ')[0];
    if(document.getElementById('lblAgencia')) document.getElementById('lblAgencia').innerText = agenciaGuardada;
    
    const printTrabalhador = document.getElementById('printNomeTrabalhador');
    const printAgencia = document.getElementById('printNomeAgencia');
    if (printTrabalhador) printTrabalhador.innerText = nomeGuardado;
    if (printAgencia) printAgencia.innerText = agenciaGuardada;
}

async function fazerLogout() {
    const token = localStorage.getItem('agenda360_func_token');
    if (token) { try { await fetch('/api/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }); } catch(e) {} }
    localStorage.removeItem('agenda360_func_token'); 
    localStorage.removeItem('agenda360_func_id');
    localStorage.removeItem('agenda360_func_nome');
    localStorage.removeItem('agenda360_func_agencia');
    window.location.replace(window.location.pathname);
}