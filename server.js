const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Servir arquivos estáticos (procura o index.html na mesma pasta)
app.use(express.static(__dirname));

// Database Setup
const dbPath = path.join(__dirname, 'data', 'edugastao.db');
const dataDir = path.join(__dirname, 'data');

// Criar diretório de dados se não existir
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco:', err);
  } else {
    console.log('✅ Conectado ao SQLite em:', dbPath);
    inicializarBanco();
  }
});

// Helper para promises com sqlite
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// Inicializar Banco de Dados
function inicializarBanco() {
  db.serialize(() => {
    // Tabela de Alunos
    db.run(`CREATE TABLE IF NOT EXISTS alunos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT,
      escola TEXT,
      turma TEXT,
      matricula TEXT,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de Atividades (Corrigido/Adicionado)
    db.run(`CREATE TABLE IF NOT EXISTS atividades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      escola TEXT,
      turma TEXT,
      periodo TEXT,
      disciplina TEXT,
      titulo TEXT NOT NULL,
      tipo TEXT,
      data DATE,
      valor REAL,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de Registros Pedagógicos
    db.run(`CREATE TABLE IF NOT EXISTS registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id INTEGER,
      aluno TEXT,
      turma TEXT,
      escola TEXT,
      periodo TEXT,
      disciplina TEXT,
      tipo TEXT,
      trabalho TEXT,
      habilidade TEXT,
      nivel TEXT,
      nota REAL,
      observacao TEXT,
      data DATE,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de Trabalhos em Grupo
    db.run(`CREATE TABLE IF NOT EXISTS trabalhos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      escola TEXT,
      periodo TEXT,
      disciplina TEXT,
      nome TEXT NOT NULL,
      turma TEXT,
      data DATE,
      quantidade_grupos INTEGER,
      criterio TEXT,
      descricao TEXT,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de Grupos
    db.run(`CREATE TABLE IF NOT EXISTS grupos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trabalho_id INTEGER NOT NULL,
      numero INTEGER,
      nome TEXT,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trabalho_id) REFERENCES trabalhos(id) ON DELETE CASCADE
    )`);

    // Tabela de Alunos nos Grupos
    db.run(`CREATE TABLE IF NOT EXISTS grupo_alunos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grupo_id INTEGER NOT NULL,
      aluno_id INTEGER NOT NULL,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
      FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
    )`);

    // Tabela de Avaliações de Grupo
    db.run(`CREATE TABLE IF NOT EXISTS avaliacoes_grupo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trabalho_id INTEGER,
      grupo_numero INTEGER,
      nota REAL,
      nota_conteudo REAL,
      nota_equipe REAL,
      nota_apresentacao REAL,
      observacao TEXT,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trabalho_id) REFERENCES trabalhos(id) ON DELETE CASCADE
    )`);

    console.log('✅ Banco de dados inicializado com sucesso');
  });
}

// ============ ROTAS DE SAÚDE ============
app.get('/api/health', async (req, res) => {
  try {
    const count = await dbGet('SELECT COUNT(*) as total FROM alunos');
    res.json({
      status: 'ok',
      database: 'sqlite3',
      alunos_total: count.total,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ROTAS DE ALUNOS ============

// GET - Listar todos os alunos (Ordenado por Escola, Turma e Nome)
app.get('/api/alunos', async (req, res) => {
  try {
    const alunos = await dbAll('SELECT * FROM alunos ORDER BY escola ASC, turma ASC, nome ASC');
    res.json(alunos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - Criar novo aluno
app.post('/api/alunos', async (req, res) => {
  try {
    const { nome, email, escola, turma, matricula } = req.body;
    
    if (!nome || !escola || !turma) {
      return res.status(400).json({ error: 'Nome, escola e turma são obrigatórios' });
    }

    const result = await dbRun(
      'INSERT INTO alunos (nome, email, escola, turma, matricula) VALUES (?, ?, ?, ?, ?)',
      [nome, email || null, escola, turma, matricula || null]
    );

    const novoAluno = await dbGet('SELECT * FROM alunos WHERE id = ?', [result.id]);
    res.status(201).json(novoAluno);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - Atualizar aluno
app.put('/api/alunos/:id', async (req, res) => {
  try {
    const { nome, email, escola, turma, matricula } = req.body;
    
    await dbRun(
      'UPDATE alunos SET nome = ?, email = ?, escola = ?, turma = ?, matricula = ? WHERE id = ?',
      [nome, email || null, escola, turma, matricula || null, req.params.id]
    );

    const alunoAtualizado = await dbGet('SELECT * FROM alunos WHERE id = ?', [req.params.id]);
    res.json(alunoAtualizado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Deletar aluno
app.delete('/api/alunos/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM alunos WHERE id = ?', [req.params.id]);
    res.json({ message: 'Aluno deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ROTAS DE ATIVIDADES ============

// GET - Listar todas as atividades
app.get('/api/atividades', async (req, res) => {
  try {
    const atividades = await dbAll('SELECT * FROM atividades ORDER BY data DESC');
    res.json(atividades);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - Criar nova atividade
app.post('/api/atividades', async (req, res) => {
  try {
    const { escola, turma, periodo, disciplina, titulo, tipo, data, valor } = req.body;
    
    if (!titulo || !turma) {
      return res.status(400).json({ error: 'Título e turma são obrigatórios' });
    }

    const result = await dbRun(
      `INSERT INTO atividades (escola, turma, periodo, disciplina, titulo, tipo, data, valor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [escola || null, turma, periodo || '1B', disciplina || 'Geral', titulo, tipo || 'Individual', data || null, valor || 10]
    );

    const novaAtividade = await dbGet('SELECT * FROM atividades WHERE id = ?', [result.id]);
    res.status(201).json(novaAtividade);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - Atualizar atividade
app.put('/api/atividades/:id', async (req, res) => {
  try {
    const { escola, turma, periodo, disciplina, titulo, tipo, data, valor } = req.body;

    await dbRun(
      `UPDATE atividades SET escola = ?, turma = ?, periodo = ?, disciplina = ?, titulo = ?, tipo = ?, data = ?, valor = ? WHERE id = ?`,
      [escola || null, turma, periodo || '1B', disciplina || 'Geral', titulo, tipo || 'Individual', data || null, valor || 10, req.params.id]
    );

    const atividadeAtualizada = await dbGet('SELECT * FROM atividades WHERE id = ?', [req.params.id]);
    res.json(atividadeAtualizada);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Deletar atividade
app.delete('/api/atividades/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM atividades WHERE id = ?', [req.params.id]);
    res.json({ message: 'Atividade deletada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ROTAS DE REGISTROS PEDAGÓGICOS ============

// GET - Listar registros
app.get('/api/registros', async (req, res) => {
  try {
    const registros = await dbAll('SELECT * FROM registros ORDER BY data DESC');
    res.json(registros);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - Criar registro
app.post('/api/registros', async (req, res) => {
  try {
    const { aluno, aluno_id, turma, escola, periodo, disciplina, tipo, trabalho, habilidade, nivel, nota, observacao, data } = req.body;
    
    const result = await dbRun(
      `INSERT INTO registros (aluno, aluno_id, turma, escola, periodo, disciplina, tipo, trabalho, habilidade, nivel, nota, observacao, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [aluno || null, aluno_id || null, turma, escola || null, periodo || '1B', disciplina || 'Geral', tipo || null, trabalho || null, habilidade || null, nivel || null, nota || null, observacao || null, data || new Date().toISOString().split('T')[0]]
    );

    const novoRegistro = await dbGet('SELECT * FROM registros WHERE id = ?', [result.id]);
    res.status(201).json(novoRegistro);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - Atualizar registro
app.put('/api/registros/:id', async (req, res) => {
  try {
    const { aluno, aluno_id, turma, escola, periodo, disciplina, tipo, trabalho, habilidade, nivel, nota, observacao, data } = req.body;
    
    await dbRun(
      `UPDATE registros SET aluno = ?, aluno_id = ?, turma = ?, escola = ?, periodo = ?, disciplina = ?, tipo = ?, trabalho = ?, habilidade = ?, nivel = ?, nota = ?, observacao = ?, data = ? WHERE id = ?`,
      [aluno || null, aluno_id || null, turma, escola || null, periodo || '1B', disciplina || 'Geral', tipo || null, trabalho || null, habilidade || null, nivel || null, nota || null, observacao || null, data || null, req.params.id]
    );

    const registroAtualizado = await dbGet('SELECT * FROM registros WHERE id = ?', [req.params.id]);
    res.json(registroAtualizado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Deletar registro
app.delete('/api/registros/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM registros WHERE id = ?', [req.params.id]);
    res.json({ message: 'Registro deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ROTAS DE TRABALHOS EM GRUPO ============

// GET - Listar trabalhos
app.get('/api/trabalhos', async (req, res) => {
  try {
    const trabalhos = await dbAll('SELECT * FROM trabalhos ORDER BY data DESC');
    res.json(trabalhos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - Criar trabalho
app.post('/api/trabalhos', async (req, res) => {
  try {
    const { escola, periodo, disciplina, nome, turma, data, quantidade_grupos, criterio, descricao } = req.body;
    
    if (!nome || !turma) {
      return res.status(400).json({ error: 'Nome e turma são obrigatórios' });
    }

    const result = await dbRun(
      `INSERT INTO trabalhos (escola, periodo, disciplina, nome, turma, data, quantidade_grupos, criterio, descricao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [escola || null, periodo || '1B', disciplina || 'Geral', nome, turma, data || null, quantidade_grupos || 4, criterio || null, descricao || null]
    );

    const novoTrabalho = await dbGet('SELECT * FROM trabalhos WHERE id = ?', [result.id]);
    res.status(201).json(novoTrabalho);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Deletar trabalho
app.delete('/api/trabalhos/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM trabalhos WHERE id = ?', [req.params.id]);
    res.json({ message: 'Trabalho deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ROTA DE ESTATÍSTICAS ============
app.get('/api/stats', async (req, res) => {
  try {
    const totalAlunos = await dbGet('SELECT COUNT(*) as total FROM alunos');
    const totalRegistros = await dbGet('SELECT COUNT(*) as total FROM registros');
    const turmas = await dbAll('SELECT DISTINCT turma FROM alunos WHERE turma IS NOT NULL');
    const mediaNotas = await dbGet('SELECT AVG(nota) as media FROM registros WHERE nota IS NOT NULL');

    res.json({
      alunos: totalAlunos.total,
      registros: totalRegistros.total,
      turmas: turmas.length,
      mediaNotas: mediaNotas.media || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ INICIAR SERVIDOR ============
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log('🚀 EduGestão Backend - Servidor Iniciado');
  console.log(`${'='.repeat(50)}`);
  console.log(`📍 API: http://localhost:${PORT}`);
  console.log(`🌐 Interface: http://localhost:${PORT}`);
  console.log(`🗄️  Banco: SQLite (data/edugastao.db)`);
  console.log(`${'='.repeat(50)}\n`);
});

// Tratamento de encerramento do processo
process.on('SIGINT', () => {
  console.log('\n👋 Encerrando servidor...');
  db.close(() => {
    console.log('✅ Banco de dados fechado');
    process.exit(0);
  });
});