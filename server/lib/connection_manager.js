/*
 * Copyright (C) 2014 Danoha
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */

'use strict';

var MySQL = require('mysql');

//

var ConnManager = function (credentials) {
  this._credentials = credentials;
  this._onready = [];

  this.connected = false;
  this.connection = null;

  init(this);
};

function ready(cm) {
  var callbacks = cm._onready;

  cm.connected = true;
  cm._onready = [];

  process.nextTick(function () {
    callbacks.forEach(function (cb) {
      cb();
    });
  });
}

function init(cm) {
  cm.connected = false;
  cm.connection = MySQL.createConnection(cm._credentials);

  cm.connection.on('error', function (err) {
    if (!err.fatal)
      return;

    if (err.code !== 'PROTOCOL_CONNECTION_LOST')
      throw err;

    console.log('database connection lost', err.stack);
    init(cm);
  });

  process.stdout.write('connecting to database... ');
  cm.connection.query('SET NAMES UTF8', function (err) {
    if (err) {
      console.error('FAILED', err);
      setTimeout(function () {
        init(cm);
      }, 1000);
      return;
    }

    console.log('OK');
    ready(cm);
  });
}

ConnManager.prototype.ready = function (callback) {
  if (this.connected)
    process.nextTick(callback);
  else
    this._onready.push(callback);
};

ConnManager.prototype.query = function () {
  var args = arguments;
  var cm = this;

  this.ready(function () {
    cm.connection.query.apply(cm.connection, args);
  });
};

ConnManager.prototype.handleError = function (err) {
  if (err) {
    console.error('database error', err, new Error().stack);
    return err.fatal ? true : false;
  } else
    return false;
};

module.exports = ConnManager;
