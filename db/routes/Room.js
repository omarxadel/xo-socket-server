const knex = require("../config");

/**
 * @typedef {Object} Room
 * @property {number} id - The room identifier
 * @property {string} board - The tic tac toe board instance
 * @property {int} state - The current game state (win, tie or still playing)
 * @property {int} turn - The game turn
 * @property {int} full - The state of the room (full or still matching)
 *
 */

/**
 *
 * @param {String} id
 * @returns {Room} room - The room instance from the Database
 */
const get = async (id) => {
  if (id) {
    try {
      return await knex("room")
        .where("room.id", id)
        .select(
          "room.id",
          "room.board as board",
          "room.gameState as gameState",
          "room.turn as turn",
          "room.full as full"
        );
    } catch (err) {
      console.log(err);
    }
  } else {
    console.error("No ID Provided to the GET function of Room");
  }
};

/**
 * Post changes to the room database
 * @param {Room}
 * room - The room instance
 *
 */
const post = async ({ id, board, gameState, turn, full }) => {
  if (id) {
    try {
      return await knex("room")
        .insert({
          id,
          board,
          gameState,
          turn,
          full,
        })
        .onConflict("id")
        .merge()
        .catch((err) => {
          console.error(
            `There was an error upserting the room table by ${id}:`,
            err
          );
          throw err;
        });
    } catch (error) {
      console.log(error);
    }
  }
};

/**
 * Delete a room from Database with a specific ID
 * @param {String} id The room identifier
 */
const del = async (id) => {
  if (id) {
    try {
      return await knex("room").where("room.id", id).del();
    } catch (err) {
      console.log(err);
    }
  }
};

module.exports = {
  get,
  post,
  del,
};
