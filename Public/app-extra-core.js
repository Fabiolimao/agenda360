const dic = {
    'pt': {
        'login_title': 'Área do Trabalhador', 'login_email': 'E-mail Pessoal', 'login_pwd': 'Palavra-passe / PIN', 'btn_enter': 'Entrar',
        'profiles_title': 'Múltiplos Perfis', 'profiles_desc': 'Encontrámos o seu registo em mais de uma empresa. Selecione a empresa onde vai gerir o seu ponto agora:',
        'pwd_req_title': 'Segurança Obrigatória', 'pwd_req_desc': 'Está a usar uma senha provisória. Por favor, crie a sua Senha Pessoal para continuar.',
        'pwd_new': 'Nova Senha', 'pwd_confirm': 'Confirmar Nova Senha', 'btn_save_pwd': 'Gravar Senha Pessoal',
        'hello': 'Olá', 'btn_logout': 'Sair', 'tab_home': 'Início & Ponto', 'tab_rep': 'Extrato Mensal',
        'status_all': 'Todos os Estados', 'status_done': 'Concluídos (Efetivos)', 'status_sched': 'Agendados', 'status_missed': 'Faltas', 'status_canc': 'Cancelados',
        'rep_month': 'Mês de Consulta', 'rep_year': 'Ano', 'rep_status': 'Estado do Turno', 'rep_agendado_box': 'A TRABALHAR (Agendado)', 'rep_efetivas_box': 'TRABALHADAS (Efetivas)',
        'print_btn': '🖨️ Ver / Imprimir Meus Turnos', 'gps_title': 'Consentimento GPS / Consent Form',
        'gps_legal': 'Para validar a sua presença, necessitamos de aceder à sua localização atual apenas neste exato momento. Os dados não são rastreados continuamente e servem estritamente para o registo do ponto laboral, de acordo com as normas da CNPD.',
        'btn_gps_ok': 'Compreendi e Autorizo', 'btn_gps_no': 'Recusar / Ponto Manual',
        'alert_sign_title': '⚠️ Validação Legal Pendente', 'alert_sign_desc': 'O seu gestor fechou a folha de assiduidade mensal e aguarda a sua assinatura digital.',
        'alert_sign_unit_title': '⚠️ Assinatura de Unidade',
        'alert_sign_unit_desc': 'Confirmo que visualizei a folha de assiduidade detalhada desta unidade.\n\nDeclaro que os tempos de trabalho e as pausas registadas estão exatos e corretos.\n\nPretende colocar o carimbo digital e fechar a folha definitivamente?',
        'btn_sign_unit': '✍️ Assinar Digitalmente esta Unidade',
        'btn_read_sign': '🔍 1. Ver Folha e 2. Assinar', 'ass_legal_title': 'Revisão Concluída?',
        'ass_legal_desc': 'Ao clicar abaixo, declaro sob compromisso de honra que visualizei o extrato detalhado e que as horas e pausas aqui registadas estão corretas.',
        'btn_sign': '✍️ Sim, Assinar Digitalmente', 'th_date': 'Data', 'th_local': 'Local de Trabalho', 'th_func': 'Função', 'th_in': 'Entrada Real', 'th_out': 'Saída Real', 'th_hours': 'Horas Efetivas',
        'js_today_shifts': 'Turnos de Hoje', 'js_shifts_of': 'Turnos do dia:', 'js_free_day': 'Dia livre. Nenhum turno agendado nesta data.',
        'js_btn_in': 'Picar Entrada ➔', 'js_btn_out': 'Picar Saída ➔', 'js_locked': '🔒 Bloqueado (Disponível 15m antes)', 'js_expired': '❌ Turno expirou sem registo.', 'js_done': '✅ Turno Registado',
        'js_missed': '🚫 FALTA', 'js_canc': '🚫 CANCELADO', 
        'chk_title_out': '🏁 Registar Saída', 'btn_cancel': 'Cancelar', 'btn_confirm_out': 'Confirmar Saída',
        'lbl_done': 'Concluído', 'lbl_scheduled': 'Agendado', 'lbl_missed': 'Cancelado/Falta',
        'js_gps_confirm': 'O satélite detetou que está a {m} metros da unidade. Registar via Declaração Manual?',
        'js_alert_sign': 'Confirmo que visualizei a folha de assiduidade detalhada acima.\n\nDeclaro que os tempos de trabalho e as pausas registadas estão exatos e corretos.\n\nPretende colocar o carimbo digital e fechar a folha definitivamente?',
        'days': ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], 'months': ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
    },
    'en': {
        'login_title': 'Employee Area', 'login_email': 'Personal E-mail', 'login_pwd': 'Password / PIN', 'btn_enter': 'Login',
        'profiles_title': 'Multiple Profiles', 'profiles_desc': 'We found your record in more than one company. Select the company to manage your time clock:',
        'pwd_req_title': 'Security Requirement', 'pwd_req_desc': 'You are using a temporary password. Please create your Personal Password to continue.',
        'pwd_new': 'New Password', 'pwd_confirm': 'Confirm New Password', 'btn_save_pwd': 'Save Personal Password',
        'hello': 'Hello', 'btn_logout': 'Logout', 'tab_home': 'Home & Time Clock', 'tab_rep': 'Monthly Statement',
        'status_all': 'All Statuses', 'status_done': 'Completed (Effective)', 'status_sched': 'Scheduled', 'status_missed': 'Absences', 'status_canc': 'Cancelled',
        'rep_month': 'Query Month', 'rep_year': 'Year', 'rep_status': 'Shift Status', 'rep_agendado_box': 'TO WORK (Scheduled)', 'rep_efetivas_box': 'WORKED (Effective)',
        'print_btn': '🖨️ View / Print My Shifts', 'gps_title': 'Consentimento GPS / Consent Form',
        'gps_legal': 'To validate your presence, we need to access your location only at this exact moment. Data is not continuously tracked and is strictly used for labor point registration, in accordance with GDPR.',
        'btn_gps_ok': 'I Understand and Authorize', 'btn_gps_no': 'Decline / Manual Clock',
        'alert_sign_title': '⚠️ Pending Legal Validation', 'alert_sign_desc': 'Your manager has closed the monthly attendance sheet and is waiting for your digital signature.',
        'alert_sign_unit_title': '⚠️ Unit Signature',
        'alert_sign_unit_desc': 'I confirm that I have viewed the detailed attendance sheet for this unit.\n\nI declare that the working times and breaks recorded are exact and correct.\n\nDo you want to apply the digital stamp and close the sheet definitively?',
        'btn_sign_unit': '✍️ Digitally Sign this Unit',
        'btn_read_sign': '🔍 1. View Sheet and 2. Sign', 'ass_legal_title': 'Review Completed?',
        'ass_legal_desc': 'By clicking below, I declare on my honor that I have viewed the detailed statement and that the hours and breaks recorded here are correct.',
        'btn_sign': '✍️ Yes, Sign Digitally', 'th_date': 'Date', 'th_local': 'Workplace', 'th_func': 'Role', 'th_in': 'Real Clock In', 'th_out': 'Real Clock Out', 'th_hours': 'Effective Hours',
        'js_today_shifts': 'Today\'s Shifts', 'js_shifts_of': 'Shifts for:', 'js_free_day': 'Free day. No shifts scheduled for this date.',
        'js_btn_in': 'Clock In ➔', 'js_btn_out': 'Clock Out ➔', 'js_locked': '🔒 Locked (Available 15m prior)', 'js_expired': '❌ Shift expired without registration.', 'js_done': '✅ Shift Recorded',
        'js_missed': '🚫 ABSENT', 'js_canc': '🚫 CANCELLED', 
        'chk_title_out': '🏁 Clock Out', 'chk_pause_prev': 'Your shift included a <b>{m} minute</b> break.', 'chk_pause_conf': 'I confirm I took the scheduled break.', 'chk_pause_deny': 'I DID NOT take the break.', 'chk_no_pause_prev': 'Your shift had no scheduled breaks.', 'chk_pause_unplanned': 'I took an unscheduled break.', 'chk_pause_how_many': 'How many break minutes did you take?', 'btn_cancel': 'Cancel', 'btn_confirm_out': 'Confirm Clock Out',
        'lbl_done': 'Completed', 'lbl_scheduled': 'Scheduled', 'lbl_missed': 'Cancelled/Absent',
        'js_gps_confirm': 'The satellite detected you are {m} meters from the unit. Register via Manual Declaration?',
        'js_alert_sign': 'I confirm that I have viewed the detailed attendance sheet above.\n\nI declare that the working times and breaks recorded are exact and correct.\n\nDo you want to apply the digital stamp and close the sheet definitively?',
        'days': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], 'months': ["January","February","March","April","May","June","July","August","September","October","November","December"]
    },
    'es': {
        'login_title': 'Área del Empleado', 'login_email': 'Correo Personal', 'login_pwd': 'Contraseña / PIN', 'btn_enter': 'Ingresar',
        'profiles_title': 'Múltiples Perfiles', 'profiles_desc': 'Encontramos su registro en más de una empresa. Seleccione la empresa para gestionar su fichaje:',
        'pwd_req_title': 'Seguridad Obligatoria', 'pwd_req_desc': 'Está utilizando una contraseña temporal. Por favor, cree su Contraseña Personal para continuar.',
        'pwd_new': 'Nueva Contraseña', 'pwd_confirm': 'Confirmar Nueva Contraseña', 'btn_save_pwd': 'Guardar Contraseña',
        'hello': 'Hola', 'btn_logout': 'Salir', 'tab_home': 'Inicio y Fichaje', 'tab_rep': 'Extracto Mensual',
        'status_all': 'Todos los Estados', 'status_done': 'Completados (Efectivos)', 'status_sched': 'Programados', 'status_missed': 'Faltas', 'status_canc': 'Cancelados',
        'rep_month': 'Mes de Consulta', 'rep_year': 'Año', 'rep_status': 'Estado del Turno', 'rep_agendado_box': 'A TRABAJAR (Programado)', 'rep_efetivas_box': 'TRABAJADAS (Efectivas)',
        'print_btn': '🖨️ Ver / Imprimir Mis Turnos', 'gps_title': 'Consentimento GPS / Consent Form',
        'gps_legal': 'Para validar su presencia, necesitamos acceder a su ubicación solo en este exacto momento. Los datos no se rastrean continuamente y se utilizan estrictamente para el registro laboral, de acuerdo con el RGPD.',
        'btn_gps_ok': 'Comprendo y Autorizo', 'btn_gps_no': 'Rechazar / Fichaje Manual',
        'alert_sign_title': '⚠️ Validación Legal Pendiente', 'alert_sign_desc': 'Su gerente ha cerrado la hoja de asistencia mensual y espera su firma digital.',
        'btn_read_sign': '🔍 1. Ver Hoja y 2. Firmar', 'ass_legal_title': '¿Revisión Completada?',
        'ass_legal_desc': 'Al hacer clic a continuación, declaro bajo juramento que he visto el extracto detallado y que las horas y pausas registradas son correctas.',
        'btn_sign': '✍️ Sí, Firmar Digitalmente', 'th_date': 'Fecha', 'th_local': 'Lugar de Trabajo', 'th_func': 'Función', 'th_in': 'Entrada Real', 'th_out': 'Salida Real', 'th_hours': 'Horas Efectivas',
        'js_today_shifts': 'Turnos de Hoy', 'js_shifts_of': 'Turnos del día:', 'js_free_day': 'Día libre. No hay turnos programados en esta fecha.',
        'js_btn_in': 'Fichar Entrada ➔', 'js_btn_out': 'Fichar Salida ➔', 'js_locked': '🔒 Bloqueado (Disponible 15m antes)', 'js_expired': '❌ Turno expirado sin registro.', 'js_done': '✅ Turno Registrado',
        'js_missed': '🚫 FALTA', 'js_canc': '🚫 CANCELADO', 
        'chk_title_out': '🏁 Registrar Salida', 'btn_cancel': 'Cancelar', 'btn_confirm_out': 'Confirmar Salida',
        'lbl_done': 'Completado', 'lbl_scheduled': 'Programado', 'lbl_missed': 'Cancelado/Falta',
        'js_gps_confirm': 'El satélite detectó que está a {m} metros de la unidad. ¿Registrar vía Declaración Manual?',
        'js_alert_sign': 'Confirmo que he visto la hoja de asistencia detallada arriba.\n\nDeclaro que los tiempos de trabajo y las pausas registradas son exactos y correctos.\n\n¿Desea aplicar el sello digital y cerrar la hoja definitivamente?',
        'days': ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], 'months': ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
    }
};

// 📍 AS VARIÁVEIS GLOBAIS BLINDADAS (UNIFICADAS APENAS AQUI)
let curLang = localStorage.getItem('agenda360_lang') || 'pt';
let tempEmail = ''; 
let tempSenhaAtual = ''; 
let escalasTrabalhador = []; 
let filtroDataApp = new Date().toISOString().slice(0,10); 
let todasAssinaturasApp = []; 
let escAtivaId = null; 
let tipoAtivo = null;
let turnoAtualCheckout = null;
const dAtual = new Date();

function setLang(l) {
    curLang = l;
    localStorage.setItem('agenda360_lang', l);
    document.querySelectorAll('.lang-badge').forEach(e => e.classList.remove('active'));
    if(document.getElementById('badge_'+l)) document.getElementById('badge_'+l).classList.add('active');
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dic[curLang][key]) el.innerHTML = dic[curLang][key];
    });

    if(document.getElementById('lbl_alert_sign_title')) document.getElementById('lbl_alert_sign_title').innerText = dic[curLang]['alert_sign_title'];
    if(document.getElementById('lbl_alert_sign_desc')) document.getElementById('lbl_alert_sign_desc').innerText = dic[curLang]['alert_sign_desc'];
    if(document.getElementById('lbl_chk_title')) document.getElementById('lbl_chk_title').innerText = dic[curLang]['chk_title_out'];
    if(document.getElementById('lbl_chk_cancel')) document.getElementById('lbl_chk_cancel').innerText = dic[curLang]['btn_cancel'];
    if(document.getElementById('btnConfirmarSaidaReal')) document.getElementById('btnConfirmarSaidaReal').innerText = dic[curLang]['btn_confirm_out'];
    
    const gpsHtml = `
        <p style="margin-bottom:8px;"><b>🇵🇹 PT:</b> ${dic['pt']['gps_legal']}</p>
        <p style="margin-bottom:8px; color:#1e293b;"><b>🇺🇸 EN:</b> ${dic['en']['gps_legal']}</p>
        <p style="color:#334155;"><b>🇪🇸 ES:</b> ${dic['es']['gps_legal']}</p>
    `;
    if(document.getElementById('text_gps_legal')) document.getElementById('text_gps_legal').innerHTML = gpsHtml;

    const hDays = dic[curLang]['days'];
    if(document.getElementById('cal_headers_row')) {
        document.getElementById('cal_headers_row').innerHTML = `<div>${hDays[0]}</div><div>${hDays[1]}</div><div>${hDays[2]}</div><div>${hDays[3]}</div><div>${hDays[4]}</div><div>${hDays[5]}</div><div>${hDays[6]}</div>`;
    }
    renderizarMeses();

    if(document.getElementById('tituloFiltroTurnos') && typeof renderTurnosHome === 'function') renderTurnosHome();
    if(document.getElementById('boxAssinarRodape') && document.getElementById('boxAssinarRodape').style.display === 'block' && typeof gerarRelatorioApp === 'function') gerarRelatorioApp(); 
}

function renderizarMeses() {
    const mApp = document.getElementById('calMesApp'); 
    const mRep = document.getElementById('repMesFiltro');
    if (!mApp || !mRep) return;

    const mVal1 = mApp.value; mApp.innerHTML = '';
    const mVal2 = mRep.value; mRep.innerHTML = '';
    dic[curLang]['months'].forEach((m, idx) => {
        mApp.innerHTML += `<option value="${idx}">${m}</option>`;
        mRep.innerHTML += `<option value="${idx + 1}">${m}</option>`; 
    });
    if(mVal1) mApp.value = mVal1; if(mVal2) mRep.value = mVal2;
}

if(document.getElementById('calMesApp')) document.getElementById('calMesApp').value = dAtual.getMonth();
if(document.getElementById('calAnoApp')) document.getElementById('calAnoApp').value = dAtual.getFullYear();
if(document.getElementById('repMesFiltro')) document.getElementById('repMesFiltro').value = dAtual.getMonth() + 1;
if(document.getElementById('repAnoFiltro')) document.getElementById('repAnoFiltro').value = dAtual.getFullYear();

setLang(curLang);

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') { input.type = 'text'; btn.innerText = '🙈'; } 
    else { input.type = 'password'; btn.innerText = '👁️'; }
}

function formatarMinutosParaHHMM(minutosTotais) {
    if (isNaN(minutosTotais) || minutosTotais <= 0) return "00:00 h";
    const h = Math.floor(minutosTotais / 60);
    const m = Math.round(minutosTotais % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} h`;
}

function mostrarTela(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if(document.getElementById(id)) {
        document.getElementById(id).classList.add('active');
        if (id === 'screenDashboard') document.getElementById(id).style.display = 'flex';
    }
}

function switchTabApp(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if(document.getElementById(tabId)) document.getElementById(tabId).classList.add('active');
    if(btn) btn.classList.add('active');
    
    if(tabId === 'tabCalendario' && typeof gerarCalendarioApp === 'function') { gerarCalendarioApp(); renderTurnosHome(); }
    if(tabId === 'tabRelatorios' && typeof gerarRelatorioApp === 'function') { gerarRelatorioApp(); }
    window.scrollTo(0,0);
}