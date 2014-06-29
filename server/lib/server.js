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

var SocketIO = require('socket.io');
var fs = require('fs');
var crypto = require('crypto');
var https = require('https');

//

/**
 * @param {object} credentials
 * @param {Api} api
 * @returns {Server}
 */
var Server = function(credentials, api) {
  var opts = {
    key: fs.readFileSync(credentials.privateKey).toString(),
    cert: fs.readFileSync(credentials.certificate).toString(),
    secure: true
  };
  
  this.https = https.createServer(opts);
  this.io = SocketIO.listen(this.https);
  
  this.io.on('connection', function(socket) {
    api.initSession(socket);
  });
  
  api.setIO(this.io);
};

/**
 * @param {Number} port
 */
Server.prototype.listen = function(port) {
  console.log("listening on *:" + port);
  
  this.https.listen(port);
};


module.exports = Server;
