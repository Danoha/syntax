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
    if (state.left === 'none')
      return;

    if (state.right !== 'accepted')
      state.right = 'waiting';

    getContact(am, contactId, function (contact) {
      if (state.left !== 'accepted' || state.right !== 'accepted')
        contact.isOnline = false;

      notifyUser(am, userId, 'contact.friendshipStateEvent', {
        contact: contact,
        state: state
      });
    });
  }

  getFriendshipState(am, leftId, rightId, function (state) {
    n(leftId, rightId, {
      left: state.left,
      right: state.right
    });
    n(rightId, leftId, {
      left: state.right,
      right: state.left
    });
  });
}

function notifyContacts(am, userId, name, data, onlyAccepted) {
  listContacts(am, userId, function (contacts) {
    contacts.forEach(function (row) {
      if (onlyAccepted && (row.state.left !== 'accepted' || row.state.right !== 'accepted'))
        return;

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

          if (c.state.left !== 'accepted' || c.state.right !== 'accepted')
            c.isOnline = false;

          if (c.state.left === 'none')
            c.state.left = 'waiting';
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
    // increase onlineCounter and update loginToken
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
    }, true);
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
        }, true);
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
  var done = function () {
    callback('OK');

    notifyFriendshipState(am, userId, targetId);
  };

  var cb = function (err) {
    if (am.cm.handleError(err))
      return callback('ERR');

    if (state !== 'accepted')
      done();
    else {
      am.cm.query('SELECT COUNT(*) AS c FROM contacts WHERE leftId = ? AND rightId = ?', [targetId, userId], function (err, rows) {
        if (am.cm.handleError(err))
          return callback('ERR');

        if (rows && rows.length === 1 && rows[0].c === 1)
          done();
        else {
          am.cm.query('INSERT INTO contacts SET leftId = ?, rightId = ?, state = ?, isFavorite = 0', [targetId, userId, 'waiting'], function (err) {
            if (am.cm.handleError(err) || err)
              return callback('ERR');

            done();
          });
        }
      });
    }
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