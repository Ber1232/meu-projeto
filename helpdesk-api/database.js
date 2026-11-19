const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "helpdesk.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Erro ao conectar ao banco SQLite:", err.message);
  } else {
    console.log("Conectado ao banco SQLite em:", dbPath);
  }
});

db.serialize(() => {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS chamados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL CHECK (length(trim(titulo)) >= 5),
      descricao TEXT NOT NULL CHECK (length(trim(descricao)) > 0),
      prioridade TEXT NOT NULL CHECK (prioridade IN ('baixa', 'media', 'alta')),
      status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'concluido')),
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) {
        console.error("Erro ao criar tabela chamados:", err.message);
      } else {
        console.log('Tabela "chamados" pronta para uso.');
      }
    },
  );
});

module.exports = db;
