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

var moment = require('moment');

//

var Api = function(accMan, grpMan, msgMan, server) {
  this.accMan = accMan;
  this.grpMan = grpMan;
  this.msgMan = msgMan;
  this.server = server;

  init(this);
};

function notify(api, userId, name, data) {
  api.server.io.to('user-' + userId).emit(name, data);

  console.log('notify', 'user-' + userId, name, require('util').inspect(data, false, null));
}

function init(api) {
  api.server.io.on('connection', function(sock) {
    session_start(api, sock);
  });

  api.accMan.userNotifiers.push(function(userId, name, data) {
    notify(api, userId, name, data);
  });

  api.msgMan.messageNotifiers.push(function(type, id, msg) {
    if(type === 'c2c') { // contact to contact
      id.forEach(function(i) {
        notify(api, i, 'message.receivedEvent', msg);
      });
    }
  });
}

function addUserToGroup(api, userId, groupId) {
  var clients = api.server.io.sockets.adapter.rooms['user-' + userId];
  var group = api.server.io.sockets.adapter.rooms['group-' + groupId] || { };

  for (var id in clients) {
    if (!clients.hasOwnProperty(id))
      continue;

    group[id] = true;
  }

  api.server.io.sockets.adapter.rooms['group-' + groupId] = group;
}

function removeUserFromGroup(api, userId, groupId) {
  var clients = api.server.io.sockets.adapter.rooms['user-' + userId];
  var group = api.server.io.sockets.adapter.rooms['group-' + groupId] || { };

  for (var id in clients) {
    if (!clients.hasOwnProperty(id))
      continue;

    delete group[id];
  }

  api.server.io.sockets.adapter.rooms['group-' + groupId] = group;
}

function bind(api, sock, name, callback, types, auth) {
  if(auth) {
    var _callback = callback;
    callback = function(a, s, d, n) {
      if (!s.userId)
        s.emit(n, 'ERR_UNAUTHORIZED');
      else
        _callback(a, s, d, n);
    };
  }

  sock.on(name, function(data) {
    if(typeof types !== 'undefined') {
      for (var prop in types) {
        if (!types.hasOwnProperty(prop))
          continue;

        if (typeof data[prop] !== types[prop]) {
          sock.emit(name, 'ERR_INVALID_VALUES');
          return;
        }
      }
    }

    try {
      callback(api, sock, data, name);
    } catch(e) {
      console.error('api handler error name=' + name, e);
    }
  });
}

function session_start(api, sock) {
  function b(name, callback, types, auth) {
    bind(api, sock, name, callback, types, auth);
  }

  b('disconnect', session_end);
  b('account.create', account_create, {email: 'string', nick: 'string', hash: 'string'});
  b('account.activate', account_activate, {code: 'string'});
  b('account.login', account_login, {email: 'string', hash: 'string'});
  b('account.restoreLogin', account_restoreLogin, {loginToken: 'string'});
  b('account.logout', account_logout);

  b('contact.lookup', contact_lookup, {query: 'string'}, true);
  b('contact.setFriendshipState', contact_setFriendshipState, {targetId: 'number', state: 'string', isFavorite: 'boolean'}, true);

  b('message.send', message_send, undefined, true);
}

function session_end(api, sock) {
  account_logout(api, sock);
}

function account_create(api, sock, data, name) {
  api.accMan.create(data.email, data.nick, data.hash, function(result) {
    sock.emit(name, result);
  });
}

function account_activate(api, sock, data, name) {
  api.accMan.activate(data.code, function(result) {
    sock.emit(name, result);
  });
}

function account_login(api, sock, data, name) {
  api.accMan.login(data.email, data.hash, function(result) {
    if(typeof result === 'object' && result.id) {
      sock.userId = result.id;
      sock.join('user-' + result.id);
    }

    sock.emit(name, result);
  });
}

function account_restoreLogin(api, sock, data, name) {
  api.accMan.restoreLogin(data.loginToken, function(result) {
    if(typeof result === 'object' && result.id) {
      sock.userId = result.id;
      sock.join('user-' + result.id);
    }

    //console.log('result', name, require('util').inspect(result, false, null));
    sock.emit(name, result);
  });
}

function account_logout(api, sock, data, name) {
  var done = function() {
    if(typeof name !== 'undefined')
      sock.emit(name, 'OK');
  };

  if(sock.userId) {
    api.accMan.logout(sock.userId, done);
    sock.leave('user-' + sock.userId);
    sock.userId = undefined;
  } else
    done();
}

function contact_lookup(api, sock, data, name) {
  api.accMan.lookup(data.query, function(results) {
    sock.emit(name, results);
  });
}

function contact_setFriendshipState(api, sock, data, name) {
  api.accMan.setFriendshipState(sock.userId, data.targetId, data.state, data.isFavorite, function(result) {
    sock.emit(name, result);
  });
}

function message_send(api, sock, data, name) {
  api.msgMan.process(data, sock.userId, function(result) {
    sock.emit(name, result);
  });
}

module.exports = Api;
