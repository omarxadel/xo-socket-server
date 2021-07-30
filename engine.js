const knex = require("./db/knex");

var io;
var gameSocket;
/**
 *  This function is called by index.js to initialize a new game instance.
 *
 *  @param sio The Socket.IO library
 *  @param socket The socket object for the connected client
 *
 */
exports.initGame = function (sio, socket) {
  io = sio;
  gameSocket = socket;
  gameSocket.emit("connected", { message: "you're connected" });

  // Host Events
  gameSocket.on("create-room", createRoom);
  gameSocket.on("delete-room", deleteRoom);
  gameSocket.on("start-game", startGame);

  // Player Events
  gameSocket.on("join-room", joinRoom);
  gameSocket.on("leave-room", leaveRoom);

  // Game Events
  gameSocket.on("play", play);
};

/* *******************************
 *                             *
 *       HOST FUNCTIONS        *
 *                             *
 ******************************* */

/**
 * The 'Create' button was clicked and 'create-room' event occurred.
 */
function createRoom() {
  // Create a unique Socket.IO Room
  var roomId = (Math.random() * 100000) | 0;
  roomId = roomId.toString();

  // Return the Room ID (roomId) and the socket ID (mySocketId) to the browser client
  this.emit("room-created", { roomId, mySocketId: this.id });

  // Join the Room and wait for the players
  this.join(roomId);

  // Presist the room in the Database
  var room = {
    id: roomId,
    board: "000000000",
    gameState: 1,
    turn: 0,
    full: 0,
  };
  knex.room.post(room);

  // Presist the player in the Database
  var player = {
    id: this.id,
    name: "Host",
    room_id: roomId,
    online: 1,
    turn: 0,
    score: 0,
  };
  knex.player.post(player);
}

/**
 * The 'Back' button was clicked and 'delete-room' event occurred.
 */
function deleteRoom(roomId) {
  // Return the Room ID (roomId) and the socket ID (mySocketId) to the browser client
  io.in(roomId).emit("room-deleted");

  // Presist the change in Database
  knex.room.del(roomId);
}

/* *****************************
 *                           *
 *     PLAYER FUNCTIONS      *
 *                           *
 ***************************** */

/**
 * A player clicked the 'Join' button.
 * Attempt to connect them to the room that matches
 * the roomId entered by the player.
 * @param data Contains data entered via player's input - playerName and roomId.
 */
async function joinRoom(data) {
  console.log(
    "Player " + data.playerName + " attempting to join game: " + data.roomId
  );

  // GET room from Database
  var room = await knex.room.get(data.roomId);

  // If room exists in both adapter and Database
  if (io.sockets.adapter.rooms.get(data.roomId) && room.length > 0) {
    room = room[0];
    // If room exists and is full
    if (room.full == 1) {
      this.emit("error", { message: "This room is already full." });
      return;
    }

    // If room exists and is not full
    data.mySocketId = this.id;

    // Join the room
    this.join(data.roomId);

    // Presist the player in the Database
    var player = {
      id: data.mySocketId,
      name: data.playerName,
      room_id: data.roomId,
      online: 1,
      turn: 1,
      score: 0,
    };
    knex.player.post(player);

    // Update room state in the Database
    room.full = 1;
    knex.room.post(room);

    // Emit an event notifying the clients that the player has joined the room.
    io.to(data.roomId).emit("player-joined", data);

    // Start game
    startGame(data.roomId);
  } else {
    // Otherwise, send an error message back to the player.
    this.emit("error", { message: "This room does not exist." });
  }
}

/**
 * A player clicked the 'Back' button.
 * Attempt to disconnect them from the room
 * @param data Contains data entered via player's input - playerName and roomId.
 */
async function leaveRoom(data) {
  console.log(
    "Player " + data.playerName + " attempting to leave game: " + data.roomId
  );

  var player = await knex.player.get(this.id, data.roomId);
  var room = await knex.room.get(data.roomId);

  if (
    io.sockets.adapter.rooms.get(data.roomId) &&
    player.length > 0 &&
    room.length > 0 &&
    data.roomId == player[0].room_id
  ) {
    room = room[0];

    // If room and player exists and player is in room
    // Leave the room
    this.leave(data.roomId);

    // Presist in database
    knex.player.del(this.id);

    room.full = 0;
    knex.room.post(room);

    // Emit an event notifying the clients that the player has left the room.
    io.to(data.roomId).emit("player-left", data);
  } else {
    // Otherwise, send an error message back to the player.
    this.emit("error", { message: "This room or player does not exist." });
  }
}

/**
 * The game is over, and a player has clicked a button to restart the game.
 * @param data
 */
function playerRestart(data) {
  // console.log('Player: ' + data.playerName + ' ready for new game.');

  // Emit the player's data back to the clients in the game room.
  data.playerId = this.id;
  io.sockets.in(data.gameId).emit("playerJoinedRoom", data);
}

/* *************************
 *                       *
 *      GAME LOGIC       *
 *                       *
 ************************* */

/**
 * Create a board for the players and start game
 * @param roomId The room identifier
 */
async function startGame(roomId) {
  var room = await knex.room.get(roomId);
  io.in(roomId).emit("game-start", room);
}

/**
 * A player has tapped a tile in the board.
 * @param data
 */
function play(data) {
  handleTileClick(this.id, data.roomId, data.tile);
}

/**
 * Check game state after each move
 * @param playerId The last player move identifier
 * @param roomId The room identifier
 * @param tileId The tile identifier
 */
async function handleTileClick(playerId, roomId, tileId) {
  // GET room from Database
  var room = await knex.room.get(roomId);

  // Check if room exists
  if (room.length == 0) return;

  // Extract room from response
  room = room[0];

  // Validate board move
  if (room.board) {
    if (validateBoardMove(room.board, tileId)) {
      io.in(roomId).emit("valid-play", {
        id: tileId,
        text: room.turn == 0 ? "X" : "O",
      });

      // Save move in Database
      room.board = room.board.replaceAt(
        parseInt(tileId[3]) - 1,
        room.turn == 0 ? "X" : "O"
      );

      // Check game state
      room.gameState = checkGameState(room.board);
      if (room.gameState != 1) {
        // If there's a winner
        if (room.gameState == 0) {
          let player = await knex.player.get(playerId);
          if (player.length > 0) {
            player = player[0];
            player.score = player.score + 1;
            await knex.player.post(player);
            io.in(roomId).emit("gameover", playerId);
          }
        } else io.in(roomId).emit("gameover", "tie");
      }

      // Alternate turn
      room.turn = (room.turn + 1) % 2;

      // Presist in Database
      await knex.room.post(room);
    }
  }
}

function validateBoardMove(board, tileID) {
  return board[parseInt(tileID[3] - 1)] == 0;
}

function checkGameState(gameBoard) {
  if (
    gameBoard[0] != "0" &&
    gameBoard[0] == gameBoard[1] &&
    gameBoard[1] == gameBoard[2]
  ) {
    return 0;
  } else if (
    gameBoard[3] != "0" &&
    gameBoard[3] == gameBoard[4] &&
    gameBoard[4] == gameBoard[5]
  ) {
    return 0;
  } else if (
    gameBoard[6] != "0" &&
    gameBoard[6] == gameBoard[7] &&
    gameBoard[7] == gameBoard[8]
  ) {
    return 0;
  } else if (
    gameBoard[0] != "0" &&
    gameBoard[0] == gameBoard[3] &&
    gameBoard[3] == gameBoard[6]
  ) {
    return 0;
  } else if (
    gameBoard[1] != "0" &&
    gameBoard[1] == gameBoard[4] &&
    gameBoard[4] == gameBoard[7]
  ) {
    return 0;
  } else if (
    gameBoard[2] != "0" &&
    gameBoard[2] == gameBoard[5] &&
    gameBoard[5] == gameBoard[8]
  ) {
    return 0;
  } else if (
    gameBoard[0] != "0" &&
    gameBoard[0] == gameBoard[4] &&
    gameBoard[4] == gameBoard[8]
  ) {
    return 0;
  } else if (
    gameBoard[2] != "0" &&
    gameBoard[2] == gameBoard[4] &&
    gameBoard[4] == gameBoard[6]
  ) {
    return 0;
  } else if (!gameBoard.includes("0")) return -1;
  else return 1;
}

String.prototype.replaceAt = function (index, replacement) {
  return (
    this.substr(0, index) +
    replacement +
    this.substr(index + replacement.length)
  );
};
