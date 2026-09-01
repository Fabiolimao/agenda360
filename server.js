const express = require('express');
const { Pool } = require('pg'); 
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); 
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use((req, res, next) => {
    // Forçar a aniquilação de qualquer regra de CSP que o servidor tente inventar
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Content-Security-Policy");
    next();
});
const PORT = process.env.PORT || 3005;

// ==========================================================
// ROTA INDEPENDENTE: FOLHA DE PONTO (PADRAO ACT) - FASE 1
// ==========================================================
app.get('/api/folha-ponto/trabalhador/:id/:ano/:mes', verificarTokenWeb, async (req, res) => {
    try {
        const { id, ano, mes } = req.params;
        
        // 1. Número de dias no mês
        const numDias = new Date(ano, mes, 0).getDate();
        
        // 2. Extração de Dados Isolada
        const query = `
            SELECT 
                e.id as escala_id, e.data_inicio, e.hora_entrada, e.hora_saida, 
                e.checkin_real, e.checkout_real, e.status_turno, e.tipo_ausencia, e.funcao,
                u.id as unidade_id, u.nome_unidade,
                c.id as cliente_id, c.nome_empresa
            FROM escalas e
            JOIN unidades u ON e.unidade_id = u.id
            JOIN clientes c ON u.cliente_id = c.id
            WHERE e.funcionario_id = $1 
              AND EXTRACT(MONTH FROM e.data_inicio::DATE) = $2 
              AND EXTRACT(YEAR FROM e.data_inicio::DATE) = $3
            ORDER BY e.data_inicio ASC, e.hora_entrada ASC
        `;
        
        const result = await pool.query(query, [id, mes, ano]);
        const records = result.rows;
        
        // Função auxiliar para minutos (HH:MM -> int)
        const parseTime = (timeStr) => {
            if (!timeStr) return 0;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };
        
        // Função auxiliar para calcular tempo efetivo considerando meia noite
        const calcDiffMin = (inMin, outMin) => {
            if (outMin < inMin) outMin += 24 * 60; // Passou da meia noite
            return outMin - inMin;
        };

        // Função para calcular minutos noturnos (22:00 às 07:00)
        const calcNoturno = (inMin, outMin) => {
            if (outMin < inMin) outMin += 24 * 60;
            let nightMins = 0;
            for (let m = inMin; m < outMin; m++) {
                let hourOfDay = Math.floor(m / 60) % 24;
                if (hourOfDay >= 22 || hourOfDay < 7) {
                    nightMins++;
                }
            }
            return nightMins;
        };
        
        // 3. Agrupamento por Cliente/Unidade
        const gruposMap = {};
        
        // Pré-popular com os registos encontrados
        records.forEach(r => {
            const grupoKey = `${r.cliente_id}_${r.unidade_id}`;
            if (!gruposMap[grupoKey]) {
                gruposMap[grupoKey] = {
                    cliente_id: r.cliente_id,
                    empresa: r.nome_empresa,
                    unidade_id: r.unidade_id,
                    unidade: r.nome_unidade,
                    funcao: r.funcao,
                    mapaDias: {}
                };
            }
            
            // Calculos Matemáticos do Turno
            const d = new Date(r.data_inicio);
            const diaNum = d.getDate();
            
            let tipo = 'T'; // Trabalho
            if (r.status_turno === 'Falta' || r.status_turno === 'Cancelado') tipo = 'Falta';
            if (r.tipo_ausencia) tipo = r.tipo_ausencia;
            
            let previsto = 0;
            let efetivo = 0;
            let noturno = 0;
            let extra = 0;
            let normal = 0;
            
            if (r.hora_entrada && r.hora_saida) {
                previsto = calcDiffMin(parseTime(r.hora_entrada), parseTime(r.hora_saida));
            }
            
            if (r.status_turno === 'Concluído' || r.status_turno === 'Validado') {
                const startStr = r.checkin_real || r.hora_entrada;
                const endStr = r.checkout_real || r.hora_saida;
                
                if (startStr && endStr) {
                    const startMin = parseTime(startStr);
                    const endMin = parseTime(endStr);
                    
                    efetivo = calcDiffMin(startMin, endMin);
                    noturno = calcNoturno(startMin, endMin);
                    
                    if (efetivo > previsto && previsto > 0) {
                        extra = efetivo - previsto;
                    }
                    
                    normal = efetivo - noturno;
                    if (normal < 0) normal = 0;
                }
            }
            
            // Armazenar no mapa
            if (!gruposMap[grupoKey].mapaDias[diaNum]) {
                gruposMap[grupoKey].mapaDias[diaNum] = [];
            }
            
            gruposMap[grupoKey].mapaDias[diaNum].push({
                dia: diaNum,
                tipo: tipo,
                previsto_horas: parseFloat((previsto / 60).toFixed(2)),
                efetivo_horas: parseFloat((efetivo / 60).toFixed(2)),
                horas_normais: parseFloat((normal / 60).toFixed(2)),
                horas_noturnas: parseFloat((noturno / 60).toFixed(2)),
                horas_extra: parseFloat((extra / 60).toFixed(2)),
                detalhe: `${r.checkin_real || r.hora_entrada} - ${r.checkout_real || r.hora_saida}`
            });
        });
        
        const respostaFinal = [];
        
        Object.keys(gruposMap).forEach(key => {
            const grupo = gruposMap[key];
            const diasFinais = [];
            
            for (let i = 1; i <= numDias; i++) {
                if (grupo.mapaDias[i]) {
                    diasFinais.push(...grupo.mapaDias[i]);
                } else {
                    diasFinais.push({
                        dia: i,
                        tipo: 'F', // Folga
                        previsto_horas: 0,
                        efetivo_horas: 0,
                        horas_normais: 0,
                        horas_noturnas: 0,
                        horas_extra: 0,
                        detalhe: '-'
                    });
                }
            }
            
            respostaFinal.push({
                cliente_id: grupo.cliente_id,
                empresa: grupo.empresa,
                unidade_id: grupo.unidade_id,
                unidade: grupo.unidade,
                funcao: grupo.funcao,
                dias: diasFinais
            });
        });
        
        res.json({
            sucesso: true,
            trabalhador_id: id,
            mes: mes,
            ano: ano,
            agrupamentos: respostaFinal
        });

    } catch (e) {
        console.error("Erro FOLHA DE PONTO FASE 1:", e);
        res.status(500).json({ sucesso: false, erro: "Erro ao gerar folha de ponto." });
    }
});

// ==========================================
// 0. AUTO-GERAÇÃO DO COFRE E ARQUIVO FRIO
// ==========================================
let SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY || SECRET_KEY === 'Chave_Falha_Emergencia_2026') {
    const novaChave = crypto.randomBytes(64).toString('hex');
    try {
        fs.appendFileSync(path.join(__dirname, '.env'), `\nSECRET_KEY=${novaChave}\n`);
        SECRET_KEY = novaChave;
    } catch (err) { SECRET_KEY = novaChave; }
}

if (!fs.existsSync(path.join(__dirname, 'backups'))) {
    fs.mkdirSync(path.join(__dirname, 'backups'));
}

const dominiosPermitidos = [process.env.URL_OFICIAL, 'http://localhost:3005'];
app.use(cors({ 
    origin: function (origin, callback) {
        if (!origin || dominiosPermitidos.includes(origin)) { callback(null, true); } 
        else { callback(new Error('Acesso Bloqueado pela Política CORS de Segurança')); }
    }
}));

app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'Public')));

function handleError(res, err, customMsg = 'Erro interno do servidor. Contacte o suporte.') {
    console.error('[SECURITY LOG - ' + new Date().toISOString() + '] Erro BD:', err.message);
    return res.status(500).json({ erro: customMsg });
}

function validarSenhaForte(senha) { return /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(senha); }

function sanitizeDeep(obj) {
    if (typeof obj === 'string') return obj.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (Array.isArray(obj)) return obj.map(item => sanitizeDeep(item));
    if (typeof obj === 'object' && obj !== null) { let sanitized = {}; for (let key in obj) sanitized[key] = sanitizeDeep(obj[key]); return sanitized; }
    return obj;
}

app.use((req, res, next) => { if (req.body) req.body = sanitizeDeep(req.body); next(); });

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { erro: 'Muitas tentativas falhadas. Dispositivo bloqueado temporariamente por segurança.' } });

// ==========================================
// 1. LIGAÇÃO AO POSTGRESQL & TRADUTOR
// ==========================================
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'agenda360',
    password: process.env.DB_PASSWORD || 'admin123', 
    port: process.env.DB_PORT || 5432,
    ssl: true
});

pool.on('error', (err) => { console.error('❌ Erro crítico no PostgreSQL:', err); });

const db = {
    all: async (sql, params, callback) => {
        if (typeof params === 'function') { callback = params; params = []; }
        let i = 1; const pgSql = sql.replace(/\?/g, () => `$${i++}`);
        try { const res = await pool.query(pgSql, params); callback(null, res.rows); } catch (err) { callback(err, null); }
    },
    get: async (sql, params, callback) => {
        if (typeof params === 'function') { callback = params; params = []; }
        let i = 1; const pgSql = sql.replace(/\?/g, () => `$${i++}`);
        try { const res = await pool.query(pgSql, params); callback(null, res.rows[0]); } catch (err) { callback(err, null); }
    },
    run: async function(sql, params, callback) {
        if (typeof params === 'function') { callback = params; params = []; }
        let i = 1; let pgSql = sql.replace(/\?/g, () => `$${i++}`);
        
        // 🚀 A CORREÇÃO
        if (pgSql.trim().toUpperCase().startsWith('INSERT') && 
            !pgSql.toUpperCase().includes('RETURNING') && 
            !pgSql.toLowerCase().includes('tokens_revogados')) { 
            pgSql += ' RETURNING id'; 
        }
        
        try { 
            const res = await pool.query(pgSql, params); 
            const ctx = { lastID: (res.rows && res.rows.length > 0 && res.rows[0].id) ? res.rows[0].id : null }; 
            if (callback) callback.call(ctx, null); 
        } catch (err) { if (callback) callback.call(this, err); }
    }
};

pool.connect(async (err, client, release) => {
    if (err) { console.error('❌ Falha ao ligar ao PostgreSQL.', err.stack); } else {
        console.log('✅ Base de Dados PostgreSQL online.'); release(); await criarTabelas();
    }
});

async function criarTabelas() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS agencias (id SERIAL PRIMARY KEY, nome_agencia TEXT, nif TEXT, rua TEXT, cidade TEXT, nome_gestor TEXT, telefone TEXT, email TEXT UNIQUE, senha_hash TEXT, status TEXT DEFAULT 'ativo', codigo_postal TEXT, localidade TEXT, representante_legal TEXT, cargo_representante TEXT, data_inicio_contrato TEXT, limite_base_funcionarios INTEGER DEFAULT 0, valor_base_mensal REAL DEFAULT 0.0, valor_extra_funcionario REAL DEFAULT 0.0, valor_extra_inativo REAL DEFAULT 0.0, dia_vencimento INTEGER DEFAULT 8, regime_iva TEXT DEFAULT '+ IVA')`);
        try { await pool.query(`ALTER TABLE agencias ADD COLUMN ofertas_whatsapp INTEGER DEFAULT 1`); } catch(e) { }
        try { await pool.query(`ALTER TABLE agencias ADD COLUMN gps_nivel INTEGER DEFAULT 2`); } catch(e) { } 

        await pool.query(`CREATE TABLE IF NOT EXISTS clientes (id SERIAL PRIMARY KEY, agencia_id INTEGER REFERENCES agencias(id) ON DELETE CASCADE, nome_empresa TEXT, nif TEXT, observacoes TEXT, nome_responsavel TEXT, telefone TEXT, email TEXT)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS unidades (id SERIAL PRIMARY KEY, cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE, nome_unidade TEXT, rua TEXT, porta TEXT, cidade TEXT, contato_nome TEXT, telefone TEXT, email TEXT, latitude REAL, longitude REAL, funcoes_frequentes TEXT, exige_validacao INTEGER DEFAULT 0)`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS funcionarios (id SERIAL PRIMARY KEY, agencia_id INTEGER REFERENCES agencias(id) ON DELETE CASCADE, nome_completo TEXT, email TEXT, telemovel TEXT, rua TEXT, porta TEXT, andar TEXT, freguesia TEXT, cp TEXT, concelho TEXT, nacionalidade TEXT, idiomas TEXT, funcoes_habilitadas TEXT, senha_hash TEXT, status TEXT DEFAULT 'ativo', senha_provisoria INTEGER DEFAULT 1, consentimento_gps TEXT DEFAULT NULL, nif TEXT)`);
        
        try { await pool.query(`ALTER TABLE funcionarios ADD COLUMN cidade TEXT`); } catch(e) { }
        try { await pool.query(`ALTER TABLE funcionarios ADD COLUMN disponibilidade TEXT`); } catch(e) { }
        try { await pool.query(`ALTER TABLE funcionarios ADD COLUMN data_inativacao TEXT DEFAULT NULL`); } catch(e) { } 

        // ORDEM CORRIGIDA: solicitacoes_extra é criada antes das escalas
        await pool.query(`CREATE TABLE IF NOT EXISTS solicitacoes_extra (id SERIAL PRIMARY KEY, agencia_id INTEGER REFERENCES agencias(id) ON DELETE CASCADE, unidade_id INTEGER REFERENCES unidades(id) ON DELETE CASCADE, funcao TEXT, data_inicio TEXT, hora_entrada TEXT, hora_saida TEXT, quantidade INTEGER, tem_pausa INTEGER DEFAULT 0, minutos_pausa INTEGER DEFAULT 0, status TEXT DEFAULT 'Pendente', data_pedido TEXT)`);

        await pool.query(`CREATE TABLE IF NOT EXISTS escalas (id SERIAL PRIMARY KEY, unidade_id INTEGER REFERENCES unidades(id) ON DELETE CASCADE, funcionario_id INTEGER REFERENCES funcionarios(id) ON DELETE CASCADE, funcao VARCHAR(255), data_inicio DATE, hora_entrada TIME, data_fim DATE, hora_saida TIME, tem_pausa INTEGER DEFAULT 0, timestamp_inicio_pausa TIMESTAMPTZ DEFAULT NULL, timestamp_fim_pausa TIMESTAMPTZ DEFAULT NULL, enviar_sms INTEGER DEFAULT 0, checkin_real VARCHAR(50) DEFAULT NULL, checkout_real VARCHAR(50) DEFAULT NULL, status_turno VARCHAR(50) DEFAULT 'Agendado', controlo_gps TEXT DEFAULT 'Não verificado', solicitacao_id INTEGER REFERENCES solicitacoes_extra(id) ON DELETE SET NULL, validado_cliente INTEGER DEFAULT 0, obs_cliente TEXT DEFAULT NULL, horas_normais NUMERIC(5,2) DEFAULT 0.00, horas_noturnas NUMERIC(5,2) DEFAULT 0.00, horas_extras NUMERIC(5,2) DEFAULT 0.00, tipo_ausencia VARCHAR(50) DEFAULT NULL)`);
        
        try { await pool.query(`ALTER TABLE escalas ADD COLUMN status_turno VARCHAR(50) DEFAULT 'Agendado'`); } catch(e) { }
        try { await pool.query(`ALTER TABLE escalas ADD COLUMN horas_normais NUMERIC(5,2) DEFAULT 0.00`); } catch(e) { }
        try { await pool.query(`ALTER TABLE escalas ADD COLUMN horas_noturnas NUMERIC(5,2) DEFAULT 0.00`); } catch(e) { }
        try { await pool.query(`ALTER TABLE escalas ADD COLUMN horas_extras NUMERIC(5,2) DEFAULT 0.00`); } catch(e) { }
        try { await pool.query(`ALTER TABLE escalas ADD COLUMN tipo_ausencia VARCHAR(50) DEFAULT NULL`); } catch(e) { }
        try { await pool.query(`ALTER TABLE escalas ADD COLUMN timestamp_inicio_pausa TIMESTAMPTZ DEFAULT NULL`); } catch(e) { }
        try { await pool.query(`ALTER TABLE escalas ADD COLUMN timestamp_fim_pausa TIMESTAMPTZ DEFAULT NULL`); } catch(e) { }
        try { await pool.query(`ALTER TABLE escalas ADD COLUMN minutos_pausa INTEGER DEFAULT 0`); } catch(e) { }

        await pool.query(`CREATE TABLE IF NOT EXISTS gestores (id SERIAL PRIMARY KEY, agencia_id INTEGER REFERENCES agencias(id) ON DELETE CASCADE, nome_gestor TEXT, email TEXT UNIQUE, senha_hash TEXT, unidade_id INTEGER, status TEXT DEFAULT 'ativo', tipo_perfil TEXT DEFAULT 'CLIENTE', parent_id INTEGER DEFAULT NULL, senha_provisoria INTEGER DEFAULT 0, nif TEXT DEFAULT NULL)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS funcoes (id SERIAL PRIMARY KEY, agencia_id INTEGER, nome TEXT NOT NULL)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS assinaturas_mensais (id SERIAL PRIMARY KEY, agencia_id INTEGER REFERENCES agencias(id) ON DELETE CASCADE, funcionario_id INTEGER REFERENCES funcionarios(id) ON DELETE CASCADE, cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE, unidade_id INTEGER REFERENCES unidades(id) ON DELETE CASCADE, mes INTEGER NOT NULL, ano INTEGER NOT NULL, status VARCHAR(50) DEFAULT 'Pendente', data_solicitacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, carimbo_digital TEXT, caminho_pdf TEXT DEFAULT NULL)`);
        
        try { await pool.query(`ALTER TABLE assinaturas_mensais ADD COLUMN cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE`); } catch(e) { }
        try { await pool.query(`ALTER TABLE assinaturas_mensais ADD COLUMN unidade_id INTEGER REFERENCES unidades(id) ON DELETE CASCADE`); } catch(e) { }
        try { await pool.query(`ALTER TABLE assinaturas_mensais ADD COLUMN caminho_pdf TEXT DEFAULT NULL`); } catch(e) { }

        await pool.query(`CREATE TABLE IF NOT EXISTS tokens_revogados (token TEXT PRIMARY KEY, data_bloqueio TEXT)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS config_master (id INTEGER PRIMARY KEY CHECK (id = 1), razao_social TEXT, nif TEXT, morada TEXT, codigo_postal TEXT, localidade TEXT, email_faturacao TEXT, iban TEXT, texto_contrato TEXT, pin_recuperacao_hash TEXT, senha_master_hash TEXT)`);

        const hashMasterInit = await bcrypt.hash('Master360!', 10);
        const resConfig = await pool.query("SELECT COUNT(*) AS count FROM config_master");
        if (parseInt(resConfig.rows[0].count) === 0) { await pool.query(`INSERT INTO config_master (id, razao_social, nif, morada, codigo_postal, localidade, email_faturacao, iban, texto_contrato, senha_master_hash) VALUES (1, '', '', '', '', '', '', '', '', $1)`, [hashMasterInit]); }
        const resPin = await pool.query("SELECT pin_recuperacao_hash FROM config_master WHERE id = 1");
        if (resPin.rows.length > 0 && !resPin.rows[0].pin_recuperacao_hash) { const hashPin = await bcrypt.hash('Master360!', 10); await pool.query(`UPDATE config_master SET pin_recuperacao_hash = $1 WHERE id = 1`, [hashPin]); }
        const resAg = await pool.query("SELECT COUNT(*) AS count FROM agencias");
        if (parseInt(resAg.rows[0].count) === 0) { const hashAdmin = await bcrypt.hash('admin123', 10); await pool.query(`INSERT INTO agencias (nome_agencia, email, senha_hash, status) VALUES ('Agenda360 Oficial', 'admin@agenda.com', $1, 'ativo')`, [hashAdmin]); }
        console.log('⚙️ Tabelas sincronizadas.');
    } catch (err) { console.error('❌ Erro a criar tabelas PostgreSQL:', err.message); }
}

// ==========================================
// 2. MIDDLEWARE JWT E VALIDAÇÕES
// ==========================================
function verificarTokenWeb(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ erro: 'Acesso negado.' });
    const token = authHeader.split(' ')[1];

    db.get(`SELECT token FROM tokens_revogados WHERE token = ?`, [token], (err, rowRevogado) => {
        if (err) return handleError(res, err);
        if (rowRevogado) return res.status(401).json({ erro: 'Sessão terminada.' });

        jwt.verify(token, SECRET_KEY, (err, decoded) => {
            if (err) return res.status(401).json({ erro: 'Sessão expirada.' });
            if (decoded.tipo === 'trabalhador') { db.get(`SELECT status FROM funcionarios WHERE id = ?`, [decoded.id], (err, row) => { if (err || !row || row.status !== 'ativo') return res.status(401).json({ erro: 'Trabalhador inativo.' }); req.user = decoded; next(); }); } 
            else if (decoded.tipo === 'admin') { db.get(`SELECT status FROM agencias WHERE id = ?`, [decoded.id], (err, row) => { if (err || !row || row.status !== 'ativo') return res.status(401).json({ erro: 'Agência inativa.' }); req.user = decoded; next(); }); } 
            else if (decoded.tipo === 'gestor') { db.get(`SELECT g.status as gestor_status, a.status as agencia_status FROM gestores g JOIN agencias a ON g.agencia_id = a.id WHERE g.id = ?`, [decoded.id], (err, row) => { if (err || !row || row.gestor_status !== 'ativo' || row.agencia_status !== 'ativo') return res.status(401).json({ erro: 'Acesso Inativo.' }); req.user = decoded; next(); }); } 
            else { req.user = decoded; next(); }
        });
    });
}

function verificarConflito(funcionario_id, data_inicio, hora_entrada, data_fim, hora_saida, exclude_id = null) {
    return new Promise((resolve) => {
        if (!funcionario_id || funcionario_id === 'A_DEFINIR') return resolve({ conflito: false });

        let sql = `SELECT id, data_inicio, hora_entrada, data_fim, hora_saida FROM escalas WHERE funcionario_id = ? AND status_turno != 'Cancelado' AND status_turno != 'Falta'`;
        let params = [parseInt(funcionario_id, 10)];
        if (exclude_id) { sql += ` AND id != ?`; params.push(parseInt(exclude_id, 10)); }
        db.all(sql, params, (err, rows) => {
            if (err || !rows) return resolve({ conflito: false }); 
            try {
                const parseDate = (d, h) => {
                    if (!d || !h) return 0;
                    let parts = d.split('-'); let timeParts = h.split(':');
                    return new Date(parts[0], parts[1] - 1, parts[2], timeParts[0], timeParts[1]).getTime();
                };
                let novoStart = parseDate(data_inicio, hora_entrada);
                let novoEnd = parseDate(data_fim || data_inicio, hora_saida);
                if (novoStart === 0 || novoEnd === 0) return resolve({ conflito: false });
                if (novoEnd <= novoStart) novoEnd += 24 * 60 * 60 * 1000; 
                for (let row of rows) {
                    let exStart = parseDate(row.data_inicio, row.hora_entrada);
                    let exEnd = parseDate(row.data_fim || row.data_inicio, row.hora_saida);
                    if (exStart === 0 || exEnd === 0) continue;
                    if (exEnd <= exStart) exEnd += 24 * 60 * 60 * 1000;
                    if (novoStart < exEnd && exStart < novoEnd) return resolve({ conflito: true, turno: row });
                }
                resolve({ conflito: false });
            } catch(e) { resolve({ conflito: false }); }
        });
    });
}

app.get('/api/me', verificarTokenWeb, (req, res) => {
    db.get("SELECT email_faturacao FROM config_master WHERE id = 1", [], (errCfg, rowCfg) => {
        const suporteEmail = (rowCfg && rowCfg.email_faturacao) ? rowCfg.email_faturacao : 'suporte@agenda360.com';
        
        if (req.user.tipo === 'admin') {
            if (req.user.gestor_id) {
                db.get(`SELECT g.nome_gestor, g.tipo_perfil, a.ofertas_whatsapp, a.gps_nivel FROM gestores g JOIN agencias a ON g.agencia_id = a.id WHERE g.id = ?`, [req.user.gestor_id], (err, r) => {
                    res.json({ nome: (r && r.nome_gestor) ? r.nome_gestor : 'Gestor de Agência', ofertas_whatsapp: (r && r.ofertas_whatsapp !== undefined) ? r.ofertas_whatsapp : 1, gps_nivel: (r && r.gps_nivel !== undefined) ? r.gps_nivel : 2, perfil: (r && r.tipo_perfil) ? r.tipo_perfil : 'CORPORATIVO', email_suporte: suporteEmail });
                });
            } else {
                db.get(`SELECT nome_gestor, nome_agencia, ofertas_whatsapp, gps_nivel FROM agencias WHERE id = ?`, [req.user.id], (err, r) => {
                    let nomeFinal = 'Gestor de Agência'; if (r && r.nome_gestor) nomeFinal = r.nome_gestor; else if (r && r.nome_agencia) nomeFinal = `Admin (${r.nome_agencia})`;
                    res.json({ nome: nomeFinal, ofertas_whatsapp: (r && r.ofertas_whatsapp !== undefined) ? r.ofertas_whatsapp : 1, gps_nivel: (r && r.gps_nivel !== undefined) ? r.gps_nivel : 2, perfil: 'CORPORATIVO', email_suporte: suporteEmail });
                });
            }
        } else if (req.user.tipo === 'gestor') {
            db.get(`SELECT g.nome_gestor, a.ofertas_whatsapp, a.gps_nivel FROM gestores g JOIN agencias a ON g.agencia_id = a.id WHERE g.id = ?`, [req.user.gestor_id || req.user.id], (err, r) => {
                res.json({ nome: (r && r.nome_gestor) ? r.nome_gestor : 'Gestor Local', ofertas_whatsapp: (r && r.ofertas_whatsapp !== undefined) ? r.ofertas_whatsapp : 1, gps_nivel: (r && r.gps_nivel !== undefined) ? r.gps_nivel : 2, perfil: 'CLIENTE', email_suporte: suporteEmail });
            });
        } else {
            db.get(`SELECT a.gps_nivel FROM agencias a JOIN funcionarios f ON f.agencia_id = a.id WHERE f.id = ?`, [req.user.id], (err, r) => {
                res.json({ nome: 'Utilizador', ofertas_whatsapp: 0, gps_nivel: (r && r.gps_nivel !== undefined) ? r.gps_nivel : 2, perfil: 'TRABALHADOR', email_suporte: suporteEmail });
            });
        }
    });
});

app.post('/api/agencias/toggle-whatsapp', verificarTokenWeb, (req, res) => {
    if(req.user.tipo !== 'admin' || (req.user.gestor_id && req.user.perfil === 'OPERACIONAL')) return res.status(403).json({erro: 'Apenas o Administrador Mestre da Agência pode alterar esta definição.'});
    db.get(`SELECT ofertas_whatsapp FROM agencias WHERE id = ?`, [req.user.id], (err, row) => {
        if(err) return handleError(res, err);
        const novoStatus = (row && row.ofertas_whatsapp === 1) ? 0 : 1;
        db.run(`UPDATE agencias SET ofertas_whatsapp = ? WHERE id = ?`, [novoStatus, req.user.id], errUp => {
            if(errUp) return handleError(res, errUp);
            res.json({ mensagem: `Sistema de Ofertas WhatsApp ${novoStatus === 1 ? 'LIGADO' : 'DESLIGADO'} para todos os gestores!`, novo_status: novoStatus });
        });
    });
});

app.post('/api/agencias/mudar-gps', verificarTokenWeb, (req, res) => {
    if(req.user.tipo !== 'admin' || (req.user.gestor_id && req.user.perfil === 'OPERACIONAL')) return res.status(403).json({erro: 'Apenas o Administrador Mestre da Agência pode alterar esta definição.'});
    const nivel = parseInt(req.body.gps_nivel, 10);
    if (![1, 2, 3].includes(nivel)) return res.status(400).json({erro: 'Nível inválido.'});
    
    db.run(`UPDATE agencias SET gps_nivel = ? WHERE id = ?`, [nivel, req.user.id], err => {
        if(err) return handleError(res, err);
        res.json({ mensagem: `Nível de Segurança GPS alterado com sucesso para o Nível ${nivel}.` });
    });
});

app.post('/api/master/login', loginLimiter, (req, res) => { db.get(`SELECT senha_master_hash FROM config_master WHERE id = 1`, async (err, row) => { if (err) return handleError(res, err); if (!row || !row.senha_master_hash) return res.status(401).json({ erro: 'Conta Master não configurada.' }); const isMatch = await bcrypt.compare(req.body.senha, row.senha_master_hash); if (isMatch) { const token = jwt.sign({ id: 'master', tipo: 'master' }, SECRET_KEY, { expiresIn: '12h' }); res.status(200).json({ token }); } else { res.status(401).json({ erro: 'Senha Master incorreta.' }); } }); });
app.post('/api/master/recuperar-senha', loginLimiter, async (req, res) => { const { pin_seguranca, nova_senha } = req.body; if (!validarSenhaForte(nova_senha)) return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 8 caracteres, 1 Maiúscula e 1 Número.' }); db.get(`SELECT pin_recuperacao_hash FROM config_master WHERE id = 1`, async (err, row) => { if (err || !row || !row.pin_recuperacao_hash) return res.status(500).json({ erro: 'Erro interno ou PIN não configurado.' }); const isMatch = await bcrypt.compare(pin_seguranca, row.pin_recuperacao_hash); if (!isMatch) return res.status(401).json({ erro: 'PIN de Segurança inválido.' }); const hashNovaSenha = await bcrypt.hash(nova_senha, 10); db.run(`UPDATE config_master SET senha_master_hash = ? WHERE id = 1`, [hashNovaSenha], errUpdate => { if (errUpdate) return handleError(res, errUpdate); res.json({ mensagem: 'Senha Master recuperada com sucesso! Já pode fazer login.' }); }); }); });
app.put('/api/master/atualizar-senha', verificarTokenWeb, async (req, res) => { try { if(req.user.tipo !== 'master') return res.status(403).json({erro: 'Acesso negado.'}); if (!validarSenhaForte(req.body.nova_senha)) return res.status(400).json({ erro: 'Requisitos não cumpridos.' }); const hash = await bcrypt.hash(req.body.nova_senha, 10); db.run(`UPDATE config_master SET senha_master_hash = ? WHERE id = 1`, [hash], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Senha Master Atualizada com Sucesso!' }); }); } catch (err) { handleError(res, err); } });
app.get('/api/master/config', verificarTokenWeb, (req, res) => { db.get("SELECT * FROM config_master WHERE id = 1", (err, row) => { if(err) return handleError(res, err); res.json(row || {}); }); });
app.put('/api/master/config', verificarTokenWeb, (req, res) => { const d = req.body; db.run(`UPDATE config_master SET razao_social=?, nif=?, morada=?, codigo_postal=?, localidade=?, email_faturacao=?, iban=?, texto_contrato=? WHERE id=1`, [d.razao_social, d.nif, d.morada, d.codigo_postal, d.localidade, d.email_faturacao, d.iban, d.texto_contrato], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Dados atualizados!' }); }); });
app.put('/api/master/atualizar-pin', verificarTokenWeb, async (req, res) => { try { if(req.user.tipo !== 'master' && req.user.tipo !== 'admin') return res.status(403).json({erro: 'Acesso negado.'}); const novo_pin = req.body.novo_pin; if (!novo_pin || novo_pin.length < 6) return res.status(400).json({ erro: 'O PIN deve ter pelo menos 6 caracteres.' }); const hashPin = await bcrypt.hash(novo_pin, 10); db.run(`UPDATE config_master SET pin_recuperacao_hash = ? WHERE id = 1`, [hashPin], err => { if(err) return handleError(res, err); res.json({ mensagem: 'PIN de Segurança Atualizado com Sucesso!' }); }); } catch (err) { handleError(res, err); } });
app.post('/api/master/arquivamento-frio', verificarTokenWeb, async (req, res) => { if(req.user.tipo !== 'master') return res.status(403).json({erro: 'Acesso negado.'}); res.json({ mensagem: 'Protocolo de Arquivamento Frio simulado e concluído com sucesso.' }); });

app.get('/api/admin/agencias', verificarTokenWeb, (req, res) => { db.all("SELECT * FROM agencias", [], (err, rows) => { if(err) return handleError(res, err); res.json(rows); }); });
app.post('/api/admin/agencias/nova', verificarTokenWeb, async (req, res) => { try { if(req.user.tipo !== 'master') return res.status(403).json({erro: 'Acesso negado.'}); const d = req.body; const hash = await bcrypt.hash(d.senha, 10); db.run(`INSERT INTO agencias (nome_agencia, email, senha_hash, nif, rua, localidade, codigo_postal, representante_legal, cargo_representante, data_inicio_contrato, limite_base_funcionarios, valor_base_mensal, valor_extra_funcionario, valor_extra_inativo, dia_vencimento, regime_iva) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [d.nome_agencia, d.email, hash, d.nif||'', d.rua||'', d.localidade||'', d.codigo_postal||'', d.representante_legal||'', d.cargo_representante||'', d.data_inicio_contrato||'', d.limite_base_funcionarios||0, d.valor_base_mensal||0, d.valor_extra_funcionario||0, d.valor_extra_inativo||0, d.dia_vencimento||8, d.regime_iva||'+ IVA'], err => { if(err) return handleError(res, err, 'Erro: E-mail já registado.'); res.json({ mensagem: 'Agência / Empresa Cliente criada com sucesso!' }); }); } catch(err) { handleError(res, err); } });
app.put('/api/admin/agencias/:id', verificarTokenWeb, (req, res) => { if(req.user.tipo !== 'master') return res.status(403).json({erro: 'Acesso negado.'}); const d = req.body; db.run(`UPDATE agencias SET nome_agencia=?, nif=?, rua=?, localidade=?, codigo_postal=?, representante_legal=?, cargo_representante=?, data_inicio_contrato=?, limite_base_funcionarios=?, valor_base_mensal=?, valor_extra_funcionario=?, valor_extra_inativo=?, dia_vencimento=?, regime_iva=? WHERE id=?`, [d.nome_agencia, d.nif||'', d.rua||'', d.localidade||'', d.codigo_postal||'', d.representante_legal||'', d.cargo_representante||'', d.data_inicio_contrato||'', d.limite_base_funcionarios||0, d.valor_base_mensal||0, d.valor_extra_funcionario||0, d.valor_extra_inativo||0, d.dia_vencimento||8, d.regime_iva||'+ IVA', req.params.id], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Contrato atualizado com sucesso!' }); }); });
app.post('/api/admin/agencias/status', verificarTokenWeb, (req, res) => { if(req.user.tipo !== 'master') return res.status(403).json({erro: 'Acesso negado.'}); db.run("UPDATE agencias SET status = ? WHERE id = ?", [req.body.novo_status, req.body.id], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Status atualizado!' }); }); });
app.delete('/api/admin/agencias/:id', verificarTokenWeb, (req, res) => { if(req.user.tipo !== 'master') return res.status(403).json({erro: 'Acesso negado.'}); db.run(`DELETE FROM agencias WHERE id=?`, [req.params.id], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Agência Removida!' }); }); });

app.post('/api/agencias/login', loginLimiter, (req, res) => { 
    const { email, senha } = req.body; 
    db.get(`SELECT id, nome_agencia, status, senha_hash FROM agencias WHERE email = ?`, [email], async (err, row) => { 
        if (err) return handleError(res, err); 
        if (row) { 
            if (row.status !== 'ativo') return res.status(401).json({ erro: 'Acesso suspenso pelo Administrador.' }); 
            let isMatch = false; 
            if (row.senha_hash && (row.senha_hash.startsWith('$2a$') || row.senha_hash.startsWith('$2b$'))) isMatch = await bcrypt.compare(senha, row.senha_hash); 
            else { isMatch = (senha === row.senha_hash); if (isMatch) { const h = await bcrypt.hash(senha, 10); db.run(`UPDATE agencias SET senha_hash = ? WHERE id = ?`, [h, row.id]); } } 
            if (isMatch) { 
                const token = jwt.sign({ id: row.id, tipo: 'admin', perfil: 'CORPORATIVO' }, SECRET_KEY, { expiresIn: '12h' }); 
                return res.json({ mensagem: 'Login efetuado!', token, agencia_id: row.id, nome_agencia: row.nome_agencia, tipo_acesso: 'admin', unidade_id: null }); 
            } 
        } 
        
        db.get(`SELECT g.id, g.agencia_id, g.nome_gestor, g.unidade_id, g.senha_hash, g.status as gestor_status, g.senha_provisoria, g.tipo_perfil, a.nome_agencia, a.status as agencia_status FROM gestores g JOIN agencias a ON g.agencia_id = a.id WHERE g.email = ?`, [email], async (err, gRow) => { 
            if (err) return handleError(res, err); 
            if (gRow) { 
                if (gRow.agencia_status !== 'ativo' || gRow.gestor_status !== 'ativo') return res.status(401).json({ erro: 'Acesso suspenso.' }); 
                let isMatchGestor = false; 
                if (gRow.senha_hash && (gRow.senha_hash.startsWith('$2a$') || gRow.senha_hash.startsWith('$2b$'))) isMatchGestor = await bcrypt.compare(senha, gRow.senha_hash); 
                else { isMatchGestor = (senha === gRow.senha_hash); if (isMatchGestor) { const h = await bcrypt.hash(senha, 10); db.run(`UPDATE gestores SET senha_hash = ? WHERE id = ?`, [h, gRow.id]); } } 
                
                if (isMatchGestor) { 
                    if (gRow.senha_provisoria === 1) {
                        const tokenRestrito = jwt.sign({ id: gRow.id, tipo: 'restrito_gestor', email: email }, SECRET_KEY, { expiresIn: '15m' });
                        return res.json({ require_password_change: true, token_restrito: tokenRestrito, mensagem: 'Alteração obrigatória de senha inicial.' });
                    }
                    const isMasterGestor = !gRow.unidade_id;
                    const tokenTipo = isMasterGestor ? 'admin' : 'gestor';
                    const tokenID = isMasterGestor ? gRow.agencia_id : gRow.id;
                    
                    const token = jwt.sign({ id: tokenID, gestor_id: gRow.id, tipo: tokenTipo, unidade_id: gRow.unidade_id, perfil: gRow.tipo_perfil }, SECRET_KEY, { expiresIn: '12h' }); 
                    return res.json({ mensagem: 'Login efetuado!', token, agencia_id: gRow.agencia_id, nome_agencia: gRow.nome_agencia, tipo_acesso: tokenTipo, unidade_id: gRow.unidade_id }); 
                } 
            } 
            res.status(401).json({ erro: 'Credenciais inválidas.' }); 
        }); 
    }); 
}); 

app.post('/api/funcionarios/login', loginLimiter, (req, res) => { const { email, senha } = req.body; db.all(`SELECT f.id, f.nome_completo, f.senha_hash, f.status, f.senha_provisoria, a.nome_agencia FROM funcionarios f JOIN agencias a ON f.agencia_id = a.id WHERE f.email = ?`, [email], async (err, rows) => { if(err) return handleError(res, err); const ativos = rows.filter(r => r.status === 'ativo'); if(ativos.length === 0) return res.status(401).json({ erro: rows.length > 0 ? 'Conta inativa.' : 'E-mail não encontrado.' }); const user = ativos[0]; if(!user.senha_hash) return res.status(401).json({ erro: 'Sem Senha configurada.' }); const isMatch = await bcrypt.compare(senha, user.senha_hash); if (!isMatch) return res.status(401).json({ erro: 'Palavra-passe incorreta.' }); if (user.senha_provisoria === 1) return res.json({ require_password_change: true, email: email }); if (ativos.length > 1) { const perfis = ativos.map(p => ({ id: p.id, agencia: p.nome_agencia })); return res.json({ require_profile_selection: true, email: email, perfis: perfis }); } const token = jwt.sign({ id: user.id, tipo: 'trabalhador' }, SECRET_KEY, { expiresIn: '7d' }); res.json({ mensagem: 'Login!', token: token, funcionario_id: user.id, nome: user.nome_completo, nome_agencia: user.nome_agencia }); }); });
app.post('/api/funcionarios/mudar-senha-pessoal', async (req, res) => { const { email, senha_atual, nova_senha } = req.body; if(!validarSenhaForte(nova_senha)) return res.status(400).json({ erro: 'A senha deve ter pelo menos 8 caracteres, 1 Maiúscula e 1 Número.' }); db.get(`SELECT senha_hash FROM funcionarios WHERE email = ? LIMIT 1`, [email], async (err, row) => { if(err || !row) return res.status(401).json({ erro: 'Utilizador não encontrado.' }); const isMatch = await bcrypt.compare(senha_atual, row.senha_hash); if(!isMatch) return res.status(401).json({ erro: 'A senha atual está incorreta.' }); const novoHash = await bcrypt.hash(nova_senha, 10); db.run(`UPDATE funcionarios SET senha_hash = ?, senha_provisoria = 0 WHERE email = ?`, [novoHash, email], errUpdate => { if(errUpdate) return res.status(500).json({ erro: 'Erro ao gravar a nova senha.' }); res.json({ mensagem: 'Senha criada!' }); }); }); });
app.post('/api/funcionarios/selecionar-perfil', async (req, res) => { const { email, funcionario_id, senha_atual } = req.body; db.get(`SELECT f.id, f.nome_completo, f.senha_hash, a.nome_agencia FROM funcionarios f JOIN agencias a ON f.agencia_id = a.id WHERE f.email = ? AND f.id = ? AND f.status = 'ativo'`, [email, funcionario_id], async (err, row) => { if(err || !row) return res.status(401).json({ erro: 'Perfil inválido.' }); const isMatch = await bcrypt.compare(senha_atual, row.senha_hash); if(!isMatch) return res.status(401).json({ erro: 'Autenticação falhou.' }); const token = jwt.sign({ id: row.id, tipo: 'trabalhador' }, SECRET_KEY, { expiresIn: '7d' }); res.json({ token, funcionario_id: row.id, nome: row.nome_completo, nome_agencia: row.nome_agencia }); }); });
app.post('/api/funcionarios/consentimento-gps', verificarTokenWeb, (req, res) => { if (req.user.tipo !== 'trabalhador') return res.status(403).json({erro: 'Acesso negado.'}); const dAtual = new Date(); const dataHoraStr = dAtual.toLocaleDateString('pt-PT') + ' às ' + dAtual.toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'}); db.run(`UPDATE funcionarios SET consentimento_gps = ? WHERE id = ?`, [dataHoraStr, req.user.id], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Consentimento gravado digitalmente!' }); }); });
app.post('/api/logout', verificarTokenWeb, (req, res) => { const authHeader = req.headers['authorization']; if (!authHeader) return res.json({ mensagem: 'Logout executado.' }); const token = authHeader.split(' ')[1]; const dataBloqueio = new Date().toISOString(); db.run(`INSERT INTO tokens_revogados (token, data_bloqueio) VALUES (?, ?) ON CONFLICT (token) DO NOTHING`, [token, dataBloqueio], err => { if (err) return handleError(res, err); res.json({ mensagem: 'Sessão encerrada com sucesso.' }); }); });

// 📍 MÁQUINA DO TEMPO: Rota de Faturação com Filtro Histórico e Datas Explicativas
app.get('/api/master/faturacao', verificarTokenWeb, async (req, res) => {
    if(req.user.tipo !== 'master') return res.status(403).json({erro: 'Acesso negado.'});
    try {
        let targetMesStr = '';
        if (req.query.mes && req.query.ano) {
            targetMesStr = `${req.query.ano}-${String(req.query.mes).padStart(2, '0')}`;
        } else {
            const dataAtual = new Date();
            targetMesStr = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
        }
        
        const resAg = await pool.query("SELECT * FROM agencias WHERE status = 'ativo'");
        const agencias = resAg.rows;
        let faturacaoData = [];
        
        for(let ag of agencias) {
            const resF = await pool.query("SELECT id, nome_completo, status, data_inativacao FROM funcionarios WHERE agencia_id = $1", [ag.id]);
            const funcs = resF.rows;
            
            let ativosCount = 0;
            let inativosCount = 0;
            let detalheTrabalhadores = []; 
            
            funcs.forEach(f => {
                let statusCalculado = '';
                
                if (f.status === 'ativo') {
                    ativosCount++;
                    statusCalculado = 'Ativo (Ciclo Completo)';
                } else if (f.status === 'inativo') {
                    if (f.data_inativacao) {
                        const inatMesStr = f.data_inativacao.substring(0, 7);
                        // Converter YYYY-MM-DD para DD/MM/YYYY
                        const parts = f.data_inativacao.split('-');
                        const dataPT = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : f.data_inativacao;

                        if (inatMesStr >= targetMesStr) {
                            ativosCount++; 
                            statusCalculado = `Inativado a ${dataPT} (Faturado neste mês)`;
                        } else {
                            inativosCount++; 
                            statusCalculado = `Inativo desde ${dataPT} (Retenção)`;
                        }
                    } else {
                        inativosCount++;
                        statusCalculado = 'Inativo (Retenção de Histórico)';
                    }
                }
                
                if (statusCalculado) {
                    detalheTrabalhadores.push({
                        id: f.id,
                        nome: f.nome_completo,
                        estado_cobranca: statusCalculado
                    });
                }
            });
            
            let limiteBase = ag.limite_base_funcionarios || 0;
            let ativosExtraNum = ativosCount - limiteBase;
            if (ativosExtraNum < 0) ativosExtraNum = 0;
            
            let custoAtivosExtra = ativosExtraNum * (ag.valor_extra_funcionario || 0);
            let custoInativos = inativosCount * (ag.valor_extra_inativo || 0);
            let subtotal = (ag.valor_base_mensal || 0) + custoAtivosExtra + custoInativos;
            
            faturacaoData.push({
                id: ag.id, nome_agencia: ag.nome_agencia, nif: ag.nif,
                valor_base: ag.valor_base_mensal || 0,
                limite_base: limiteBase,
                ativos_totais: ativosCount, ativos_extra_num: ativosExtraNum, custo_ativos_extra: custoAtivosExtra,
                valor_extra_ativo: ag.valor_extra_funcionario || 0,
                inativos_totais: inativosCount, custo_inativos: custoInativos,
                valor_extra_inativo: ag.valor_extra_inativo || 0,
                subtotal: subtotal, regime_iva: ag.regime_iva || '+ IVA', dia_vencimento: ag.dia_vencimento || 8,
                detalhe_trabalhadores: detalheTrabalhadores 
            });
        }
        res.json(faturacaoData);
    } catch(e) { 
        console.error('[SECURITY LOG] Erro Faturação:', e.message);
        res.status(500).json({erro: 'Erro interno no cálculo da faturação.'}); 
    }
});

app.get('/api/clientes/agencia/:agencia_id', verificarTokenWeb, (req, res) => { db.all(`SELECT * FROM clientes WHERE agencia_id = ? ORDER BY nome_empresa ASC`, [parseInt(req.params.agencia_id, 10)], (err, rows) => { if(err) return handleError(res, err); res.json(rows); }); });
app.post('/api/clientes', verificarTokenWeb, async (req, res) => { const d = req.body; try { if(!d.nome_empresa) return res.status(400).json({ erro: "O nome do Grupo é obrigatório." }); await pool.query(`INSERT INTO clientes (agencia_id, nome_empresa, nif, observacoes, nome_responsavel, telefone, email) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [parseInt(d.agencia_id, 10), d.nome_empresa, d.nif || '', d.observacoes || '', d.nome_responsavel || '', d.telefone || '', d.email || '']); res.json({ mensagem: 'Grupo / Empresa criado com sucesso!' }); } catch(err) { handleError(res, err, 'Erro ao criar Grupo na base de dados.'); } });
app.put('/api/clientes/:id', verificarTokenWeb, async (req, res) => { const d = req.body; try { if(!d.nome_empresa) return res.status(400).json({ erro: "O nome do Grupo é obrigatório." }); await pool.query(`UPDATE clientes SET nome_empresa = $1, nif = $2, observacoes = $3, nome_responsavel = $4, telefone = $5, email = $6 WHERE id = $7`, [d.nome_empresa, d.nif || '', d.observacoes || '', d.nome_responsavel || '', d.telefone || '', d.email || '', parseInt(req.params.id, 10)]); res.json({ mensagem: 'Grupo atualizado!' }); } catch(err) { handleError(res, err, 'Erro al atualizar Grupo.'); } });
app.delete('/api/clientes/:id', verificarTokenWeb, (req, res) => { db.run(`DELETE FROM clientes WHERE id=?`, [parseInt(req.params.id, 10)], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Grupo apagado!' }); }); });

app.get('/api/unidades/agencia/:agencia_id', verificarTokenWeb, (req, res) => { db.all(`SELECT u.*, c.nome_empresa, c.nif as nif_empresa, c.observacoes as obs_empresa FROM unidades u JOIN clientes c ON u.cliente_id = c.id WHERE c.agencia_id = ?`, [parseInt(req.params.agencia_id, 10)], (err, rows) => { if(err) return handleError(res, err); res.json(rows); }); });
app.post('/api/unidades', verificarTokenWeb, async (req, res) => { const u = req.body; try { if (!u.cliente_id) return res.status(400).json({ erro: "Deve selecionar a que Grupo pertence esta Unidade." }); if (!u.nome_unidade) return res.status(400).json({ erro: "O nome da Unidade é obrigatório." }); await pool.query(`INSERT INTO unidades (cliente_id, nome_unidade, rua, porta, cidade, contato_nome, telefone, email, latitude, longitude, funcoes_frequentes, exige_validacao) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [parseInt(u.cliente_id, 10), u.nome_unidade, u.rua || '', '', u.cidade || '', u.contato_nome || '', u.telefone || '', u.email || '', parseFloat(u.latitude) || 0, parseFloat(u.longitude) || 0, JSON.stringify(u.funcoes_frequentes || []), u.exige_validacao ? 1 : 0]); res.json({ mensagem: 'Unidade criada com sucesso!' }); } catch(err) { handleError(res, err, 'Erro ao criar Unidade na base de dados.'); } });
app.put('/api/unidades/:id', verificarTokenWeb, (req, res) => { const d = req.body; db.run(`UPDATE unidades SET cliente_id=?, nome_unidade=?, rua=?, cidade=?, contato_nome=?, telefone=?, email=?, latitude=?, longitude=?, funcoes_frequentes=?, exige_validacao=? WHERE id=?`, [parseInt(d.cliente_id, 10), d.nome_unidade, d.rua, d.cidade, d.contato_nome, d.telefone, d.email, parseFloat(d.latitude)||0, parseFloat(d.longitude)||0, JSON.stringify(d.funcoes_frequentes), d.exige_validacao ? 1 : 0, parseInt(req.params.id, 10)], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Unidade Atualizada!' }); }); });
app.delete('/api/unidades/:id', verificarTokenWeb, (req, res) => { db.run(`DELETE FROM unidades WHERE id=?`, [parseInt(req.params.id, 10)], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Unidade Apagada!' }); }); });

app.get('/api/gestores/agencia/:agencia_id', verificarTokenWeb, (req, res) => { db.all(`SELECT g.id, g.agencia_id, g.nome_gestor, g.email, g.unidade_id, g.status, g.tipo_perfil, u.nome_unidade, c.nome_empresa FROM gestores g LEFT JOIN unidades u ON g.unidade_id = u.id LEFT JOIN clientes c ON u.cliente_id = c.id WHERE g.agencia_id = ?`, [parseInt(req.params.agencia_id, 10)], (err, rows) => { if(err) return handleError(res, err); res.json(rows); }); });
app.post('/api/gestores', verificarTokenWeb, async (req, res) => { 
    if(req.user.perfil === 'OPERACIONAL') return res.status(403).json({erro: 'Acesso Negado: Apenas Gestores Master podem criar utilizadores.'});
    try { 
        const senhaInicial = req.body.senha || 'Senha123!'; 
        const hash = await bcrypt.hash(senhaInicial, 10); 
        let tipo_perfil = req.body.unidade_id ? 'CLIENTE' : (req.body.nivel_acesso === 'OPERACIONAL' ? 'OPERACIONAL' : 'CORPORATIVO'); 
        db.run(`INSERT INTO gestores (agencia_id, nome_gestor, email, senha_hash, unidade_id, tipo_perfil, parent_id, senha_provisoria, nif) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL)`, [parseInt(req.body.agencia_id, 10), req.body.nome_gestor, req.body.email, hash, req.body.unidade_id||null, tipo_perfil, req.user.id], err => { if(err) return handleError(res, err, 'E-mail já se encontra em uso no sistema.'); res.json({ mensagem: 'Conta Adicionada!' }); }); 
    } catch (err) { handleError(res, err); } 
});
app.put('/api/gestores/:id', verificarTokenWeb, async (req, res) => { 
    if(req.user.perfil === 'OPERACIONAL') return res.status(403).json({erro: 'Acesso Negado: Apenas Gestores Master podem editar utilizadores.'});
    try { 
        let tp = req.body.unidade_id ? 'CLIENTE' : (req.body.nivel_acesso === 'OPERACIONAL' ? 'OPERACIONAL' : 'CORPORATIVO');
        if (req.body.senha) { 
            if(!validarSenhaForte(req.body.senha)) return res.status(400).json({ erro: 'Requisitos não cumpridos.' }); 
            const hash = await bcrypt.hash(req.body.senha, 10); 
            db.run(`UPDATE gestores SET nome_gestor=?, email=?, senha_hash=?, unidade_id=?, tipo_perfil=? WHERE id=?`, [req.body.nome_gestor, req.body.email, hash, req.body.unidade_id||null, tp, parseInt(req.params.id, 10)], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Gestor Atualizado!' }); }); 
        } else { 
            db.run(`UPDATE gestores SET nome_gestor=?, email=?, unidade_id=?, tipo_perfil=? WHERE id=?`, [req.body.nome_gestor, req.body.email, req.body.unidade_id||null, tp, parseInt(req.params.id, 10)], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Gestor Atualizado!' }); }); 
        } 
    } catch (err) { handleError(res, err); } 
});
app.post('/api/gestores/status', verificarTokenWeb, (req, res) => { if(req.user.perfil === 'OPERACIONAL') return res.status(403).json({erro: 'Acesso Negado.'}); db.run("UPDATE gestores SET status = ? WHERE id = ?", [req.body.novo_status, parseInt(req.body.id, 10)], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Status atualizado!' }); }); });
app.delete('/api/gestores/:id', verificarTokenWeb, (req, res) => { if(req.user.perfil === 'OPERACIONAL') return res.status(403).json({erro: 'Acesso Negado.'}); db.run(`DELETE FROM gestores WHERE id=?`, [parseInt(req.params.id, 10)], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Removido!' }); }); });
app.post('/api/gestores/mudar-senha-pessoal', async (req, res) => { const { token_restrito, nova_senha } = req.body; if (!validarSenhaForte(nova_senha)) return res.status(400).json({ erro: 'Requisitos de senha não cumpridos.' }); jwt.verify(token_restrito, SECRET_KEY, async (err, decoded) => { if (err || decoded.tipo !== 'restrito_gestor') return res.status(401).json({ erro: 'Sessão inválida.' }); const hash = await bcrypt.hash(nova_senha, 10); db.run(`UPDATE gestores SET senha_hash = ?, senha_provisoria = 0 WHERE id = ?`, [hash, decoded.id], (errUpdate) => { if (errUpdate) return handleError(res, errUpdate); res.json({ mensagem: 'Senha pessoal atualizada com sucesso!' }); }); }); });
app.post('/api/gestores/:id/repor-senha', verificarTokenWeb, (req, res) => { if(req.user.perfil === 'OPERACIONAL') return res.status(403).json({erro: 'Acesso Negado.'}); db.get(`SELECT nif FROM gestores WHERE id = ?`, [req.params.id], async (err, row) => { if (err || !row) return res.status(404).json({erro: 'Gestor não encontrado.'}); const nif = row.nif || '123456789'; const hash = await bcrypt.hash(nif, 10); db.run(`UPDATE gestores SET senha_hash = ?, senha_provisoria = 1 WHERE id = ?`, [hash, req.params.id], err => { if (err) return handleError(res, err); res.json({ mensagem: 'A senha do gestor foi reposta.' }); }); }); });

app.get('/api/funcoes/agencia/:agencia_id', verificarTokenWeb, (req, res) => { db.all(`SELECT id, nome FROM funcoes WHERE agencia_id = ? ORDER BY nome ASC`, [parseInt(req.params.agencia_id, 10)], (err, rows) => { if(err) return handleError(res, err); res.json(rows); }); });
app.post('/api/funcoes', verificarTokenWeb, (req, res) => { db.run(`INSERT INTO funcoes (agencia_id, nome) VALUES (?, ?)`, [parseInt(req.body.agencia_id, 10), req.body.nome], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Adicionada!' }); }); });
app.get('/api/funcionarios/agencia/:agencia_id', verificarTokenWeb, (req, res) => { db.all(`SELECT * FROM funcionarios WHERE agencia_id = ?`, [parseInt(req.params.agencia_id, 10)], (err, rows) => { if(err) return handleError(res, err); res.json(rows); }); });

app.post('/api/funcionarios', verificarTokenWeb, async (req, res) => { 
    try { 
        const d = req.body; 
        if (!d.nif) return res.status(400).json({ erro: 'Atenção: O NIF do trabalhador é um campo obrigatório.' }); 
        db.get(`SELECT senha_hash, senha_provisoria FROM funcionarios WHERE email = ?`, [d.email], async (err, row) => { 
            if(err) return handleError(res, err); 
            let senhaInicial = d.senha ? d.senha : d.nif; 
            let hashToUse = row ? row.senha_hash : await bcrypt.hash(senhaInicial, 10); 
            let provisoriaToUse = row ? row.senha_provisoria : 1; 
            
            db.run(`INSERT INTO funcionarios (agencia_id, nome_completo, email, telemovel, nacionalidade, idiomas, cidade, disponibilidade, funcoes_habilitadas, senha_hash, senha_provisoria, nif) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [parseInt(d.agencia_id, 10), d.nome_completo, d.email, d.telemovel, d.nacionalidade, d.idiomas, d.cidade || '', JSON.stringify(d.disponibilidade || []), JSON.stringify(d.funcoes_habilitadas), hashToUse, provisoriaToUse, d.nif], 
            function(errInsert) { 
                if(errInsert) return handleError(res, errInsert); 
                res.json({ message: row ? 'Perfil multi-empresa vinculado com sucesso!' : 'Trabalhador guardado com sucesso!' }); 
            }); 
        }); 
    } catch(err) { handleError(res, err); } 
});

app.put('/api/funcionarios/:id', verificarTokenWeb, async (req, res) => { 
    try { 
        const d = req.body; 
        if (!d.nif) return res.status(400).json({ erro: 'Atenção: O NIF do trabalhador é um campo obrigatório.' }); 
        if (d.senha) { 
            const hash = await bcrypt.hash(d.senha, 10); 
            db.run(`UPDATE funcionarios SET nome_completo=?, email=?, telemovel=?, nacionalidade=?, idiomas=?, cidade=?, disponibilidade=?, funcoes_habilitadas=?, nif=? WHERE id=?`, 
            [d.nome_completo, d.email, d.telemovel, d.nacionalidade, d.idiomas, d.cidade || '', JSON.stringify(d.disponibilidade || []), JSON.stringify(d.funcoes_habilitadas), d.nif, parseInt(req.params.id, 10)], 
            (err) => { 
                if(err) return handleError(res, err); 
                db.run(`UPDATE funcionarios SET senha_hash=?, senha_provisoria=1 WHERE email=?`, [hash, d.email], (err2) => { 
                    if(err2) return handleError(res, err2); res.json({ message: 'Ficha e Senha Provisória forçadas com sucesso!' }); 
                }); 
            }); 
        } else { 
            db.run(`UPDATE funcionarios SET nome_completo=?, email=?, telemovel=?, nacionalidade=?, idiomas=?, cidade=?, disponibilidade=?, funcoes_habilitadas=?, nif=? WHERE id=?`, 
            [d.nome_completo, d.email, d.telemovel, d.nacionalidade, d.idiomas, d.cidade || '', JSON.stringify(d.disponibilidade || []), JSON.stringify(d.funcoes_habilitadas), d.nif, parseInt(req.params.id, 10)], 
            err => { 
                if(err) return handleError(res, err); res.json({ message: 'Atualizada com sucesso!' }); 
            }); 
        } 
    } catch(err) { handleError(res, err); } 
});

app.post('/api/funcionarios/status', verificarTokenWeb, (req, res) => { 
    const novo_status = req.body.novo_status;
    const dataInat = (novo_status === 'inativo') ? new Date().toISOString().split('T')[0] : null;
    
    db.run("UPDATE funcionarios SET status = ?, data_inativacao = ? WHERE id = ?", [novo_status, dataInat, parseInt(req.body.id, 10)], err => { 
        if(err) return handleError(res, err); 
        res.json({ mensagem: 'Status atualizado!' }); 
    }); 
});

app.delete('/api/funcionarios/:id', verificarTokenWeb, async (req, res) => { const funcIdInt = parseInt(req.params.id, 10); const funcIdStr = String(req.params.id); try { const escalhasRow = await pool.query(`SELECT COUNT(*) as total FROM escalas WHERE funcionario_id = $1 OR CAST(funcionario_id AS VARCHAR) = $2`, [funcIdInt, funcIdStr]); const assinaturasRow = await pool.query(`SELECT COUNT(*) as total FROM assinaturas_mensais WHERE funcionario_id = $1 OR CAST(funcionario_id AS VARCHAR) = $2`, [funcIdInt, funcIdStr]); const escalasCount = parseInt(escalhasRow.rows[0].total); const assinaturasCount = parseInt(assinaturasRow.rows[0].total); if (escalasCount > 0 || assinaturasCount > 0) { return res.status(403).json({ erro: `Atenção: Este trabalhador possui histórico laboral (${escalasCount} turnos). Por exigência legal da ACT (retenção por 5 anos), a ficha não pode ser eliminada.` }); } db.run(`DELETE FROM funcionarios WHERE id=?`, [funcIdInt], errDel => { if(errDel) return handleError(res, errDel); res.json({ mensagem: 'Ficha apagada com sucesso!' }); }); } catch (error) { handleError(res, error); } });

app.get('/api/escalas/agencia/:agencia_id', verificarTokenWeb, (req, res) => { 
    let sql = `SELECT e.*, f.nome_completo as nome_func, u.nome_unidade, c.nome_empresa,
               ROUND(EXTRACT(EPOCH FROM (e.timestamp_fim_pausa - e.timestamp_inicio_pausa))/60) as minutos_pausa_realizados,
               (ROUND(EXTRACT(EPOCH FROM (e.timestamp_fim_pausa - e.timestamp_inicio_pausa))/60) - e.minutos_pausa) as pausa_diferenca,
               CASE 
                 WHEN e.timestamp_inicio_pausa IS NOT NULL AND e.timestamp_fim_pausa IS NULL THEN 'Pausa em Aberto'
                 WHEN e.timestamp_fim_pausa IS NULL THEN 'Sem Pausa'
                 WHEN (ROUND(EXTRACT(EPOCH FROM (e.timestamp_fim_pausa - e.timestamp_inicio_pausa))/60) - e.minutos_pausa) > 0 THEN 'Excedido'
                 WHEN (ROUND(EXTRACT(EPOCH FROM (e.timestamp_fim_pausa - e.timestamp_inicio_pausa))/60) - e.minutos_pausa) < 0 THEN 'Abaixo'
                 ELSE 'Cumprido' 
               END as pausa_status_flag
               FROM escalas e 
               LEFT JOIN funcionarios f ON e.funcionario_id = f.id 
               JOIN unidades u ON e.unidade_id = u.id 
               JOIN clientes c ON u.cliente_id = c.id 
               WHERE c.agencia_id = ?`;
    let params = [parseInt(req.params.agencia_id, 10)];
    
    if (req.query.mes && req.query.ano) {
        sql += ` AND e.data_inicio LIKE ?`;
        params.push(`${req.query.ano}-${String(req.query.mes).padStart(2, '0')}-%`);
    }
    
    sql += ` ORDER BY e.data_inicio DESC`;
    
    db.all(sql, params, (err, rows) => { 
        if(err) return handleError(res, err); res.json(rows); 
    }); 
});

app.get('/api/escalas/funcionario/:id', verificarTokenWeb, (req, res) => { 
    db.get(`SELECT f.nome_completo, a.nome_agencia FROM funcionarios f JOIN agencias a ON f.agencia_id = a.id WHERE f.id = ?`, [parseInt(req.params.id, 10)], (err, userRow) => { 
        if (err || !userRow) return res.status(404).json({ erro: 'Trabalhador não encontrado.' }); 
        
        let sql = `SELECT e.*, u.nome_unidade, u.rua, u.porta, u.cidade, u.latitude, u.longitude,
                   ROUND(EXTRACT(EPOCH FROM (e.timestamp_fim_pausa - e.timestamp_inicio_pausa))/60) as minutos_pausa_realizados,
                   (ROUND(EXTRACT(EPOCH FROM (e.timestamp_fim_pausa - e.timestamp_inicio_pausa))/60) - e.minutos_pausa) as pausa_diferenca,
                   CASE 
                     WHEN e.timestamp_inicio_pausa IS NOT NULL AND e.timestamp_fim_pausa IS NULL THEN 'Pausa em Aberto'
                     WHEN e.timestamp_fim_pausa IS NULL THEN 'Sem Pausa'
                     WHEN (ROUND(EXTRACT(EPOCH FROM (e.timestamp_fim_pausa - e.timestamp_inicio_pausa))/60) - e.minutos_pausa) > 0 THEN 'Excedido'
                     WHEN (ROUND(EXTRACT(EPOCH FROM (e.timestamp_fim_pausa - e.timestamp_inicio_pausa))/60) - e.minutos_pausa) < 0 THEN 'Abaixo'
                     ELSE 'Cumprido' 
                   END as pausa_status_flag
                   FROM escalas e JOIN unidades u ON e.unidade_id = u.id WHERE e.funcionario_id = ?`;
        let params = [parseInt(req.params.id, 10)];
        
        if (req.query.mes && req.query.ano) {
            sql += ` AND e.data_inicio LIKE ?`;
            params.push(`${req.query.ano}-${String(req.query.mes).padStart(2, '0')}-%`);
        }
        
        sql += ` ORDER BY e.data_inicio ASC`;
        
        db.all(sql, params, (err2, rows) => { 
            if(err2) return handleError(res, err2); res.json({ nome_func: userRow.nome_completo, nome_agencia: userRow.nome_agencia, escalas: rows }); 
        }); 
    }); 
});

function calcularDiscriminacaoHoras(dataInicio, checkinReal, dataFim, checkoutReal, tsInicioPausa, tsFimPausa) {
    if (!checkinReal || !checkoutReal) {
        return { horas_normais: 0.00, horas_noturnas: 0.00, horas_extras: 0.00 };
    }
    
    let [hIn, mIn] = checkinReal.split(':').map(Number);
    let [hOut, mOut] = checkoutReal.split(':').map(Number);
    
    let dtInicio = new Date(`${dataInicio}T${String(hIn).padStart(2,'0')}:${String(mIn).padStart(2,'0')}:00`);
    let dtFim = new Date(`${dataFim || dataInicio}T${String(hOut).padStart(2,'0')}:${String(mOut).padStart(2,'0')}:00`);
    if (dtFim < dtInicio) {
        dtFim.setDate(dtFim.getDate() + 1);
    }

    let minPausa = 0;
    if (tsInicioPausa && tsFimPausa) {
        let pIn = new Date(tsInicioPausa);
        let pOut = new Date(tsFimPausa);
        if (pOut > pIn) {
            minPausa = Math.round((pOut - pIn) / (1000 * 60));
        }
    }

    let totalMinutosTrabalhados = Math.max(0, Math.round((dtFim - dtInicio) / (1000 * 60)) - minPausa);
    
    let minNoturnos = 0;
    let atual = new Date(dtInicio);
    while (atual < dtFim) {
        let horaAtual = atual.getHours();
        if (horaAtual >= 22 || horaAtual < 7) {
            minNoturnos++;
        }
        atual.setMinutes(atual.getMinutes() + 1);
    }
    if (minPausa > 0 && totalMinutosTrabalhados > 0) {
        minNoturnos = Math.max(0, minNoturnos - Math.min(minNoturnos, minPausa));
    }

    let horasNoturnas = Number((minNoturnos / 60).toFixed(2));
    let horasNormais = Number(Math.min(8.0, totalMinutosTrabalhados / 60).toFixed(2));
    let horasExtras = Number(Math.max(0.0, (totalMinutosTrabalhados / 60) - 8.0).toFixed(2));

    return { horas_normais: horasNormais, horas_noturnas: horasNoturnas, horas_extras: horasExtras };
}

const travaAgendamento = new Set(); 
app.post('/api/escalas', verificarTokenWeb, async (req, res) => {
    const d = req.body; 
    if(!d.unidade_id || !d.funcionario_id) return res.status(400).json({ erro: 'Unidade e Funcionário são obrigatórios.' });

    const lockKey = `${d.funcionario_id}-${d.data_inicio}`;
    if (travaAgendamento.has(lockKey)) return res.status(429).json({ erro: 'A processar agendamento. Aguarde.' });
    travaAgendamento.add(lockKey);
    try {
        const tsInPausa = d.timestamp_inicio_pausa || null;
        const tsFimPausa = d.timestamp_fim_pausa || null;
        const s_id = d.solicitacao_id || null;
        let dataFimCalculada = d.data_inicio; 
        
        if (d.hora_saida && d.hora_entrada && d.hora_saida < d.hora_entrada) { 
            let parts = d.data_inicio.split('-'); let dateObj = new Date(parts[0], parts[1] - 1, parts[2]); dateObj.setDate(dateObj.getDate() + 1); 
            let month = String(dateObj.getMonth() + 1).padStart(2, '0'); let day = String(dateObj.getDate()).padStart(2, '0'); 
            dataFimCalculada = `${dateObj.getFullYear()}-${month}-${day}`; 
        }
        
        const check = await verificarConflito(d.funcionario_id, d.data_inicio, d.hora_entrada, dataFimCalculada, d.hora_saida);
        if (check.conflito) {
            travaAgendamento.delete(lockKey);
            return res.status(409).json({ erro: `Bloqueado pela Segurança: O trabalhador já tem um turno sobreposto e não pode estar em dois sítios ao mesmo tempo.` });
        }
        
        const funcIdParaDB = (!d.funcionario_id || d.funcionario_id === 'A_DEFINIR') ? null : parseInt(d.funcionario_id, 10);
        const statusReal = (funcIdParaDB === null) ? 'Pendente' : 'Agendado'; 
        
        db.run(`INSERT INTO escalas (unidade_id, funcionario_id, funcao, data_inicio, hora_entrada, data_fim, hora_saida, tem_pausa, minutos_pausa, timestamp_inicio_pausa, timestamp_fim_pausa, solicitacao_id, status_turno, tipo_ausencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [parseInt(d.unidade_id, 10), funcIdParaDB, d.funcao, d.data_inicio, d.hora_entrada, dataFimCalculada, d.hora_saida, d.tem_pausa ? 1 : 0, parseInt(d.minutos_pausa) || 0, tsInPausa, tsFimPausa, s_id, statusReal, d.tipo_ausencia || null], err => { 
            travaAgendamento.delete(lockKey);
            if (err) return handleError(res, err); 
            res.json({ mensagem: 'Agendado!' }); 
        });
    } catch(err) { travaAgendamento.delete(lockKey); handleError(res, err); } 
});

app.put('/api/escalas/:id', verificarTokenWeb, async (req, res) => {
    const d = req.body; 
    if(!d.unidade_id || !d.funcionario_id) return res.status(400).json({ erro: 'Unidade e Funcionário são obrigatórios.' });

    const lockKey = `${d.funcionario_id}-${d.data_inicio}-edit`;
    if (travaAgendamento.has(lockKey)) return res.status(429).json({ erro: 'A processar edição. Aguarde.' });
    travaAgendamento.add(lockKey);
    try {
        const tsInPausa = d.timestamp_inicio_pausa || null;
        const tsFimPausa = d.timestamp_fim_pausa || null;
        const funcIdParaDB = (!d.funcionario_id || d.funcionario_id === 'A_DEFINIR') ? null : parseInt(d.funcionario_id, 10);
        
        let s = d.status_turno || 'Agendado'; 
        if (s !== 'Falta' && s !== 'Cancelado' && s !== 'Pendente') { 
            if (d.checkin_real && d.checkout_real) s = 'Concluído'; 
            else if (d.checkin_real && !d.checkout_real) s = 'Em curso'; 
            else s = 'Agendado'; 
        }
        
        if (funcIdParaDB === null && s !== 'Cancelado') s = 'Pendente';
        
        let dataFimCalculada = d.data_inicio; 
        if (d.hora_saida && d.hora_entrada && d.hora_saida < d.hora_entrada) { 
            let parts = d.data_inicio.split('-'); let dateObj = new Date(parts[0], parts[1] - 1, parts[2]); dateObj.setDate(dateObj.getDate() + 1); 
            let month = String(dateObj.getMonth() + 1).padStart(2, '0'); let day = String(dateObj.getDate()).padStart(2, '0'); 
            dataFimCalculada = `${dateObj.getFullYear()}-${month}-${day}`; 
        }
        
        const check = await verificarConflito(d.funcionario_id, d.data_inicio, d.hora_entrada, dataFimCalculada, d.hora_saida, parseInt(req.params.id, 10));
        if (check.conflito) {
            travaAgendamento.delete(lockKey);
            return res.status(409).json({ erro: `Bloqueado pela Segurança: O trabalhador já tem um turno sobreposto e não pode estar em dois sítios ao mesmo tempo.` });
        }

        const existing = await new Promise((resolve, reject) => {
            db.get(`SELECT funcionario_id, status_turno, timestamp_inicio_pausa, timestamp_fim_pausa, checkin_real FROM escalas WHERE id = ?`, [parseInt(req.params.id, 10)], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });
        
        if (existing) {
            if (existing.status_turno === 'Cancelado') {
                travaAgendamento.delete(lockKey);
                return res.status(409).json({ erro: 'Conflito de Concorrência: Este turno já foi apagado ou cancelado por outro utilizador. Atualize a página.' });
            }
            if ((existing.status_turno === 'Concluído' || existing.status_turno === 'A Aguardar Validação') && existing.funcionario_id !== funcIdParaDB) {
                travaAgendamento.delete(lockKey);
                return res.status(409).json({ erro: 'Conflito de Segurança: Não é possível substituir o trabalhador num turno que já foi realizado ou que aguarda validação.' });
            }
        }
        
        let finalTsInPausa = existing ? existing.timestamp_inicio_pausa : null;
        let finalTsFimPausa = existing ? existing.timestamp_fim_pausa : null;

        if (d.hora_inicio_pausa) {
            let pDtIn = new Date(`${d.data_inicio}T${d.hora_inicio_pausa}:00`);
            let baseIn = new Date(`${d.data_inicio}T${d.hora_entrada || '00:00'}:00`);
            if (pDtIn < baseIn) pDtIn.setDate(pDtIn.getDate() + 1);
            finalTsInPausa = pDtIn.toISOString();
        } else if (d.hora_inicio_pausa === '') {
            finalTsInPausa = null;
        }

        if (d.hora_fim_pausa) {
            let pDtFim = new Date(`${d.data_inicio}T${d.hora_fim_pausa}:00`);
            let baseIn = new Date(`${d.data_inicio}T${d.hora_entrada || '00:00'}:00`);
            if (pDtFim < baseIn) pDtFim.setDate(pDtFim.getDate() + 1);
            if (finalTsInPausa && pDtFim < new Date(finalTsInPausa)) {
                pDtFim.setDate(pDtFim.getDate() + 1);
            }
            finalTsFimPausa = pDtFim.toISOString();
        } else if (d.hora_fim_pausa === '') {
            finalTsFimPausa = null;
        }
        
        const calc = calcularDiscriminacaoHoras(d.data_inicio, d.checkin_real, dataFimCalculada, d.checkout_real, finalTsInPausa, finalTsFimPausa);
        
        db.run(`UPDATE escalas SET unidade_id=?, funcionario_id=?, funcao=?, data_inicio=?, hora_entrada=?, data_fim=?, hora_saida=?, tem_pausa=?, minutos_pausa=?, timestamp_inicio_pausa=?, timestamp_fim_pausa=?, checkin_real=?, checkout_real=?, status_turno=?, horas_normais=?, horas_noturnas=?, horas_extras=?, tipo_ausencia=? WHERE id=?`, 
        [parseInt(d.unidade_id, 10), funcIdParaDB, d.funcao, d.data_inicio, d.hora_entrada, dataFimCalculada, d.hora_saida, d.tem_pausa ? 1 : 0, parseInt(d.minutos_pausa) || 0, finalTsInPausa, finalTsFimPausa, d.checkin_real||null, d.checkout_real||null, s, calc.horas_normais, calc.horas_noturnas, calc.horas_extras, d.tipo_ausencia||null, parseInt(req.params.id, 10)], err => { 
            travaAgendamento.delete(lockKey);
            if (err) return handleError(res, err); 
            res.json({ mensagem: 'Atualizado!' }); 
        });
    } catch(err) { travaAgendamento.delete(lockKey); handleError(res, err); } 
});

app.delete('/api/escalas/:id', verificarTokenWeb, (req, res) => { 
    db.get(`SELECT checkin_real FROM escalas WHERE id = ?`, [parseInt(req.params.id, 10)], (err, row) => { 
        if (err) return handleError(res, err); 
        if (row && row.checkin_real) { 
            return res.status(403).json({ erro: 'Atenção: Este turno já possui registo de ponto. Utilize o botão "Acerto" para alterar o seu estado para Cancelado ou Falta.' }); 
        } 
        db.run(`UPDATE escalas SET status_turno = 'Cancelado', funcionario_id = NULL WHERE id=?`, [parseInt(req.params.id, 10)], errDel => { 
            if(errDel) return handleError(res, errDel); 
            res.json({ mensagem: 'Turno cancelado com sucesso (Soft Delete).' }); 
        }); 
    }); 
});

app.post('/api/escalas/ponto', verificarTokenWeb, (req, res) => { 
    const { escala_id, tipo, controlo_gps } = req.body; 
    const horaPT = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); 
    const txtGps = controlo_gps || 'Não verificado'; 
    db.get(`SELECT e.data_inicio, e.data_fim, e.hora_entrada, e.hora_saida, e.checkin_real, e.timestamp_inicio_pausa, e.timestamp_fim_pausa, u.exige_validacao FROM escalas e JOIN unidades u ON e.unidade_id = u.id WHERE e.id = ?`, [parseInt(escala_id, 10)], (err, turno) => { 
        if (err || !turno) return handleError(res, err, 'Turno não encontrado.'); 
        if (tipo === 'entrada') { 
            const lisboaTimeStr = new Date().toLocaleString("en-US", {timeZone: "Europe/Lisbon"}); 
            const agoraLisboa = new Date(lisboaTimeStr); 
            let parts = turno.data_inicio.split('-'); 
            let timeParts = turno.hora_entrada.split(':'); 
            let dataTurnoObjeto = new Date(parts[0], parts[1] - 1, parts[2], timeParts[0], timeParts[1]); 
            const diffMinutos = (dataTurnoObjeto - agoraLisboa) / (1000 * 60); 
            if (diffMinutos > 15) return res.status(403).json({ erro: 'Acesso Recusado. Só pode registar a entrada 15 minutos antes da hora prevista.' }); 
            db.run(`UPDATE escalas SET checkin_real = ?, controlo_gps = ? WHERE id = ?`, [horaPT, 'Entrada: ' + txtGps, parseInt(escala_id, 10)], errUpdate => { 
                if(errUpdate) return handleError(res, errUpdate); 
                res.json({ mensagem: 'Registado!' }); 
            }); 
        } else if (tipo === 'inicio_pausa') {
            const agoraISO = req.body.timestamp || new Date().toISOString();
            db.run(`UPDATE escalas SET timestamp_inicio_pausa = ?, tem_pausa = 1, controlo_gps = ? WHERE id = ?`, [agoraISO, 'Pausa Início: ' + txtGps, parseInt(escala_id, 10)], errUpdate => {
                if(errUpdate) return handleError(res, errUpdate); 
                res.json({ mensagem: 'Início de pausa cronometrado!' });
            });
        } else if (tipo === 'fim_pausa') {
            const agoraISO = req.body.timestamp || new Date().toISOString();
            db.run(`UPDATE escalas SET timestamp_fim_pausa = ?, controlo_gps = ? WHERE id = ?`, [agoraISO, 'Pausa Fim: ' + txtGps, parseInt(escala_id, 10)], errUpdate => {
                if(errUpdate) return handleError(res, errUpdate); 
                res.json({ mensagem: 'Fim de pausa cronometrado!' });
            });
        } else { 
            let novoStatus = turno.exige_validacao === 1 ? 'A Aguardar Validação' : 'Concluído'; 
            let fimPausaEfetivo = turno.timestamp_fim_pausa;
            if (turno.timestamp_inicio_pausa && !fimPausaEfetivo) {
                fimPausaEfetivo = req.body.timestamp || new Date().toISOString();
            }
            const calc = calcularDiscriminacaoHoras(turno.data_inicio, turno.checkin_real || horaPT, turno.data_fim || turno.data_inicio, horaPT, turno.timestamp_inicio_pausa, fimPausaEfetivo);
            let query = `UPDATE escalas SET checkout_real = ?, status_turno = ?, controlo_gps = ?, horas_normais = ?, horas_noturnas = ?, horas_extras = ?, timestamp_fim_pausa = COALESCE(timestamp_fim_pausa, ?) WHERE id = ?`; 
            let params = [horaPT, novoStatus, 'Saída: ' + txtGps, calc.horas_normais, calc.horas_noturnas, calc.horas_extras, fimPausaEfetivo, parseInt(escala_id, 10)]; 
            db.run(query, params, errUpdate => { 
                if (errUpdate) return handleError(res, errUpdate); 
                res.json({ mensagem: 'Registado com sucesso!', status_final: novoStatus }); 
            }); 
        } 
    }); 
});

app.post('/api/escalas/ausencia', verificarTokenWeb, async (req, res) => {
    const { funcionario_id, unidade_id, data_inicio, data_fim, tipo_ausencia, obs } = req.body;
    if (!funcionario_id || !data_inicio || !tipo_ausencia) {
        return res.status(400).json({ erro: 'Funcionário, data e tipo de ausência (F, Férias, Baixa, Falta) são obrigatórios.' });
    }
    const unId = unidade_id ? parseInt(unidade_id, 10) : 0;
    const statusAusencia = (tipo_ausencia === 'Falta') ? 'Falta' : 'Ausencia_Justificada';
    
    db.run(`INSERT INTO escalas (unidade_id, funcionario_id, funcao, data_inicio, hora_entrada, data_fim, hora_saida, status_turno, tipo_ausencia, obs_cliente, horas_normais, horas_noturnas, horas_extras) VALUES (?, ?, ?, ?, '00:00', ?, '00:00', ?, ?, ?, 0.00, 0.00, 0.00)`,
    [unId, parseInt(funcionario_id, 10), `Ausência: ${tipo_ausencia}`, data_inicio, data_fim || data_inicio, statusAusencia, tipo_ausencia, obs || 'Registo de Ausência'], err => {
        if (err) return handleError(res, err);
        res.json({ mensagem: `Ausência (${tipo_ausencia}) registada com sucesso!` });
    });
});
app.put('/api/escalas/:id/validar-cliente', verificarTokenWeb, (req, res) => { if(req.user.tipo !== 'gestor' && req.user.tipo !== 'admin' && req.user.tipo !== 'master') return res.status(403).json({erro: 'Sem permissão.'}); const obs = req.body.obs_cliente || ''; db.run(`UPDATE escalas SET validado_cliente = 1, obs_cliente = ?, status_turno = 'Concluído' WHERE id = ?`, [obs, parseInt(req.params.id, 10)], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Turno validado pelo cliente com sucesso!' }); }); });

app.get('/api/escalas/vaga/:id', verificarTokenWeb, (req, res) => {
    const escalaId = parseInt(req.params.id, 10);
    const query = `
        SELECT e.*, u.nome_unidade, u.rua, u.cidade 
        FROM escalas e
        LEFT JOIN unidades u ON e.unidade_id = u.id
        WHERE e.id = ?
    `;
    
    db.get(query, [escalaId], (err, row) => {
        if (err) return handleError(res, err, 'Erro ao consultar a base de dados.');
        if (!row) return res.status(404).json({ erro: 'Vaga inexistente.', status_turno: 'Fechada' });
        res.json(row);
    });
});

app.get('/api/escalas/lote/:ids', verificarTokenWeb, (req, res) => {
    const idsString = req.params.ids;
    const idArray = idsString.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (idArray.length === 0) return res.status(400).json({ erro: 'IDs de lote inválidos.' });
    const placeholders = idArray.map((_, i) => `$${i + 1}`).join(',');
    
    const query = `
        SELECT e.*, u.nome_unidade, u.rua, u.cidade 
        FROM escalas e
        LEFT JOIN unidades u ON e.unidade_id = u.id
        WHERE e.id IN (${placeholders})
        ORDER BY e.data_inicio ASC
    `;
    db.all(query.replace(/\$[0-9]+/g, '?'), idArray, (err, rows) => {
        if (err) return handleError(res, err, 'Erro ao consultar o lote.');
        if (!rows || rows.length === 0) return res.status(404).json({ erro: 'Nenhuma vaga encontrada para este lote.' });
        res.json(rows);
    });
});

app.post('/api/escalas/vaga/:id/aceitar', verificarTokenWeb, (req, res) => {
    if (req.user.tipo !== 'trabalhador') return res.status(403).json({ erro: 'Apenas trabalhadores podem aceitar vagas.' });
    
    const escalaId = parseInt(req.params.id, 10);
    const funcId = parseInt(req.user.id, 10);
    
    db.get(`SELECT data_inicio, hora_entrada, data_fim, hora_saida FROM escalas WHERE id = ? AND status_turno = 'Pendente'`, [escalaId], async (err, turno) => {
        if (err) return handleError(res, err, 'Erro ao verificar a vaga.');
        if (!turno) return res.status(400).json({ erro: 'Muito lento! A vaga acabou de ser preenchida por outro colega ou foi cancelada.' });
        
        const check = await verificarConflito(funcId, turno.data_inicio, turno.hora_entrada, turno.data_fim, turno.hora_saida);
        if (check.conflito) return res.status(409).json({ erro: 'Bloqueado: Você já tem um turno agendado que se sobrepõe a este horário!' });
        
        const queryUpdate = `UPDATE escalas SET funcionario_id = ?, status_turno = 'Agendado' WHERE id = ? AND status_turno = 'Pendente' RETURNING id`;
        db.get(queryUpdate, [funcId, escalaId], (errUp, row) => {
            if (errUp) return handleError(res, errUp, 'Erro ao processar aceitação.');
            if (!row) return res.status(400).json({ erro: 'Muito lento! A vaga acabou de ser preenchida por outro colega.' });
            res.json({ mensagem: 'Turno aceite e garantido com sucesso!' });
        });
    });
});

app.post('/api/escalas/lote/aceitar', verificarTokenWeb, async (req, res) => {
    if (req.user.tipo !== 'trabalhador') return res.status(403).json({ erro: 'Apenas trabalhadores podem aceitar vagas.' });
    
    const arrayEscalaIds = req.body.ids;
    const funcId = parseInt(req.user.id, 10);
    if (!Array.isArray(arrayEscalaIds) || arrayEscalaIds.length === 0) return res.status(400).json({ erro: 'Nenhum turno selecionado no carrinho.' });

    let sucessos = [];
    let falhas = [];

    for (let id of arrayEscalaIds) {
        let escalaId = parseInt(id, 10);
        try {
            const resultadoIndividual = await new Promise((resolve, reject) => {
                db.get(`SELECT data_inicio, hora_entrada, data_fim, hora_saida FROM escalas WHERE id = ? AND status_turno = 'Pendente'`, [escalaId], async (err, turno) => {
                    if (err) return resolve({ sucesso: false, erro: 'Falha na BD.' });
                    if (!turno) return resolve({ sucesso: false, erro: 'Já preenchido.' });
                    
                    const check = await verificarConflito(funcId, turno.data_inicio, turno.hora_entrada, turno.data_fim, turno.hora_saida);
                    if (check.conflito) return resolve({ sucesso: false, erro: 'Conflito de Horário.' });
                    
                    const queryUpdate = `UPDATE escalas SET funcionario_id = ?, status_turno = 'Agendado' WHERE id = ? AND status_turno = 'Pendente' RETURNING id`;
                    db.get(queryUpdate, [funcId, escalaId], (errUp, row) => {
                        if (errUp) return resolve({ sucesso: false, erro: 'Erro na Tranca.' });
                        if (!row) return resolve({ sucesso: false, erro: 'Perdeu a corrida.' });
                        resolve({ sucesso: true, data: turno.data_inicio }); 
                    });
                });
            });

            if (resultadoIndividual.sucesso) { sucessos.push(resultadoIndividual.data); } 
            else { falhas.push(resultadoIndividual.erro); }
        } catch (e) { falhas.push('Erro inesperado.'); }
    }

    res.json({ mensagem: 'Processamento do Carrinho concluído.', sucessos_qtd: sucessos.length, falhas_qtd: falhas.length, dias_ganhos: sucessos });
});

app.get('/api/relatorios/agencia/:agencia_id', verificarTokenWeb, (req, res) => { 
    let sql = `SELECT e.*, f.nome_completo as nome_func, u.nome_unidade, u.rua as morada_unidade, u.cidade as cidade_unidade, c.nome_empresa 
               FROM escalas e 
               LEFT JOIN funcionarios f ON e.funcionario_id = f.id 
               JOIN unidades u ON e.unidade_id = u.id 
               JOIN clientes c ON u.cliente_id = c.id 
               WHERE c.agencia_id = ?`; 
    let params = [parseInt(req.params.agencia_id, 10)]; 
    if (req.query.unidade_id && req.query.unidade_id !== 'null' && req.query.unidade_id !== '0') { sql += ` AND e.unidade_id = ?`; params.push(parseInt(req.query.unidade_id, 10)); } 
    if (req.query.mes && req.query.ano) { sql += ` AND e.data_inicio LIKE ?`; params.push(`${req.query.ano}-${String(req.query.mes).padStart(2, '0')}-%`); }
    sql += ` ORDER BY e.data_inicio DESC`; 
    db.all(sql, params, (err, rows) => { if (err) return handleError(res, err); res.json(rows); }); 
});

app.post('/api/solicitacoes', verificarTokenWeb, (req, res) => { 
    const d = req.body; 
    const dPedido = new Date().toISOString(); 
    
    const dataHojeStr = dPedido.slice(0, 10);
    if (d.data_inicio < dataHojeStr) {
        return res.status(400).json({ erro: "Operação Bloqueada (Backend): Não é permitido criar pedidos B2B para datas que já passaram." });
    }

    db.run(`INSERT INTO solicitacoes_extra (agencia_id, unidade_id, funcao, data_inicio, hora_entrada, hora_saida, quantidade, tem_pausa, minutos_pausa, status, data_pedido) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendente', ?)`, 
    [parseInt(d.agencia_id, 10), parseInt(d.unidade_id, 10), d.funcao, d.data_inicio, d.hora_entrada, d.hora_saida, parseInt(d.quantidade) || 1, d.tem_pausa, parseInt(d.minutos_pausa) || 0, dPedido], function(err) { 
        if(err) return handleError(res, err); 
        res.json({ mensagem: 'O pedido de Extras foi enviado com sucesso para a Agência!' }); 
    }); 
});

app.get('/api/solicitacoes/agencia/:agencia_id', verificarTokenWeb, (req, res) => { 
    let sql = `SELECT s.*, u.nome_unidade, c.nome_empresa, COALESCE((SELECT COUNT(id) FROM escalas WHERE solicitacao_id = s.id AND status_turno NOT IN ('Cancelado', 'Falta')), 0) as alocados FROM solicitacoes_extra s JOIN unidades u ON s.unidade_id = u.id JOIN clientes c ON u.cliente_id = c.id WHERE s.agencia_id = ?`;
    let params = [parseInt(req.params.agencia_id, 10)];
    if (req.query.mes && req.query.ano) { sql += ` AND s.data_inicio LIKE ?`; params.push(`${req.query.ano}-${String(req.query.mes).padStart(2, '0')}-%`); }
    sql += ` ORDER BY s.data_inicio ASC, s.id DESC`;
    db.all(sql, params, (err, rows) => { if(err) return handleError(res, err); res.json(rows); }); 
});

app.get('/api/solicitacoes/:id/trabalhadores', verificarTokenWeb, (req, res) => { const s_id = parseInt(req.params.id); db.all(`SELECT f.nome_completo, e.status_turno FROM escalas e JOIN funcionarios f ON e.funcionario_id = f.id WHERE e.solicitacao_id = ? AND e.status_turno NOT IN ('Cancelado', 'Falta')`, [s_id], (err, rows) => { if(err) return handleError(res, err); res.json(rows); }); });
app.put('/api/solicitacoes/:id/status', verificarTokenWeb, (req, res) => { db.run(`UPDATE solicitacoes_extra SET status = ? WHERE id = ?`, [req.body.novo_status, parseInt(req.params.id, 10)], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Status do Pedido atualizado!' }); }); });
app.delete('/api/solicitacoes/:id', verificarTokenWeb, (req, res) => { db.run(`UPDATE solicitacoes_extra SET status = 'Cancelado' WHERE id = ?`, [parseInt(req.params.id, 10)], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Pedido cancelado (mantido no histórico para auditoria).' }); }); });

app.post('/api/assinaturas/solicitar', verificarTokenWeb, (req, res) => { const { agencia_id, funcionario_id, cliente_id, unidade_id, mes, ano } = req.body; db.get(`SELECT id FROM assinaturas_mensais WHERE funcionario_id=? AND COALESCE(cliente_id,0)=? AND COALESCE(unidade_id,0)=? AND mes=? AND ano=?`, [parseInt(funcionario_id, 10), cliente_id ? parseInt(cliente_id, 10) : 0, unidade_id ? parseInt(unidade_id, 10) : 0, mes, ano], (err, row) => { if(err) return handleError(res, err); if(row) return res.status(400).json({ erro: 'Já enviou um pedido para este trabalhador neste local e período.' }); db.run(`INSERT INTO assinaturas_mensais (agencia_id, funcionario_id, cliente_id, unidade_id, mes, ano, data_solicitacao) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [parseInt(agencia_id, 10), parseInt(funcionario_id, 10), cliente_id ? parseInt(cliente_id, 10) : null, unidade_id ? parseInt(unidade_id, 10) : null, mes, ano], errInsert => { if(errInsert) return handleError(res, errInsert); res.json({ mensagem: 'Pedido de assinatura enviado ao telemóvel do trabalhador com sucesso!' }); }); }); });
app.get('/api/assinaturas/agencia/:agencia_id', verificarTokenWeb, (req, res) => { db.all(`SELECT a.*, f.nome_completo as nome_func, c.nome_empresa, u.nome_unidade FROM assinaturas_mensais a JOIN funcionarios f ON a.funcionario_id = f.id LEFT JOIN clientes c ON a.cliente_id = c.id LEFT JOIN unidades u ON a.unidade_id = u.id WHERE a.agencia_id = ? ORDER BY a.ano DESC, a.mes DESC`, [parseInt(req.params.agencia_id, 10)], (err, rows) => { if(err) return handleError(res, err); res.json(rows); }); });
app.delete('/api/assinaturas/:id', verificarTokenWeb, (req, res) => { db.run(`DELETE FROM assinaturas_mensais WHERE id=?`, [parseInt(req.params.id, 10)], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Pedido anulado.' }); }); });
app.get('/api/assinaturas/funcionario/:id', verificarTokenWeb, (req, res) => { db.all(`SELECT * FROM assinaturas_mensais WHERE funcionario_id=? ORDER BY ano DESC, mes DESC`, [parseInt(req.params.id, 10)], (err, rows) => { if(err) return handleError(res, err); res.json(rows); }); });

app.post('/api/assinaturas/assinar-unidade', verificarTokenWeb, (req, res) => {
    if (req.user.tipo !== 'trabalhador') return res.status(403).json({ erro: 'Acesso negado' });
    const { mes, ano, cliente_id, unidade_id } = req.body;
    const funcionario_id = parseInt(req.user.id, 10);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const dataHora = new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });
    const carimbo = `Assinado digitalmente em ${dataHora} | IP: ${ip}`;

    db.get('SELECT agencia_id FROM funcionarios WHERE id = ?', [funcionario_id], (errF, funcRow) => {
        if (errF || !funcRow) return handleError(res, errF || new Error('Trabalhador não encontrado'));
        const agencia_id = funcRow.agencia_id;

        db.get(
            'SELECT id FROM assinaturas_mensais WHERE funcionario_id=? AND COALESCE(cliente_id,0)=? AND COALESCE(unidade_id,0)=? AND mes=? AND ano=?',
            [funcionario_id, cliente_id ? parseInt(cliente_id, 10) : 0, unidade_id ? parseInt(unidade_id, 10) : 0, mes, ano],
            (err, row) => {
                if (err) return handleError(res, err);

                if (row) {
                    db.run('UPDATE assinaturas_mensais SET status=?, carimbo_digital=? WHERE id=?', ['Assinado', carimbo, row.id], errUpd => {
                        if (errUpd) return handleError(res, errUpd);
                        res.json({ mensagem: 'Assinatura digital registada com sucesso!' });
                    });
                } else {
                    db.run(
                        'INSERT INTO assinaturas_mensais (agencia_id, funcionario_id, cliente_id, unidade_id, mes, ano, status, carimbo_digital, data_solicitacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                        [agencia_id, funcionario_id, cliente_id ? parseInt(cliente_id, 10) : null, unidade_id ? parseInt(unidade_id, 10) : null, mes, ano, 'Assinado', carimbo],
                        errIns => {
                            if (errIns) return handleError(res, errIns);
                            res.json({ mensagem: 'Assinatura digital criada e registada com sucesso!' });
                        }
                    );
                }
            }
        );
    });
});

app.post('/api/assinaturas/assinar', verificarTokenWeb, (req, res) => { if(req.user.tipo !== 'trabalhador') return res.status(403).json({erro:'Acesso negado'}); const { assinatura_id } = req.body; const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress; const dataHora = new Date().toLocaleString('pt-PT', {timeZone: 'Europe/Lisbon'}); const carimbo = `Assinado digitalmente em ${dataHora} | IP: ${ip}`; db.run(`UPDATE assinaturas_mensais SET status='Assinado', carimbo_digital=? WHERE id=? AND funcionario_id=?`, [carimbo, parseInt(assinatura_id, 10), parseInt(req.user.id, 10)], err => { if(err) return handleError(res, err); res.json({ mensagem: 'Assinatura registada.' }); }); });

// ============================================================================
// 📦 MÓDULO ISOLADO: TO DO 360 (ASSISTENTE PESSOAL DE GESTÃO)
// ============================================================================
pool.query(`
    CREATE TABLE IF NOT EXISTS todo_tarefas (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        nome TEXT NOT NULL,
        hora_marcada VARCHAR(5) NOT NULL,
        data VARCHAR(10) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pendente',
        tentativas INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS todo_planner_data (
        user_id VARCHAR(255) PRIMARY KEY,
        dados TEXT
    );
`).then(() => console.log('📦 Módulo To Do 360: Tabelas isoladas prontas e blindadas.'))
  .catch(err => console.error('Erro ao iniciar Módulo To Do 360:', err));

function getTodoUserId(req) {
    if (req.user.tipo === 'master') return 'master';
    if (req.user.tipo === 'admin') return 'admin_' + req.user.id;
    if (req.user.tipo === 'gestor') return 'gestor_' + (req.user.gestor_id || req.user.id);
    return 'worker_' + req.user.id;
}

app.get('/api/todo/tarefas', verificarTokenWeb, async (req, res) => {
    try {
        const uid = getTodoUserId(req);
        const result = await pool.query("SELECT * FROM todo_tarefas WHERE user_id = $1 ORDER BY hora_marcada ASC", [uid]);
        res.json({ tarefas: result.rows });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});
app.get('/api/todo/tarefas/dia/:data', verificarTokenWeb, async (req, res) => {
    try {
        const uid = getTodoUserId(req);
        const result = await pool.query("SELECT * FROM todo_tarefas WHERE user_id = $1 AND data = $2 ORDER BY hora_marcada ASC", [uid, req.params.data]);
        res.json({ tarefas: result.rows });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});
app.post('/api/todo/tarefas', verificarTokenWeb, async (req, res) => {
    const { nome, hora_marcada, data } = req.body; const uid = getTodoUserId(req); const dataAlvo = data || new Date().toISOString().split('T')[0]; 
    try { const result = await pool.query(`INSERT INTO todo_tarefas (user_id, nome, hora_marcada, data) VALUES ($1, $2, $3, $4) RETURNING id`, [uid, nome, hora_marcada, dataAlvo]); res.json({ id: result.rows[0].id, nome, hora_marcada, data: dataAlvo, status: 'Pendente', tentativas: 0 }); } catch (err) { res.status(500).json({ erro: err.message }); }
});
app.put('/api/todo/tarefas/:id/edit', verificarTokenWeb, async (req, res) => {
    const { nome, hora_marcada, data } = req.body; const uid = getTodoUserId(req);
    try { await pool.query(`UPDATE todo_tarefas SET nome = $1, hora_marcada = $2, data = $3, tentativas = 0, status = 'Pendente' WHERE id = $4 AND user_id = $5`, [nome, hora_marcada, data, parseInt(req.params.id, 10), uid]); res.json({ success: true }); } catch (err) { res.status(500).json({ erro: err.message }); }
});
app.put('/api/todo/tarefas/:id/status', verificarTokenWeb, async (req, res) => {
    const { status } = req.body; const uid = getTodoUserId(req);
    try { await pool.query(`UPDATE todo_tarefas SET status = $1 WHERE id = $2 AND user_id = $3`, [status, parseInt(req.params.id, 10), uid]); res.json({ success: true }); } catch (err) { res.status(500).json({ erro: err.message }); }
});
app.put('/api/todo/tarefas/:id/wait', verificarTokenWeb, async (req, res) => {
    const { nova_hora, tentativas } = req.body; const uid = getTodoUserId(req);
    try { await pool.query(`UPDATE todo_tarefas SET hora_marcada = $1, tentativas = $2 WHERE id = $3 AND user_id = $4`, [nova_hora, tentativas, parseInt(req.params.id, 10), uid]); res.json({ success: true }); } catch (err) { res.status(500).json({ erro: err.message }); }
});
app.delete('/api/todo/tarefas/:id', verificarTokenWeb, async (req, res) => {
    const uid = getTodoUserId(req); try { await pool.query(`DELETE FROM todo_tarefas WHERE id = $1 AND user_id = $2`, [parseInt(req.params.id, 10), uid]); res.json({ success: true }); } catch (err) { res.status(500).json({ erro: err.message }); }
});
app.delete('/api/todo/tarefas/dia/:data', verificarTokenWeb, async (req, res) => {
    const uid = getTodoUserId(req); try { const result = await pool.query(`DELETE FROM todo_tarefas WHERE user_id = $1 AND data = $2`, [uid, req.params.data]); res.json({ success: true, deletedCount: result.rowCount }); } catch (err) { res.status(500).json({ erro: err.message }); }
});
app.get('/api/todo/carregar', verificarTokenWeb, async (req, res) => {
    const uid = getTodoUserId(req); try { const result = await pool.query(`SELECT dados FROM todo_planner_data WHERE user_id = $1`, [uid]); if (result.rows.length > 0) res.json(JSON.parse(result.rows[0].dados)); else res.json({}); } catch (err) { res.status(500).json({ erro: err.message }); }
});
app.post('/api/todo/salvar', verificarTokenWeb, async (req, res) => {
    const { stickers, tarefas, celulas } = req.body; const uid = getTodoUserId(req); const dadosJSON = JSON.stringify({ stickers, tarefas, celulas });
    try { await pool.query(`INSERT INTO todo_planner_data (user_id, dados) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET dados = EXCLUDED.dados`, [uid, dadosJSON]); res.json({ success: true }); } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ============================================================================
// 🧹 VARREDOR AUTOMÁTICO DE FALTAS (Corte às 2 horas de atraso)
// ============================================================================
function varredorDeFaltas() {
    const queryFaltas = `SELECT id, data_inicio, hora_entrada FROM escalas WHERE status_turno = 'Agendado' AND checkin_real IS NULL`;
    db.all(queryFaltas, [], (err, turnos) => {
        if (err || !turnos || turnos.length === 0) return;
        
        const agora = new Date();
        turnos.forEach(t => {
            if (!t.data_inicio || !t.hora_entrada) return;
            let parts = t.data_inicio.split('-'); 
            let timeParts = t.hora_entrada.split(':');
            let dataTurno = new Date(parts[0], parts[1] - 1, parts[2], timeParts[0], timeParts[1]);
            let diffMinutos = (agora - dataTurno) / (1000 * 60);
            
            if (diffMinutos >= 120) { 
                db.run(`UPDATE escalas SET status_turno = 'Falta' WHERE id = ?`, [t.id]);
            }
        });
    });

    const queryPendentes = `SELECT id, data_inicio, hora_entrada FROM escalas WHERE status_turno = 'Pendente'`;
    db.all(queryPendentes, [], (err, turnos) => {
        if (err || !turnos || turnos.length === 0) return;
        
        const agora = new Date();
        turnos.forEach(t => {
            if (!t.data_inicio || !t.hora_entrada) return;
            let parts = t.data_inicio.split('-'); 
            let timeParts = t.hora_entrada.split(':');
            let dataTurno = new Date(parts[0], parts[1] - 1, parts[2], timeParts[0], timeParts[1]);
            
            if (agora > dataTurno) { 
                db.run(`UPDATE escalas SET status_turno = 'Agendamento Não efetivado' WHERE id = ?`, [t.id]);
            }
        });
    });
}
varredorDeFaltas(); 
setInterval(varredorDeFaltas, 5 * 60 * 1000); 

app.listen(PORT, () => console.log(`🚀 Servidor Enterprise Ativo na porta ${PORT}`));