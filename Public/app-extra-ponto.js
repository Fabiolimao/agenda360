// ==========================================
// MÓDULO: REGISTO DE PONTO E GPS DA APP
// ==========================================

window.escAtivaId = null;
window.tipoAtivo = null;

// Ancoragem global para impedir que o HTML perca a função
window.abrirJanelaGPS = function(escalaId, tipo) {
    try {
        window.escAtivaId = parseInt(escalaId); 
        window.tipoAtivo = tipo;
        
        let gpsNivel = 2; // Padrão de segurança
        const storedNivel = localStorage.getItem('agenda360_gps_nivel');
        if (storedNivel !== null && storedNivel !== '') {
            gpsNivel = parseInt(storedNivel);
        }

        if (gpsNivel === 3) {
            window.executarPicagemManual('Ponto Validado (GPS Desativado pela Agência)');
            return;
        }

        const myId = localStorage.getItem('agenda360_func_id');
        const modalGPS = document.getElementById('modalGPS');
        const btnForcarManual = document.getElementById('btnForçarManual');

        if (btnForcarManual) {
            btnForcarManual.style.display = (gpsNivel === 1) ? 'none' : 'block';
        }

        if (localStorage.getItem('agenda360_gps_autorizado_' + myId) === 'sim') { 
            window.executarPicagemGPS(); 
        } else { 
            if(modalGPS) {
                modalGPS.style.display = 'flex'; 
            } else {
                window.executarPicagemGPS(); // Plano B se o modal não existir
            }
        }
    } catch (err) {
        alert("⚠️ Erro interno ao iniciar Ponto: " + err.message);
    }
};

if(document.getElementById('btnConfirmarGPS')) {
    document.getElementById('btnConfirmarGPS').addEventListener('click', async () => {
        const myId = localStorage.getItem('agenda360_func_id');
        localStorage.setItem('agenda360_gps_autorizado_' + myId, 'sim'); 
        if(document.getElementById('modalGPS')) document.getElementById('modalGPS').style.display = 'none';
        try { await fetch('/api/funcionarios/consentimento-gps', { method: 'POST', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('agenda360_func_token') } }); } catch(e) { }
        window.executarPicagemGPS();
    });
}

if(document.getElementById('btnForçarManual')) {
    document.getElementById('btnForçarManual').addEventListener('click', () => {
        if(document.getElementById('modalGPS')) document.getElementById('modalGPS').style.display = 'none';
        window.executarPicagemManual('Recusado/Falha (Declaração Manual)');
    });
}

function calcularDistanciaGPS(lat1, lon1, lat2, lon2) {
    const R = 6371000; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

window.executarPicagemGPS = function() {
    try {
        if (!window.escalasTrabalhador || !Array.isArray(window.escalasTrabalhador)) {
            window.executarPicagemManual('Falha técnica: Memória vazia');
            return;
        }

        const turno = window.escalasTrabalhador.find(x => String(x.id) === String(window.escAtivaId));
        
        if (!turno) {
            alert("⚠️ Erro interno: O turno " + window.escAtivaId + " não foi localizado na memória do telemóvel.");
            return;
        }
        
        if (!navigator.geolocation) {
            window.executarPicagemManual('Falha técnica de satélite');
            return;
        }
        
        const gpsNivel = parseInt(localStorage.getItem('agenda360_gps_nivel') || 2);

        // Feedback Visual para garantir ao utilizador que o sistema não crashou
        const btn = document.querySelector(`button[onclick*="abrirJanelaGPS(${window.escAtivaId}"]`);
        let originalText = "Picar Ponto";
        if(btn) {
            originalText = btn.innerText;
            btn.innerText = "A procurar GPS... ⏳";
            btn.disabled = true;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if(btn) { btn.innerText = originalText; btn.disabled = false; }
                const uLat = parseFloat(turno.latitude) || 0; 
                const uLng = parseFloat(turno.longitude) || 0;
                
                if (uLat === 0 && uLng === 0) {
                    window.processarPontoServidor('Confirmado em conformidade (Sem Alvo GPS)');
                    return;
                }
                
                const distancia = calcularDistanciaGPS(pos.coords.latitude, pos.coords.longitude, uLat, uLng);
                
                if (distancia <= 50) { 
                    window.processarPontoServidor('Confirmado em conformidade'); 
                } else { 
                    if (gpsNivel === 1) {
                        alert(`❌ Acesso Bloqueado!\nO satélite deteta que está a ${Math.round(distancia)}m de distância da unidade.`);
                    } else {
                        // Foi adicionada uma string segura de fallback caso os dicionários de idioma falhem
                        const msgConfirm = (typeof dic !== 'undefined' && dic[curLang] && dic[curLang]['js_gps_confirm']) 
                            ? dic[curLang]['js_gps_confirm'].replace('{m}', Math.round(distancia)) 
                            : `O GPS deteta que está fora do local (${Math.round(distancia)}m).\nPretende forçar a picagem manual?`;

                        if (confirm(msgConfirm)) { 
                            window.executarPicagemManual('Declaração Forçada Fora do Raio'); 
                        } 
                    }
                }
            },
            (err) => { 
                if(btn) { btn.innerText = originalText; btn.disabled = false; }
                if(gpsNivel === 1) alert("❌ GPS não detetado. Ponto manual bloqueado por segurança.");
                else window.executarPicagemManual('Recusado/Sem sinal de satélite'); 
            }, 
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Aguarda no máximo 10s pelo satélite
        );
    } catch (err) {
        alert("⚠️ Erro crítico no GPS: " + err.message);
        window.executarPicagemManual('Falha crítica de execução');
    }
};

window.executarPicagemManual = function(motivo) { 
    window.processarPontoServidor(motivo); 
};

window.processarPontoServidor = async function(stringGps) {
    const token = localStorage.getItem('agenda360_func_token');
    
    if (!window.escAtivaId) {
        alert("⚠️ Falha crítica: O ID do turno perdeu-se. Por favor, feche e abra a app.");
        return;
    }

    // Payload Clínico
    const payload = { 
        escala_id: parseInt(window.escAtivaId),
        tipo: window.tipoAtivo, 
        controlo_gps: stringGps
    };

    const btn = document.querySelector(`button[onclick*="abrirJanelaGPS(${window.escAtivaId}"]`);
    let originalText = "Picar Ponto";
    if(btn) { 
        originalText = btn.innerText; 
        btn.innerText = "A guardar... ⏳"; 
        btn.disabled = true; 
    }

    try {
        const res = await fetch('/api/escalas/ponto', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, 
            body: JSON.stringify(payload) 
        });

        if (res.ok) { 
            alert('✅ Ponto registado com sucesso!');
            if (typeof carregarDadosServidor === 'function') {
                carregarDadosServidor();
            } else {
                window.location.reload();
            }
        } else { 
            const data = await res.json().catch(() => ({}));
            alert('⚠️ ' + (data.erro || 'O servidor recusou a picagem. Verifique se o turno é de hoje.')); 
            if(btn) { btn.innerText = originalText; btn.disabled = false; }
        }
    } catch (err) {
        alert('⚠️ Erro de comunicação com o servidor.');
        if(btn) { btn.innerText = originalText; btn.disabled = false; }
    }
};