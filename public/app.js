jQuery(
  (function ($) {
    "use strict";
    /**
     * All the code relevant to Socket.IO is collected in the IO namespace.
     *
     * @type {{init: Function, bindEvents: Function, onConnected: Function, onNewGameCreated: Function, playerJoinedRoom: Function, beginNewGame: Function, writeTile: Function, gameOver: Function, error: Function}}
     */
    var IO = {
      /**
       * This is called when the page is displayed. It connects the Socket.IO client
       * to the Socket.IO server
       */
      init: function () {
        IO.socket = io.connect();
        IO.bindEvents();
      },

      /**
       * While connected, Socket.IO will listen to the following events emitted
       * by the Socket.IO server, then run the appropriate function.
       */
      bindEvents: function () {
        IO.socket.on("connected", IO.onConnected);
        IO.socket.on("room-created", IO.onNewGameCreated);
        IO.socket.on("player-joined", IO.playerJoinedRoom);
        IO.socket.on("game-start", IO.beginNewGame);
        IO.socket.on("valid-play", IO.writeTile);
        IO.socket.on("gameover", IO.gameOver);
        IO.socket.on("error", IO.error);
      },

      /**
       * The client is successfully connected!
       */
      onConnected: function () {
        // Cache a copy of the client's socket.IO session ID on the App
        App.mySocketId = IO.socket.mySocketId;
      },

      /**
       * A new game has been created and a random game ID has been generated.
       * @param data {{ gameId: int, mySocketId: * }}
       */
      onNewGameCreated: function (data) {
        App.Host.gameInit(data);
      },

      /**
       * A player has successfully joined the game.
       * @param data {{playerName: string, gameId: int, mySocketId: int}}
       */
      playerJoinedRoom: function (data) {
        // When a player joins a room, do the updateWaitingScreen function.
        // There are two versions of this function: one for the 'host' and
        // another for the 'player'.
        //
        // So on the 'host' browser window, the App.Host.updateWiatingScreen function is called.
        // And on the player's browser, App.Player.updateWaitingScreen is called.
        App[App.myRole].updateWaitingScreen(data);
      },

      /**
       * Both players have joined the game.
       * @param room
       */
      beginNewGame: function (data) {
        App[App.myRole].gameStart(data);
      },

      /**
       * Write tile if valid.
       * @param tile {id, text}
       */
      writeTile: function (tile) {
        $("#" + tile.id).text(tile.text);
        $("#overlay").toggleClass("d-none");
      },

      /**
       * Let everyone know the game has ended.
       * @param data
       */
      gameOver: function (data) {
        App[App.myRole].endGame(data);
      },

      /**
       * An error has occurred.
       * @param data
       */
      error: function (data) {
        alert(data.message);
      },
    };

    var App = {
      /**
       * Keep track of the gameId, which is identical to the ID
       * of the Socket.IO Room used for the players and host to communicate
       *
       */
      roomId: "",

      /**
       * This is used to differentiate between 'Host' and 'Player' browsers.
       */
      myRole: "", // 'Player' or 'Host'

      /**
       * The Socket.IO socket object identifier. This is unique for
       * each player and host. It is generated when the browser initially
       * connects to the server when the page loads for the first time.
       */
      mySocketId: "",

      /* *************************************
       *                Setup                *
       * *********************************** */

      /**
       * This runs when the page initially loads.
       */
      init: function () {
        App.cacheElements();
        App.showInitScreen();
        App.bindEvents();
      },

      /**
       * Create references to on-screen elements used throughout the game.
       */
      cacheElements: function () {
        App.$doc = $(document);

        // Templates
        App.$gameArea = $("#game-area");
        App.$templateIntroScreen = $("#intro-screen-template").html();
        App.$templateNewGame = $("#create-game-template").html();
        App.$templateJoinGame = $("#join-game-template").html();
        App.$hostGame = $("#game-template").html();
      },

      /**
       * Create some click handlers for the various buttons that appear on-screen.
       */
      bindEvents: function () {
        // All
        App.$doc.on("click", "#back", App.onBackClick);

        // Host
        App.$doc.on("click", "#btnCreateGame", App.Host.onCreateClick);
        App.$doc.on("click", "#back-create", App.Host.onBackClick);
        App.$doc.on("click", "#btnHostRestart", App.Host.onRestart);

        // Player
        App.$doc.on("click", "#btnJoinGame", App.Player.onJoinClick);
        App.$doc.on("click", "#btnStart", App.Player.onPlayerStartClick);
        App.$doc.on("click", "#btnPlayerRestart", App.Player.onRestart);
        App.$doc.on("click", "#back-join", App.Player.onBackClick);

        // Board Tiles
        App.$doc.on("click", "#tic1", App.ticClick);
        App.$doc.on("click", "#tic2", App.ticClick);
        App.$doc.on("click", "#tic3", App.ticClick);
        App.$doc.on("click", "#tic4", App.ticClick);
        App.$doc.on("click", "#tic5", App.ticClick);
        App.$doc.on("click", "#tic6", App.ticClick);
        App.$doc.on("click", "#tic7", App.ticClick);
        App.$doc.on("click", "#tic8", App.ticClick);
        App.$doc.on("click", "#tic9", App.ticClick);
      },

      /* *************************************
       *             Game Logic              *
       * *********************************** */

      /**
       * Show the initial Anagrammatix Title Screen
       * (with Start and Join buttons)
       */
      showInitScreen: function () {
        App.$gameArea.html(App.$templateIntroScreen);
      },
      onBackClick: function () {
        App.$gameArea.html(App.$templateIntroScreen);
      },
      ticClick: function () {
        IO.socket.emit("play", {
          roomId: App.roomId,
          playerId: App.mySocketId,
          tile: $(this).attr("id"),
        });
      },
      /* *******************************
       *         HOST CODE           *
       ******************************* */
      Host: {
        /**
         * Contains references to player data
         */
        players: [],

        /**
         * Flag to indicate if a new game is starting.
         * This is used after the first game ends, and players initiate a new game
         * without refreshing the browser windows.
         */
        isNewGame: false,

        /**
         * Handler for the "Start" button on the Title Screen.
         */
        onCreateClick: function () {
          //   console.log('Clicked "Create A Game"');
          IO.socket.emit("create-room");
        },

        /**
         * The Host screen is displayed for the first time.
         * @param data{{ roomId: String, mySocketId: * }}
         */
        gameInit: function (data) {
          App.roomId = data.roomId;
          App.mySocketId = data.mySocketId;
          App.myRole = "Host";

          App.Host.displayNewGameScreen();
          console.log(
            "Game started with ID: " +
              App.roomId +
              " by host: " +
              App.mySocketId
          );
        },

        /**
         * Show the Host screen containing the game URL and unique game ID
         */
        displayNewGameScreen: function () {
          // Fill the game screen with the appropriate HTML
          App.$gameArea.html(App.$templateNewGame);

          // Display the URL on screen
          $("#gameURL").text(window.location.href);

          // Show the gameId / room id on screen
          $("#spanNewGameCode").text(App.roomId);
        },
        /**
         * Delete the room
         */
        onBackClick: function () {
          App.$gameArea.html(App.$templateIntroScreen);
          console.log(App.roomId.length);
          if (App.roomId.length > 1) {
            IO.socket.emit("delete-room", App.roomId);
          }
        },
        /**
         * Update the Host screen when the first player joins
         * @param data{{playerName: string}}
         */
        updateWaitingScreen: function (data) {
          // If this is a restarted game, show the screen.
          if (App.Host.isNewGame) {
            App.Host.displayNewGameScreen();
          }
          // Update host screen
          $("#playersWaiting")
            .append("<p/>")
            .text("Player " + data.playerName + " joined the game.");

          // Store the new player's data on the Host.
          App.Host.players.push(data);

          // Increment the number of players in the room
          App.Host.numPlayersInRoom += 1;

          // If two players have joined, start the game!
          if (App.Host.numPlayersInRoom === 1) {
            // console.log("Room is full. Almost ready!");
            // Let the server know that two players are present.
            IO.socket.emit("hostRoomFull", App.gameId);
          }
        },

        /**
         * Show the countdown screen
         */
        gameStart: function () {
          // Prepare the game screen with new HTML
          App.$gameArea.html(App.$hostGame);
          $("#overlay").addClass("d-none");
        },

        /**
         * Show the "Game Over" screen.
         */
        endGame: function (data) {
          console.log(data);
          let gameOverMessage = "";
          // If it's a tie
          if (data === "tie") {
            gameOverMessage = "Game Over! It's a tie!";
          }
          // If this player is a winner
          else if (data === App.mySocketId) {
            gameOverMessage = "Game Over! You WON!";
          }
          // If this player lost
          else {
            gameOverMessage = "Game Over! You lost!";
          }
          $("#game-area")
            .html('<div class="gameOver">' + gameOverMessage + "</div>")
            .append(
              // Create a button to start a new game.
              $("<button>Start Again</button>")
                .attr("id", "btnPlayerRestart")
                .addClass("btn")
                .addClass("btnGameOver")
            );
        },
        /**
         * A player hit the 'Start Again' button after the end of a game.
         */
        restartGame: function () {
          App.$gameArea.html(App.$templateNewGame);
          $("#spanNewGameCode").text(App.gameId);
        },
      },

      /* *****************************
       *        PLAYER CODE        *
       ***************************** */

      Player: {
        /**
         * A reference to the socket ID of the Host
         */
        hostSocketId: "",

        /**
         * The player's name entered on the 'Join' screen.
         */
        myName: "",

        /**
         * Click handler for the 'JOIN' button
         */
        onJoinClick: function () {
          // console.log('Clicked "Join A Game"');

          // Display the Join Game HTML on the player's screen.
          App.$gameArea.html(App.$templateJoinGame);
        },

        /**
         * Leave the room
         */
        onBackClick: function () {
          App.$gameArea.html(App.$templateIntroScreen);
          if (App.roomId.length > 1) {
            IO.socket.emit("leave-room", {
              roomId: App.roomId,
              playerName: App.Player.myName,
            });
          }
        },

        /**
         * The player entered their name and gameId (hopefully)
         * and clicked Start.
         */
        onPlayerStartClick: function () {
          // console.log('Player clicked "Start"');

          // collect data to send to the server
          var data = {
            roomId: $("#inputGameId").val().toString(),
            playerName: $("#inputPlayerName").val() || "anon",
          };

          // Send the gameId and playerName to the server
          IO.socket.emit("join-room", data);

          // Set the appropriate properties for the current player.
          App.myRole = "Player";
          App.Player.myName = data.playerName;
        },

        /**
         *  Click handler for the "Start Again" button that appears
         *  when a game is over.
         */
        onRestart: function () {
          var data = {
            roomId: App.roomId,
            playerName: App.Player.myName,
          };
          IO.socket.emit("player-restart", data);
          App.currentRound = 0;
          $("#game-area").html(
            '<h3 class"info"=>Waiting on host to start new game.</h3>'
          );
        },

        /**
         * Display the waiting screen for player 1
         * @param data
         */
        updateWaitingScreen: function (data) {
          if (IO.socket.id === data.mySocketId) {
            App.myRole = "Player";
            App.roomId = data.roomId;
            $("#playerWaitingMessage")
              .append("<p/>")
              .text(
                "Joined Game " +
                  data.roomId +
                  ". Please wait for game to begin."
              );
          }
        },

        /**
         * Start the game.
         * @param hostData
         */
        gameStart: function (hostData) {
          App.Player.hostSocketId = hostData.mySocketId;
          // Prepare the game screen with new HTML
          App.$gameArea.html(App.$hostGame);
        },

        /**
         * Show the "Game Over" screen.
         * @param data holds a winner or a tie
         */
        endGame: function (data) {
          console.log(data);
          let gameOverMessage = "";
          // If it's a tie
          if (data === "tie") {
            gameOverMessage = "Game Over! It's a tie!";
          }
          // If this player is a winner
          else if (data === App.mySocketId) {
            gameOverMessage = "Game Over! You WON!";
          }
          // If this player lost
          else {
            gameOverMessage = "Game Over! You lost!";
          }
          $("#game-area")
            .html('<div class="gameOver">' + gameOverMessage + "</div>")
            .append(
              // Create a button to start a new game.
              $("<button>Start Again</button>")
                .attr("id", "btnPlayerRestart")
                .addClass("btn")
                .addClass("btnGameOver")
            );
        },
      },

      /* **************************
                UTILITY CODE
         ************************** */
    };

    IO.init();
    App.init();
  })($)
);
