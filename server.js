const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Telegram Planner Backend работает"
  });
});

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("select now() as time");
    res.json({
      ok: true,
      database: "connected",
      time: result.rows[0].time
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({
      ok: false,
      error: "Ошибка подключения к базе"
    });
  }
});

app.post("/api/tasks/list", async (req, res) => {
  try {
    const { telegram_id } = req.body;

    if (!telegram_id) {
      return res.status(400).json({
        ok: false,
        error: "telegram_id обязателен"
      });
    }

    const result = await pool.query(
      `
      select *
      from tasks
      where telegram_id = $1
      order by task_date asc, task_time asc nulls last, id desc
      `,
      [telegram_id]
    );

    res.json({
      ok: true,
      tasks: result.rows
    });
  } catch (error) {
    console.error("Ошибка загрузки задач:", error);
    res.status(500).json({
      ok: false,
      error: "Ошибка загрузки задач"
    });
  }
});

app.post("/api/tasks/create", async (req, res) => {
  try {
    const {
      telegram_id,
      title,
      description,
      task_date,
      task_time,
      priority
    } = req.body;

    if (!telegram_id || !title || !task_date) {
      return res.status(400).json({
        ok: false,
        error: "telegram_id, title и task_date обязательны"
      });
    }

    const result = await pool.query(
      `
      insert into tasks
      (telegram_id, title, description, task_date, task_time, priority, done)
      values ($1, $2, $3, $4, $5, $6, false)
      returning *
      `,
      [
        telegram_id,
        title,
        description || null,
        task_date,
        task_time || null,
        priority || "Обычная"
      ]
    );

    res.json({
      ok: true,
      task: result.rows[0]
    });
  } catch (error) {
    console.error("Ошибка создания задачи:", error);
    res.status(500).json({
      ok: false,
      error: "Ошибка создания задачи"
    });
  }
});

app.post("/api/tasks/update", async (req, res) => {
  try {
    const {
      id,
      telegram_id,
      title,
      description,
      task_date,
      task_time,
      priority
    } = req.body;

    if (!id || !telegram_id || !title || !task_date) {
      return res.status(400).json({
        ok: false,
        error: "id, telegram_id, title и task_date обязательны"
      });
    }

    const result = await pool.query(
      `
      update tasks
      set
        title = $1,
        description = $2,
        task_date = $3,
        task_time = $4,
        priority = $5,
        updated_at = now()
      where id = $6 and telegram_id = $7
      returning *
      `,
      [
        title,
        description || null,
        task_date,
        task_time || null,
        priority || "Обычная",
        id,
        telegram_id
      ]
    );

    res.json({
      ok: true,
      task: result.rows[0]
    });
  } catch (error) {
    console.error("Ошибка обновления задачи:", error);
    res.status(500).json({
      ok: false,
      error: "Ошибка обновления задачи"
    });
  }
});

app.post("/api/tasks/toggle", async (req, res) => {
  try {
    const { id, telegram_id, done } = req.body;

    if (!id || !telegram_id) {
      return res.status(400).json({
        ok: false,
        error: "id и telegram_id обязательны"
      });
    }

    const result = await pool.query(
      `
      update tasks
      set
        done = $1,
        updated_at = now()
      where id = $2 and telegram_id = $3
      returning *
      `,
      [Boolean(done), id, telegram_id]
    );

    res.json({
      ok: true,
      task: result.rows[0]
    });
  } catch (error) {
    console.error("Ошибка изменения статуса задачи:", error);
    res.status(500).json({
      ok: false,
      error: "Ошибка изменения статуса задачи"
    });
  }
});

app.post("/api/tasks/delete", async (req, res) => {
  try {
    const { id, telegram_id } = req.body;

    if (!id || !telegram_id) {
      return res.status(400).json({
        ok: false,
        error: "id и telegram_id обязательны"
      });
    }

    await pool.query(
      `
      delete from tasks
      where id = $1 and telegram_id = $2
      `,
      [id, telegram_id]
    );

    res.json({
      ok: true
    });
  } catch (error) {
    console.error("Ошибка удаления задачи:", error);
    res.status(500).json({
      ok: false,
      error: "Ошибка удаления задачи"
    });
  }
});

app.post("/api/notes/list", async (req, res) => {
  try {
    const { telegram_id } = req.body;

    if (!telegram_id) {
      return res.status(400).json({
        ok: false,
        error: "telegram_id обязателен"
      });
    }

    const result = await pool.query(
      `
      select *
      from notes
      where telegram_id = $1
      order by created_at desc
      `,
      [telegram_id]
    );

    res.json({
      ok: true,
      notes: result.rows
    });
  } catch (error) {
    console.error("Ошибка загрузки заметок:", error);
    res.status(500).json({
      ok: false,
      error: "Ошибка загрузки заметок"
    });
  }
});

app.post("/api/notes/create", async (req, res) => {
  try {
    const { telegram_id, title, content } = req.body;

    if (!telegram_id) {
      return res.status(400).json({
        ok: false,
        error: "telegram_id обязателен"
      });
    }

    const result = await pool.query(
      `
      insert into notes
      (telegram_id, title, content)
      values ($1, $2, $3)
      returning *
      `,
      [telegram_id, title || null, content || null]
    );

    res.json({
      ok: true,
      note: result.rows[0]
    });
  } catch (error) {
    console.error("Ошибка создания заметки:", error);
    res.status(500).json({
      ok: false,
      error: "Ошибка создания заметки"
    });
  }
});

app.post("/api/notes/update", async (req, res) => {
  try {
    const { id, telegram_id, title, content } = req.body;

    if (!id || !telegram_id) {
      return res.status(400).json({
        ok: false,
        error: "id и telegram_id обязательны"
      });
    }

    const result = await pool.query(
      `
      update notes
      set
        title = $1,
        content = $2,
        updated_at = now()
      where id = $3 and telegram_id = $4
      returning *
      `,
      [title || null, content || null, id, telegram_id]
    );

    res.json({
      ok: true,
      note: result.rows[0]
    });
  } catch (error) {
    console.error("Ошибка обновления заметки:", error);
    res.status(500).json({
      ok: false,
      error: "Ошибка обновления заметки"
    });
  }
});

app.post("/api/notes/delete", async (req, res) => {
  try {
    const { id, telegram_id } = req.body;

    if (!id || !telegram_id) {
      return res.status(400).json({
        ok: false,
        error: "id и telegram_id обязательны"
      });
    }

    await pool.query(
      `
      delete from notes
      where id = $1 and telegram_id = $2
      `,
      [id, telegram_id]
    );

    res.json({
      ok: true
    });
  } catch (error) {
    console.error("Ошибка удаления заметки:", error);
    res.status(500).json({
      ok: false,
      error: "Ошибка удаления заметки"
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Planner backend запущен на порту ${process.env.PORT || 3000}`);
});
