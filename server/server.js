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

var config = require('./config.json');
var AccManager = require('./lib/account_manager.js');
var Server = require('./lib/server.js');
var Api = require('./lib/api.js');
var nodemailer = require('nodemailer');

//

process.on('uncaughtException', function(err) {
  console.error('unhandled exception: ' + err);
});

var accMan = new AccManager(config.database);
accMan.connect(function() {
  accMan.resetOnlineCounters(function() {
    var mailer = nodemailer.createTransport(config.mailer.method, config.mailer.opts);
    var api = new Api(accMan, mailer);

    var server = new Server(config.credentials, api);
    server.listen(config.port);
  });
});
