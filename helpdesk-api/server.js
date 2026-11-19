const express = require("express");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const PRIORIDADES_VALIDAS = ["baixa", "media", "alta"];
const STATUS_VALIDOS = ["aberto", "em_andamento", "concluido"];

// Helpers de query com Promise para facilitar async/await
const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const getOne = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const getAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

// Validação de entrada para POST e PUT
function validarChamado(body) {
  const erros = [];
  const { titulo, descricao, prioridade, status } = body;

  if (typeof titulo !== "string" || titulo.trim().length === 0) {
    erros.push('O campo "titulo" é obrigatório e não pode estar vazio.');
  } else if (titulo.trim().length < 5) {
    erros.push('O campo "titulo" deve ter no mínimo 5 caracteres.');
  }

  if (typeof descricao !== "string" || descricao.trim().length === 0) {
    erros.push('O campo "descricao" é obrigatório e não pode estar vazia.');
  }

  if (typeof prioridade !== "string" || prioridade.trim().length === 0) {
    erros.push('O campo "prioridade" é obrigatório e não pode estar vazio.');
  } else if (!PRIORIDADES_VALIDAS.includes(prioridade)) {
    erros.push(
      `Prioridade inválida. Valores aceitos: ${PRIORIDADES_VALIDAS.join(", ")}.`,
    );
  }

  if (status !== undefined) {
    if (typeof status !== "string" || !STATUS_VALIDOS.includes(status)) {
      erros.push(
        `Status inválido. Valores aceitos: ${STATUS_VALIDOS.join(", ")}.`,
      );
    }
  }

  return erros;
}

// POST /chamados - Cria um novo chamado
app.post("/chamados", async (req, res) => {
  const erros = validarChamado(req.body);
  if (erros.length > 0) {
    return res.status(400).json({
      erro: "Dados inválidos para criação do chamado.",
      detalhes: erros,
    });
  }

  const titulo = req.body.titulo.trim();
  const descricao = req.body.descricao.trim();
  const prioridade = req.body.prioridade;
  const status = req.body.status || "aberto";

  try {
    const { lastID } = await runQuery(
      `INSERT INTO chamados (titulo, descricao, prioridade, status) VALUES (?, ?, ?, ?)`,
      [titulo, descricao, prioridade, status],
    );

    const chamadoCriado = await getOne(`SELECT * FROM chamados WHERE id = ?`, [
      lastID,
    ]);
    return res.status(201).json(chamadoCriado);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro interno ao criar chamado." });
  }
});

// GET /chamados - Lista todos os chamados
app.get("/chamados", async (req, res) => {
  try {
    const chamados = await getAll(`SELECT * FROM chamados ORDER BY id DESC`);
    return res.status(200).json(chamados);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro interno ao listar chamados." });
  }
});

// GET /chamados/:id - Busca detalhes de um chamado específico
app.get("/chamados/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res
      .status(400)
      .json({ erro: 'O parâmetro "id" deve ser um número inteiro positivo.' });
  }

  try {
    const chamado = await getOne(`SELECT * FROM chamados WHERE id = ?`, [id]);
    if (!chamado) {
      return res
        .status(404)
        .json({ erro: `Chamado com id ${id} não encontrado.` });
    }
    return res.status(200).json(chamado);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro interno ao buscar chamado." });
  }
});

// PUT /chamados/:id - Atualiza título, descrição, prioridade ou status
app.put("/chamados/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res
      .status(400)
      .json({ erro: 'O parâmetro "id" deve ser um número inteiro positivo.' });
  }

  const erros = validarChamado(req.body);
  if (erros.length > 0) {
    return res.status(400).json({
      erro: "Dados inválidos para atualização do chamado.",
      detalhes: erros,
    });
  }

  try {
    const existente = await getOne(`SELECT * FROM chamados WHERE id = ?`, [id]);
    if (!existente) {
      return res
        .status(404)
        .json({ erro: `Chamado com id ${id} não encontrado.` });
    }

    const titulo = req.body.titulo.trim();
    const descricao = req.body.descricao.trim();
    const prioridade = req.body.prioridade;
    const status =
      req.body.status !== undefined ? req.body.status : existente.status;

    await runQuery(
      `UPDATE chamados
       SET titulo = ?, descricao = ?, prioridade = ?, status = ?
       WHERE id = ?`,
      [titulo, descricao, prioridade, status, id],
    );

    const chamadoAtualizado = await getOne(
      `SELECT * FROM chamados WHERE id = ?`,
      [id],
    );
    return res.status(200).json(chamadoAtualizado);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro interno ao atualizar chamado." });
  }
});

// DELETE /chamados/:id - Remove um chamado do banco
app.delete("/chamados/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res
      .status(400)
      .json({ erro: 'O parâmetro "id" deve ser um número inteiro positivo.' });
  }

  try {
    const { changes } = await runQuery(`DELETE FROM chamados WHERE id = ?`, [
      id,
    ]);
    if (changes === 0) {
      return res
        .status(404)
        .json({ erro: `Chamado com id ${id} não encontrado.` });
    }
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: "Erro interno ao excluir chamado." });
  }
});

app.listen(PORT, () => {
  console.log(`HelpDesk API rodando em http://localhost:${PORT}`);
});
