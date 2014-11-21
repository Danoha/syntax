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

var fs = require('fs');
var async = require('async');
var utils = require('./utils.js');

//

var AccManager = function (connMan, hostname, mailer) {
  this.cm = connMan;
  this.hostname = hostname;
  this.mailer = mailer;

  /**
   * @type {Function[]}
   */
  this.userNotifiers = [];
};

AccManager.prototype.setGroupManager = function (grpMan) {
  this.gm = grpMan;
};

AccManager.prototype.mailTemplates = {
  activation: fs.readFileSync('mail_templates/account_activation.html').toString()
};

function getFriendshipState(am, userId, contactId, callback) {
  var c = function (a, b) {
    return function (cb) {
      am.cm.query('SELECT state FROM contacts WHERE leftId = ? AND rightId = ?', [a, b], function (err, rows) {
        if (am.cm.handleError(err) || !rows || rows.length !== 1)
          cb(null, 'none');
        else
          cb(null, rows[0].state);
      });
    };
  };

  async.parallel([
    c(userId, contactId),
    c(contactId, userId)
  ], function (err, results) {
    callback({
      left: results[0],
      right: results[1]
    });
  });
}

AccManager.prototype.getFriendshipState = function (userId, contactId, callback) {
  getFriendshipState(this, userId, contactId, callback);
};

function getContact(am, userId, callback) {
  am.cm.query('SELECT id, (onlineCounter > 0) AS isOnline, nick FROM users WHERE id = ?', [userId], function (err, rows) {
    if (am.cm.handleError(err) || !rows)
      return;

    if (rows.length === 0)
      callback(null);
    else
      callback(rows[0]);
  });
}

AccManager.prototype.getContact = function (userId, callback) {
  getContact(this, userId, callback);
};

function listContacts(am, userId, callback) {
  am.cm.query('SELECT rightId, state, isFavorite FROM contacts WHERE leftId = ?', [userId], function (err, rows) {
    if (am.cm.handleError(err) || !rows)
      return callback([]);

    var ret = [];

    rows.forEach(function (row) {
      ret.push({
        contactId: row.rightId,
        state: {
          left: row.state,
          right: 'none'
        },
        isFavorite: row.isFavorite ? true : false
      });
    });

    am.cm.query('SELECT leftId, state FROM contacts WHERE rightId = ?', [userId], function (err, rows) {
      if (am.cm.handleError(err) || !rows)
        return callback([]);

      rows.forEach(function (r) {
        for (var i in ret) {
          if (!ret.hasOwnProperty(i) || ret[i].contactId !== r.leftId)
            continue;

          ret[i].state.right = r.state;
        }
      });

      callback(ret);
    });
  });
}

function getContacts(am, userId, callback) {
  listContacts(am, userId, function (rows) {
    var tasks = [];

    rows.forEach(function (row) {
      tasks.push(function (cb) {
        am.cm.query('SELECT id, nick, onlineCounter FROM users WHERE id = ?', [row.contactId], function (err, rows) {
          if (am.cm.handleError(err) || !rows || rows.length !== 1)
            return cb(err, null);

          var r = rows[0];

          cb(null, {
            id: r.id,
            nick: r.nick,
            isOnline: r.onlineCounter > 0,
            state: row.state,
            isFavorite: row.isFavorite
          });
        });
      });
    });

    async.parallel(tasks, function (err, results) {
      if (err)
        return callback([]);

      callback(results);
    });
  });
}

function notifyUser(am, userId, name, data) {
  utils.invokeArray(am.userNotifiers, [[userId], name, data]);
}

function notifyFriendshipState(am, leftId, rightId) {
  function n(userId, contactId, state) {
    if (state.right !== 'accepted')
      state.right = 'waiting';

    getContact(am, contactId, function (contact) {
      notifyUser(am, userId, 'contact.friendshipStateEvent', {
        contact: contact,
        state: state
      });
    });
  }

  getFriendshipState(am, leftId, rightId, function (state) {
    n(leftId, rightId, state);
    n(rightId, leftId, {
      left: state.right,
      right: state.left
    });
  });
}

function notifyContacts(am, userId, name, data) {
  listContacts(am, userId, function (contacts) {
    contacts.forEach(function (row) {
      notifyUser(am, row.contactId, name, data);
    });
  });
}

function resetOnlineCounters(am, callback) {
  am.cm.query('UPDATE users SET onlineCounter = 0', undefined, function (err) {
    if (am.cm.handleError(err))
      return;

    callback();
  });
}

AccManager.prototype.resetOnlineCounters = function (callback) {
  resetOnlineCounters(this, callback);
};

function create(am, email, nick, hash, callback) {
  if (email.length < 5 || nick.length < 3 || hash.length !== 64)
    return callback('ERR_INVALID_VALUES');

  var values = {
    email: email,
    nick: nick,
    hash: hash,
    activationCode: utils.randomString(24)
  };

  am.cm.query('INSERT INTO users SET ?', values, function (err, result) {
    if (am.cm.handleError(err))
      return callback('ERR');

    if (!result || result.insertId <= 0)
      return callback('ERR_ALREADY_USED');

    // TODO: move to mail manager
    var link = 'https://' + am.hostname + '/?activate=' + values.activationCode;

    var mailOptions = {
      from: 'syntax.im <noreply@syntax.im>',
      to: values.email,
      subject: 'account activation',
      html: am.mailTemplates.activation.replace(/%link%/gi, link)
    };

    am.mailer.sendMail(mailOptions, function (err) {
      if (err)
        callback('ERR_COULDNT_SEND_MAIL');
      else
        callback('OK');
    });
  });
}

AccManager.prototype.create = function (email, nick, hash, callback) {
  create(this, email, nick, hash, callback);
};

function activate(am, code, callback) {
  am.cm.query('UPDATE users SET activationCode = NULL WHERE activationCode = ?', code, function (err, result) {
    if (am.cm.handleError(err))
      return callback('ERR');

    callback(result && result.affectedRows > 0 ? 'OK' : 'ERR_CODE_INVALID');
  });
}

AccManager.prototype.activate = function (code, callback) {
  activate(this, code, callback);
};

function loginValid(am, row, callback) {
  var loginToken = utils.randomString(48);

  var user = {
    id: row.id,
    nick: row.nick,
    email: row.email,
    loginToken: loginToken
  };

  async.parallel([
    // retrieve contacts
    function (cb) {
      getContacts(am, user.id, function (contacts) {
        contacts.forEach(function (c) {
          if (c.state.right !== 'accepted')
            c.state.right = 'waiting';
        });

        cb(null, contacts);
      });
    },
    // retrieve groups
    function (cb) {
      am.gm.getGroups(user.id, function (groups) {
        cb(null, groups);
      });
    },
    // increase onlineCounter
    function (cb) {
      am.cm.query('UPDATE users SET loginToken = ?, onlineCounter = onlineCounter + 1 WHERE id = ?', [loginToken, user.id], function (err) {
        am.cm.handleError(err);
        cb();
      });
    }
  ], function (err, results) {
    user.contacts = results[0];
    user.groups = results[1];

    callback(user);

    notifyContacts(am, user.id, 'contact.onlineEvent', {
      contactId: user.id,
      isOnline: true
    });
  });
}

function login(am, email, hash, callback) {
  am.cm.query('SELECT * FROM users WHERE email = ?', email, function (err, result) {
    if (am.cm.handleError(err))
      return callback('ERR');

    if (!result || result.length !== 1 || result[0].hash !== hash)
      return callback('ERR_INVALID_CREDENTIALS');

    var row = result[0];

    if (row.activationCode !== null)
      return callback('ERR_NOT_ACTIVATED');

    loginValid(am, row, callback);
  });
}

AccManager.prototype.login = function (email, hash, callback) {
  login(this, email, hash, callback);
};

function restoreLogin(am, loginToken, callback) {
  am.cm.query('SELECT * FROM users WHERE loginToken = ?', loginToken, function (err, result) {
    if (am.cm.handleError(err))
      return callback('ERR');

    if (!result || result.length !== 1)
      return callback('ERR_TOKEN_INVALID');

    loginValid(am, result[0], callback);
  });
}

AccManager.prototype.restoreLogin = function (loginToken, callback) {
  restoreLogin(this, loginToken, callback);
};

function logout(am, userId, callback) {
  am.cm.query('UPDATE users SET onlineCounter = onlineCounter - 1 WHERE id = ?', [userId], function (err) {
    if (am.cm.handleError(err))
      return callback();

    am.cm.query('SELECT onlineCounter FROM users WHERE id = ?', [userId], function (err, rows) {
      if (am.cm.handleError(err) || !rows || rows.length !== 1)
        return callback();

      if (rows[0].onlineCounter === 0) {
        notifyContacts(am, userId, 'contact.onlineEvent', {
          contactId: userId,
          isOnline: false
        });
      }

      callback();
    });
  });
}

AccManager.prototype.logout = function (userId, callback) {
  logout(this, userId, callback);
};

function lookup(am, query, callback) {
  if (query.length < 4)
    return callback([]);

  am.cm.query('SELECT id, nick FROM users WHERE nick LIKE ?', ['%' + query + '%'], function (err, rows) {
    if (am.cm.handleError(err) || !rows)
      return callback([]);

    callback(rows);
  });
}

AccManager.prototype.lookup = function (query, callback) {
  lookup(this, query, callback);
};

function setFriendshipState(am, userId, targetId, state, isFavorite, callback) {
  var cb = function (err) {
    if (am.cm.handleError(err))
      return callback('ERR');

    callback('OK');

    notifyFriendshipState(am, userId, targetId);
  };

  if (state !== 'none')
    am.cm.query('REPLACE INTO contacts SET leftId = ?, rightId = ?, state = ?, isFavorite = ?', [userId, targetId, state, isFavorite], cb);
  else
    am.cm.query('DELETE FROM contacts WHERE leftId = ? AND rightId = ?', [userId, targetId], cb);
}

AccManager.prototype.setFriendshipState = function (userId, targetId, state, isFavorite, callback) {
  setFriendshipState(this, userId, targetId, state, isFavorite, callback);
};

module.exports = AccManager;


//AccManager.prototype.listeners = { };
//
///**
// * @param {String} event
// * @param {Function} callback
// */
//AccManager.prototype.on = function(event, callback) {
//  if(!(event in this.listeners))
//    this.listeners[event] = [];
//
//  this.listeners[event].push(callback);
//};
//
///**
// * @param {String} event
// * @param {Object} data
// */
//AccManager.prototype.emit = function(event, data) {
//  if(!(event in this.listeners))
//    return;
//
//  for(var k in this.listeners[event])
//    this.listeners[event][k](data);
//};
//
//AccManager.prototype.onError = function(err) {
//  console.error('mysql error', err, err.stack);
//};
//
///**
// * @param {Function} callback
// */
//AccManager.prototype.connect = function(callback) {
//  process.stdout.write('connecting to database... ');
//
//  this.connection.query('SET NAMES UTF8', function(err) {
//    if(err) {
//      console.error('FAILED', err);
//      return;
//    }
//
//    console.log('ok');
//    callback();
//  });
//};
//
///**
// * @param {AccManager} self
// * @param {Function} callback
// * @returns {Function}
// */
//var getCallback = function(self, callback) {
//  return function(err, rows) {
//    if(err)
//      self.onError(err);
//
//    if(!err && rows && rows.length === 1)
//      callback(rows[0]);
//    else
//      callback(null);
//  };
//};
//
///**
// *
// * @param {Number} id
// * @param {Function} callback
// */
//AccManager.prototype.getById = function(id, callback) {
//  this.connection.query('SELECT * FROM users WHERE id = ?', id, getCallback(this, callback));
//};
//
///**
// * @param {String} nick
// * @param {Function} callback
// */
//AccManager.prototype.getByEmail = function(email, callback) {
//  this.connection.query('SELECT * FROM users WHERE email = ?', email, getCallback(this, callback));
//};
//
///**
//  * @param {String} loginToken
// * @param {Function} callback
// */
//AccManager.prototype.getByLoginToken = function(loginToken, callback) {
//  this.connection.query('SELECT * FROM users WHERE loginToken = ?', loginToken, getCallback(this, callback));
//};
//
///**
// * @param {Object} values
// * @param {Function} callback
// */
//AccManager.prototype.create = function(values, callback) {
//  var self = this;
//  this.connection.query('INSERT INTO users SET ?', values, function(err, result) {
//    if(err)
//      self.onError(err);
//
//    callback(!err && result !== undefined && result.insertId > 0);
//  });
//};
//
///**
// *
// * @param {Number} id
// * @param {Function} callback
// *//*
//AccManager.prototype.delete = function(id, callback) {
//  var self = this;
//  this.connection.query('DELETE FROM users WHERE id = ?', id, function(err, result) {
//    if(err)
//      self.onError(err);
//
//    callback(!err && result !== undefined);
//  });
//};*/
//
///**
// * @param {Number} id
// * @param {Object} values
// * @param {Function} callback
// */
//AccManager.prototype.update = function(id, values, callback) {
//  var self = this;
//  this.connection.query('UPDATE users SET ? WHERE id = ?', [values, id], function(err, result) {
//    if(err)
//      self.onError(err);
//
//    callback(!err && result !== undefined);
//  });
//};
//
///**
// * @param {String} code
// * @param {Function} callback
// */
//AccManager.prototype.activateAccount = function(code, callback) {
//  var self = this;
//  this.connection.query('UPDATE users SET activationCode = NULL WHERE activationCode = ?', code, function(err, result) {
//    if(err)
//      self.onError(err);
//
//    callback(!err && result !== undefined && result.affectedRows > 0);
//  });
//};
//
///**
// * @param {Number} groupId
// * @param {Function} callback
// */
//AccManager.prototype.getGroup = function(groupId, callback) {
//  var self = this;
//  self.connection.query('SELECT * FROM groups WHERE id = ?', groupId, getCallback(self, function(group) {
//    if(group === null)
//      return null;
//
//    self.connection.query('SELECT userId AS id, users.nick AS nick, role, isBanned, doNotInviteAgain FROM groupUsers JOIN users ON users.id = userId WHERE groupId = ?', groupId, function(err, rows) {
//      if(err)
//        return self.onError(err);
//
//      group.members = rows;
//
//      callback(group);
//    });
//  }));
//};
//
///**
// * @param {Number} userId
// * @param {Function} callback
// */
//AccManager.prototype.getGroups = function(userId, callback) {
//  var self = this;
//  this.connection.query('SELECT groupId, role, isBanned, doNotInviteAgain, isFavorite FROM groupUsers WHERE userId = ?', userId, function(err, rows) {
//    if(err)
//      return self.onError(err);
//
//    var groups = [];
//
//    var left = rows.length;
//    var done = function() {
//      if(left !== 0)
//        return;
//
//      callback(groups);
//    };
//
//    var cb = function(row) {
//      return function(group) {
//        group.role = row.role;
//        group.isBanned = row.isBanned;
//        group.doNotInviteAgain = row.doNotInviteAgain;
//        group.isFavorite = row.isFavorite;
//
//        for(var k in group.members) {
//          var m = group.members[k];
//          if(m.id !== userId)
//            continue;
//
//          group.members.splice(k, 1);
//          break;
//        }
//
//        groups.push(group);
//
//        left--;
//        done();
//      };
//    };
//
//    for(var k in rows) {
//      var group = rows[k];
//
//      self.getGroup(group.groupId, cb(group));
//    }
//
//    done();
//  });
//};
//
///**
// * @param {Number} userId
// * @param {Number} groupId
// * @param {Number} inviterId
// * @param {Function} callback
// */
//AccManager.prototype.inviteToGroup = function(userId, groupId, inviterId, callback) {
//  var self = this;
//  self.getById(userId, function(user) {
//    if(user === null)
//      return callback(false); // user not found
//
//    self.connection.query('SELECT * FROM groupUsers WHERE userId = ? AND groupId = ?', [userId, groupId], function(err, rows) {
//      if(err)
//        return self.onError(err);
//
//      if(rows && rows.length)
//        return callback(false); // already member
//
//      self.getGroup(groupId, function(group) {
//        if(group === null)
//          return callback(false); // group doesn't exist
//
//        self.connection.query('INSERT INTO groupUsers SET ?', {
//          groupId: groupId,
//          userId: userId,
//          role: 'member'
//        }, function(err, result) {
//          if(err)
//            self.onError(err);
//
//          var result = !err && result !== undefined;
//          callback(result);
//
//          self.emit('group invitation', {
//            group: group,
//            user: user,
//            inviterId: inviterId
//          });
//        });
//      });
//    });
//  });
//};
//
///**
// * @param {Number} userId
// * @param {Number} groupId
// * @param {Boolean} doNotInviteAgain
// * @param {Function} callback
// */
//AccManager.prototype.leaveGroup = function(userId, groupId, doNotInviteAgain, callback) {
//  var self = this;
//
//  var cb = function(err, result) {
//    if(err)
//      self.onError(err);
//
//    self.connection.query('SELECT * FROM groupUsers WHERE groupId = ?', groupId, function(err, rows) {
//      if(err)
//        self.onError(err);
//
//      if(result !== undefined) {
//        var invalid = [];
//
//        for(var k in rows) {
//          var row = rows[k];
//          if(row.isBanned || row.doNotInviteAgain)
//            invalid.push(row.userId);
//          else
//            return;
//        }
//
//        self.connection.query('DELETE FROM groupUsers WHERE groupId = ?', groupId, function(err) {
//          if(err)
//            return self.onError(err);
//
//          self.connection.query('DELETE FROM groups WHERE id = ?', groupId, function(err) {
//            if(err)
//              return self.onError(err);
//
//            self.emit('group remove', {
//              userIds: invalid,
//              groupId: groupId
//            });
//          });
//        });
//      }
//    });
//
//    var res = !err && result && result.affectedRows === 1;
//
//    if(res) {
//      self.emit('group member leave', {
//        memberId: userId,
//        groupId: groupId
//      });
//    }
//
//    callback(res);
//  };
//
//  if(doNotInviteAgain)
//    self.connection.query('UPDATE groupUsers SET doNotInviteAgain = 1 WHERE userId = ? AND groupId = ?', [userId, groupId], cb);
//  else
//    self.connection.query('DELETE FROM groupUsers WHERE userId = ? AND groupId = ?', [userId, groupId], cb);
//};
//
///**
// * @param {Number} creatorId
// * @param {Function} callback
// */
//AccManager.prototype.createGroup = function(creatorId, callback) {
//  var self = this;
//
//  self.connection.query('INSERT INTO groups VALUES ()', function(err, result) {
//    if(err)
//      return self.onError(err);
//
//    var groupId = result.insertId;
//
//    self.connection.query('INSERT INTO groupUsers SET groupId = ?, userId = ?, role = ?', [groupId, creatorId, 'admin'], function(err) {
//      if(err)
//        return self.onError(err);
//
//      callback(groupId);
//    });
//  });
//};
//
///**
// * @param {Number} userId
// * @param {Number} groupId
// * @param {Function} callback
// */
//AccManager.prototype.isValidGroupMember = function(userId, groupId, callback) {
//  this.connection.query('SELECT userId FROM groupUsers WHERE userId = ? AND groupId = ? AND isBanned = 0 AND doNotInviteAgain = 0', [userId, groupId], getCallback(this, function(result) {
//    callback(result !== null);
//  }));
//};
//
///**
// * @param {String} search
// * @param {Number} userId
// * @param {Function} callback
// */
//AccManager.prototype.searchAccounts = function(search, userId, callback) {
//  var self = this;
//
//  self.getFriendlist(userId, function(results) {
//    var except = [userId];
//
//    for(var k in results) {
//      if(results[k].state === 'denied')
//        continue;
//
//      except.push(results[k].id);
//    }
//
//    self.connection.query('SELECT id, nick, created FROM users WHERE (nick LIKE ? OR email = ?) AND id NOT IN (?)', ['%' + search + '%', search, except], function(err, rows) {
//      if(err)
//        return self.onError(err);
//
//      callback(rows);
//    });
//  });
//};
//
///**
// * @param {Number} invokerId
// * @param {Number} targetId
// * @param {Function} callback
// */
//AccManager.prototype.requestFriendship = function(invokerId, targetId, callback) {
//  var self = this;
//
//  self.getById(invokerId, function(invoker) {
//    if(invoker === null)
//      return self.onError(new Error('invokerId invalid'));
//
//    self.connection.query('INSERT INTO friendlist SET invokerId = ?, targetId = ?', [invokerId, targetId], function(err, result) {
//      if(err)
//        self.onError(err);
//
//      var res = !err && result !== undefined;
//
//      if(res) {
//        self.emit('friend request', {
//          userId: targetId,
//          invoker: {
//            id: invoker.id,
//            nick: invoker.nick
//          }
//        });
//      }
//
//      callback(res);
//    });
//  });
//};
//
///**
// * @param {Number} userId
// * @param {Number} invokerId
// * @param {String} decision
// * @param {Function} callback
// */
//AccManager.prototype.respondFriendship = function(userId, invokerId, decision, callback) {
//  var self = this;
//
//  var done = function() {
//    self.emit('friend response', {
//      userId: invokerId,
//      targetId: userId,
//      decision: decision
//    });
//  };
//
//  if(decision === 'denied') {
//    self.connection.query('DELETE FROM friendlist WHERE invokerId = ? AND targetId = ?', [invokerId, userId], function(err, result) {
//      if(err)
//        self.onError(err);
//
//      done();
//      callback(!err && result && result.affectedRows === 1);
//    });
//
//    return;
//  }
//
//  self.connection.query('UPDATE friendlist SET state = ? WHERE invokerId = ? AND targetId = ? AND state IS NULL', [decision, invokerId, userId], function(err, result) {
//    if(err)
//      return self.onError(err);
//
//    var res = !err && result.affectedRows === 1;
//
//    if(res) {
//      done();
//
//      if(decision === 'accepted')
//        self.promoteOnline(userId, invokerId);
//    }
//
//    callback(res);
//  });
//};
//
///**
// * @param {Number} user1
// * @param {Number} user2
// * @param {Function} callback
// */
//AccManager.prototype.getFriendship = function(user1, user2, callback) {
//  var self = this;
//
//  self.connection.query('SELECT * FROM friendlist WHERE (invokerId = ? AND targetId = ?) OR (targetId = ? AND invokerId = ?)', [user1, user2, user1, user2], getCallback(self, callback));
//};
//
///**
// * @param {Number} userId
// * @param {Function} callback
// */
//AccManager.prototype.getFriendlist = function(userId, callback) {
//  var self = this;
//
//  self.connection.query('SELECT * FROM friendlist WHERE invokerId = ? OR targetId = ?', [userId, userId], function(err, rows) {
//    if(err)
//      return self.onError(err);
//
//    var friends = [];
//    var done = function() {
//      callback(friends);
//    };
//
//    var left = rows.length;
//    var cb = function(friendship) {
//      return function(user) {
//        if(user !== null) {
//          friends.push({
//            id: user.id,
//            nick: user.nick,
//            isOnline: friendship.state === 'accepted' && user.onlineCounter > 0,
//            state: friendship.state,
//            invokerId: friendship.invokerId,
//            isFavorite: friendship.isFavorite
//          });
//        }
//
//        left--;
//        if(left === 0)
//          done();
//      };
//    };
//
//    for(var k in rows) {
//      var row = rows[k];
//      var id;
//      if(row.invokerId === userId)
//        id = row.targetId;
//      else
//        id = row.invokerId;
//
//      self.getById(id, cb(row));
//    }
//
//    if(rows.length === 0)
//      done();
//  });
//};
//
///**
// * @param {String} op
// * @param {Number} counter
// * @param {String} action
// * @returns {Function}
// */
//var onlineOffline = function(op, counter, action) {
//  return function(userId) {
//    var self = this;
//
//    self.connection.query('UPDATE users SET onlineCounter = onlineCounter ' + op + ' 1 WHERE id = ?', userId, function(err) {
//      if(err)
//        return self.onError(err);
//
//      self.connection.query('SELECT onlineCounter FROM users WHERE id = ?', userId, function(err, rows) {
//        if(err)
//          return self.onError(err);
//
//        if(rows.length !== 1 || rows[0].onlineCounter !== counter)
//          return;
//
//        self.getFriendlist(userId, function(friendlist) {
//          for(var k in friendlist) {
//            var friend = friendlist[k];
//
//            if(!friend.isOnline)
//              continue;
//
//            self.emit('friend ' + action, {
//              userId: friend.id,
//              friendId: userId
//            });
//          }
//        });
//      });
//    });
//  };
//};
//
//AccManager.prototype.setOnline = onlineOffline('+', 1, 'online');
//AccManager.prototype.setOffline = onlineOffline('-', 0, 'offline');
//
///**
// * @param {Function} callback
// */
//AccManager.prototype.resetOnlineCounters = function(callback) {
//  var self = this;
//
//  process.stdout.write('setting all accounts offline... ');
//  self.connection.query('UPDATE users SET onlineCounter = 0', undefined, function(err) {
//    if(err)
//      return self.onError(err);
//
//    console.log('ok');
//    callback();
//  });
//};
//
//AccManager.prototype.promoteOnline = function(user1, user2, callback) {
//  var self = this;
//
//  self.connection.query('SELECT id, onlineCounter FROM users WHERE id = ? OR id = ?', [user1, user2], function(err, rows) {
//    if(err)
//      return self.onError(err);
//
//    for(var k in rows) {
//      var row = rows[k];
//      var state = row.onlineCounter > 0 ? 'online' : 'offline';
//
//      self.emit('friend ' + state, {
//        userId: row.id,
//        friendId: row.id === user1 ? user2 : user1
//      });
//    }
//
//    if(callback)
//      callback();
//  });
//};
//
//module.exports = AccManager;
