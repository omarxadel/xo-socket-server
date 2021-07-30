const express = require("express"),
  path = require("path"),
  game = require("./engine");

const app = express();

const server = require("http").createServer(app).listen(4040);

const io = require("socket.io")(server);

// Serve static html, js, css, and image files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  // console.log(`Connected with socket id: ${socket.id}`);
  game.initGame(io, socket);
});

io.of("/").adapter.on("create-room", (room) => {
  // console.log(`room ${room} was created`);
});

io.of("/").adapter.on("join-room", (room, id) => {
  // console.log(`socket ${id} has joined room ${room}`);
});
