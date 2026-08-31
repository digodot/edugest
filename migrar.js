const sqlite3 = require('sqlite3').verbose();
const admin = require('firebase-admin');
const path = require('path');

// 1. Inicializa o Firebase Admin com a sua chave privada
const serviceAccount = require('./chave-firebase.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const dbFirestore = admin.firestore();

// 2. Conecta ao arquivo de banco de dados SQLite local
const dbPath = path.resolve(__dirname, 'data', 'edugastao.db');
const dbSqlite = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erro ao abrir o arquivo edugastao.db:', err.message);
    process.exit(1);
  }
  console.log('📖 Arquivo edugastao.db aberto com sucesso!');
});

// Função auxiliar para buscar todos os registros de uma tabela do SQLite
function buscarTabela(tabela) {
  return new Promise((resolve, reject) => {
    dbSqlite.all(`SELECT * FROM ${tabela}`, [], (err, rows) => {
      if (err) {
        // Se a tabela não existir no SQLite, apenas ignora
        resolve([]);
      } else {
        resolve(rows);
      }
    });
  });
}

// 3. Função principal de migração
async function executarMigracao() {
  console.log('\n🚀 Iniciando migração de dados do SQLite para o Firebase Firestore...\n');

  const tabelas = ['alunos', 'atividades', 'registros', 'trabalhos', 'usuarios'];

  for (const tabela of tabelas) {
    const dados = await buscarTabela(tabela);
    
    if (dados.length === 0) {
      console.log(`ℹ️ Tabela "${tabela}": nenhum registro encontrado para migrar.`);
      continue;
    }

    console.log(`⏳ Migrando ${dados.length} registro(s) da tabela "${tabela}"...`);

    const batch = dbFirestore.batch();

    dados.forEach((row) => {
      // Remove o campo id numérico do SQLite para deixar o Firestore gerar a chave única
      const { id, ...payload } = row;
      const docRef = dbFirestore.collection(tabela).doc();
      batch.set(docRef, payload);
    });

    await batch.commit();
    console.log(`✅ Tabela "${tabela}" migrada com sucesso!`);
  }

  console.log('\n🎉 Migração concluída com sucesso!');
  console.log('Você já pode abrir seu sistema e visualizar todos os dados migrados no Firestore.');
  
  dbSqlite.close();
  process.exit(0);
}

executarMigracao().catch((err) => {
  console.error('❌ Erro durante a migração:', err);
  process.exit(1);
});