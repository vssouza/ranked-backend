import * as http from "node:http";

const port = Number(process.env.PORT) || 3000;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ranked-backend is running");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on http://localhost:${port}`);
});
