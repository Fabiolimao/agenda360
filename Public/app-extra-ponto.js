// ==========================================
// MÓDULO: REGISTO DE PONTO E GPS DA APP
// ==========================================

// 📍 BLINDAGEM: Variáveis globais inquebráveis
window.escAtivaId = null;
window.tipoAtivo = null;

function abrirJanelaGPS(escalaId, tipo) {
    window.escAtivaId = parseInt(escalaId); 
    window.tipoAtivo = tipo;
    const gpsNivel = parseInt(localStorage.getItem('agenda360_gps_nivel') || 2);
    
    if (gpsNivel === 3) {
        return executarPicagemManual('Ponto Validado (GPS Desativado pela Agência)');
    }

    const myId = localStorage.getItem('agenda360_func_id');
    const modalGPS = document.getElementById('modalGPS');
    const btnForcarManual = document.getElementById('btnForçarManual');

    if (gpsNivel === 1 && btnForcarManual) {
        btnForcarManual.style.display = 'none';
    } else if (btnForcarManual) {
        btnForcarManual.style.display = 'block';
    }

    if (localStorage.getItem('agenda360_gps_autorizado_' + myId) === 'sim') { 
        executarPicagemGPS(); 
    } else { 
        if(modalGPS) modalGPS.style.display = 'flex'; 
    }
}

if(document.getElementById('btnConfirmarGPS')) {
    document.getElementById('btnConfirmarGPS').addEventListener('click', async () => {
        const myId = localStorage.getItem('agenda360_func_id');
        localStorage.setItem('agenda360_gps_autorizado_' + myId, 'sim'); 
        if(document.getElementById('modalGPS')) document.getElementById('modalGPS').style.display = 'none';
        try { await fetch('/api/funcionarios/consentimento-gps', { method: 'POST', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('agenda360_func_token') } }); } catch(e) { }
        executarPicagemGPS();
    });
}

if(document.getElementById('btnForçarManual')) {
    document.getElementById('btnForçarManual').addEventListener('click', () => {
        if(document.getElementById('modalGPS')) document.getElementById('modalGPS').style.display = 'none';
        executarPicagemManual('Recusado/Falha (Declaração Manual)');
    });
}

function calcularDistanciaGPS(lat1, lon1, lat2, lon2) {
    const R = 6371000; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function executarPicagemGPS() {
    const turno = escalasTrabalhador.find(x => String(x.id) === String(window.escAtivaId));
    
    if (!turno) {
        alert("⚠️ Erro interno: O turno não foi localizado na memória do telemóvel.");
        return;
    }
    
    if (!navigator.geolocation) {
        return executarPicagemManual('Falha técnica de GPS');
    }
    
    const gpsNivel = parseInt(localStorage.getItem('agenda360_gps_nivel') || 2);

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const uLat = parseFloat(turno.latitude) || 0; const uLng = parseFloat(turno.longitude) || 0;
            if (uLat === 0 && uLng === 0) return processarPontoServidor('Confirmado em conformidade (Sem Alvo GPS)');
            
            const distancia = calcularDistanciaGPS(pos.coords.latitude, pos.coords.longitude, uLat, uLng);
            
            if (distancia <= 50) { 
                processarPontoServidor('Confirmado em conformidade'); 
            } else { 
                if (gpsNivel === 1) {
                    alert(`❌ Acesso Bloqueado!\nO satélite deteta que está a ${Math.round(distancia)}m de distância da unidade. A sua agência exige presença física rigorosa.`);
                } else {
                    if (confirm(dic[curLang]['js_gps_confirm'].replace('{m}', Math.round(distancia)))) { 
                        executarPicagemManual('Declaração Forçada Fora do Raio'); 
                    } 
                }
            }
        },
        (err) => { 
            if(gpsNivel === 1) alert("❌ GPS não detetado. Ponto manual encontra-se bloqueado por segurança pela sua Agência.");
            else executarPicagemManual('Recusado/Sem sinal de satélite'); 
        }, 
        { enableHighAccuracy: true, timeout: 8000 }
    );
}

function executarPicagemManual(motivo) { processarPontoServidor(motivo); }

async function processarPontoServidor(stringGps) {
    const token = localStorage.getItem('agenda360_func_token');
    const funcId = localStorage.getItem('agenda360_func_id');
    
    if (!window.escAtivaId) {
        alert("⚠️ Falha crítica: O ID do turno perdeu-se na memória. Por favor, recarregue a página.");
        return;
    }

    // 📍 OMNIBUS PAYLOAD: Cobre todas as exigências possíveis do Backend num só envio
    const payload = { 
        escala_id: parseInt(window.escAtivaId),
        id: parseInt(window.escAtivaId), 
        turno_id: parseInt(window.escAtivaId),
        funcionario_id: parseInt(funcId),
        tipo: window.tipoAtivo, 
        controlo_gps: stringGps
    };

    const headersObj = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

    try {
        // TENTATIVA 1: Rota Original
        let res = await fetch('/api/escalas/ponto', { method: 'POST', headers: headersObj, body: JSON.stringify(payload) });
        let data = await res.clone().json().catch(() => ({}));

        // 📍 TENTATIVAS DE EMERGÊNCIA: Se o backend devolver erro de rota ou "Turno não encontrado", tentamos o padrão RESTful
        if (!res.ok && (res.status === 404 || res.status === 400 || data.erro === 'Turno não encontrado.')) {
            
            // Alternativa A: O backend pode estar à espera do ID no link (POST)
            let resAlt = await fetch(`/api/escalas/${window.escAtivaId}/ponto`, { method: 'POST', headers: headersObj, body: JSON.stringify(payload) });
            if (resAlt.ok) { res = resAlt; data = await resAlt.clone().json().catch(()=>({})); }
            else {
                // Alternativa B: O backend pode estar a exigir um PUT (Atualização) em vez de POST
                let resAlt2 = await fetch(`/api/escalas/${window.escAtivaId}/ponto`, { method: 'PUT', headers: headersObj, body: JSON.stringify(payload) });
                if (resAlt2.ok) { res = resAlt2; data = await resAlt2.clone().json().catch(()=>({})); }
            }
        }

        if (res.ok) { 
            carregarDadosServidor(); 
            alert('✅ Ponto registado com sucesso!');
        } else { 
            alert('⚠️ ' + (data.erro || 'O servidor recusou a picagem de ponto.')); 
        }
    } catch (err) {
        alert('⚠️ Erro de comunicação com o servidor.');
    }
}