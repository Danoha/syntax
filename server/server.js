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
var ConnManager = require('./lib/connection_manager.js');
var AccManager = require('./lib/account_manager.js');
var GrpManager = require('./lib/group_manager.js');
var MsgManager = require('./lib/message_manager.js');
var Server = require('./lib/server.js');
var Api = require('./lib/api.js');
var nodemailer = require('nodemailer');
var Dns = require('./lib/dns.js');

//

process.on('uncaughtException', function (err) {
  console.error('unhandled exception: ' + err.stack);
});

var mailer = nodemailer.createTransport(config.mailer.method, config.mailer.opts);
var connMan = new ConnManager(config.database);

connMan.ready(function () {
  new Dns().getHostname(function (hostname) {
    console.log('DNS lookup done (hostname seems to be ' + hostname + ')');

    var accMan = new AccManager(connMan, hostname, mailer);
    var grpMan = new GrpManager(connMan, accMan);
    var msgMan = new MsgManager(accMan, grpMan);

    accMan.setGroupManager(grpMan);

    accMan.resetOnlineCounters(function () {
      var server = new Server(config.credentials);

      new Api(accMan, grpMan, msgMan, server);

      server.listen(config.port);
    });
  });
});
