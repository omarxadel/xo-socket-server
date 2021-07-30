const knex = require("../config");

/**
 * @typedef {Object} Player
 * @property {string} id - The player identifier
 * @property {string} name - The player name
 * @property {string} room_id - The tic tac toe board instance
 * @property {int} online - The current player state (online, offline)
 * @property {int} turn - The player turn
 * @property {int} score - The player score
 *
 */

/**
 *
 * @param {String} id
 * @param {String} room_id
 * @returns {Player} player - Player instance
 */
const get = async (id, room_id) => {
  if (id && room_id) {
    try {
      return await knex("player")
        .where("player.id", id)
        .where("player.room_id", room_id)
        .select("*");
    } catch (err) {
      console.log(err);
    }
  } else if (id) {
    try {
      return await knex("player").where("player.id", id).select("*");
    } catch (err) {
      console.log(err);
    }
  } else {
    console.error("No ID Provided to the GET function of Player");
  }
};

/**
 * Post changes to the room database
 * @param {Player} player - Player instance
 *
 */
const post = async ({ id, name, room_id, online, turn, score }) => {
  if (id) {
    try {
      return await knex("player")
        .insert({
          id,
          name,
          room_id,
          online,
          turn,
          score,
        })
        .onConflict("id")
        .merge()
        .catch((err) => {
          console.error(
            `There was an error upserting the player table by ${id}:`,
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
 * Delete a player from Database with a specific ID
 * @param {int} id The player identifier
 */
const del = async (id) => {
  if (id) {
    try {
      return await knex("player").where("player.id", id).del();
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
