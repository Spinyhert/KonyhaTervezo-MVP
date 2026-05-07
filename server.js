const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const db = require("./data/db");

const projectsRouter = require("./routes/projects");
const cabinetsRouter = require("./routes/cabinets");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/projects", projectsRouter);
app.use("/api/cabinets", cabinetsRouter);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

db.init();

app.listen(PORT, () => {
  console.log(`✅ Konyha Terveő fut: http://localhost:${PORT}`);
});
