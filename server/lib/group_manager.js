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

var async = require('async');
var utils = require('./utils.js');

//

var GrpManager = function (connMan, accMan) {
  this.cm = connMan;
  this.am = accMan;

  /**
   * @type {Function[]}
   */
  this.userNotifiers = [];

  /**
   * @type {Function[]}
   */
  this.groupNotifiers = [];
};

function getMembershipState(gm, userId, groupId, callback) {
  gm.cm.query('SELECT isBanned, doNotInviteAgain FROM groupUsers WHERE userId = ? AND groupId = ?', [userId, groupId], function (err, rows) {
    if (gm.cm.handleError(err) || !rows || rows.length !== 1)
      return callback(null);

    callback(rows[0]);
  });
}

GrpManager.prototype.getMembershipState = function (userId, groupId, callback) {
  getMembershipState(this, userId, groupId, callback);
};

function getGroup(gm, groupId, callback) {
  async.parallel([
    // get group data
    function (cb) {
      gm.cm.query('SELECT id, topic FROM groups WHERE id = ?', [groupId], function (err, rows) {
        if (gm.cm.handleError(err) || !rows || rows.length !== 1)
          cb(true);

        cb(null, rows[0]);
      });
    },
    // get group members
    function (cb) {
      gm.cm.query('SELECT isBanned, doNotInviteAgain, role, u.id AS id, u.nick AS nick FROM groupUsers JOIN users AS u ON u.id = groupUsers.userId WHERE groupId = ?', [groupId], function (err, rows) {
        if (gm.cm.handleError(err) || !rows)
          cb(true);

        cb(null, rows);
      });
    }
  ], function (err, results) {
    if (err)
      return callback(null);

    var group = results[0];
    group.members = results[1];

    callback(group);
  });
}

function getGroups(gm, userId, callback) {
  gm.cm.query('SELECT groupId FROM groupUsers WHERE userId = ?', [userId], function (err, rows) {
    if (gm.cm.handleError(err) || !rows)
      return callback([]);

    var tasks = [];
    rows.forEach(function (r) {
      tasks.push(function (cb) {
        getGroup(gm, r.groupId, function (group) {
          cb(null, group);
        });
      });
    });

    async.parallel(tasks, function (err, results) {
      callback(results.filter(function (group) {
        return group !== null;
      }));
    });
  });
}

GrpManager.prototype.getGroups = function (userId, callback) {
  getGroups(this, userId, callback);
};

function collapseEmptyGroup(gm, groupId) {
  gm.cm.query('SELECT userId, isBanned, doNotInviteAgain FROM groupUsers WHERE groupId = ?', groupId, function (err, rows) {
    if (gm.cm.handleError(err) || !rows)
      return;

    var zombies = [];

    for (var i in rows) {
      if (!rows.hasOwnProperty(i))
        continue;

      if (!rows[i].isBanned && !rows[i].doNotInviteAgain)
        return;

      zombies.push(rows[i].userId);
    }

    async.parallel([
      // delete group
      function (cb) {
        gm.cm.query('DELETE FROM groups WHERE id = ?', [groupId], function (err) {
          gm.cm.handleError(err);
          cb();
        });
      },
      // delete zombies
      function (cb) {
        gm.cm.query('DELETE FROM groupUsers WHERE groupId = ?', [groupId], function (err) {
          gm.cm.handleError(err);
          cb();
        });
      }
    ], function () {
      utils.invokeArray(gm.userNotifiers, [zombies, 'group.destroyEvent', {
        groupId: groupId
      }]);
    });
  });
}

function create(gm, userId, callback) {
  gm.cm.query('INSERT INTO groups VALUES ()', function (err, result) {
    if (gm.cm.handleError(err) || !result || !result.insertId)
      return callback('ERR');

    var groupId = result.insertId;

    gm.cm.query('INSERT INTO groupUsers SET groupId = ?, userId = ?, role = ?', [groupId, userId, 'admin'], function (err) {
      gm.cm.handleError(err);

      callback({
        groupId: groupId
      });
    });
  });
}

GrpManager.prototype.create = function (userId, callback) {
  create(this, userId, callback);
};

function invite(gm, userId, inviteeId, groupId, callback) {
  async.parallel([
    // get contact
    function (cb) {
      gm.am.getContact(inviteeId, function (contact) {
        cb(contact === null ? 'ERR_NOT_FRIENDS' : null, contact);
      });
    },
    // get group
    function (cb) {
      getGroup(gm, groupId, function (group) {
        cb(group === null ? 'ERR_GROUP_NOT_FOUND' : null, group);
      });
    },
    // check friendship state
    function (cb) {
      gm.am.getFriendshipState(userId, inviteeId, function (state) {
        cb((state.left === 'accepted' && state.right === 'accepted') ? null : 'ERR_NOT_FRIENDS');
      });
    },
    // check if user can be invited
    function (cb) {
      getMembershipState(gm, inviteeId, groupId, function (state) {
        cb((state === null || (!state.isBanned && !state.doNotInviteAgain)) ? null : 'ERR_CANNOT_INVITE');
      });
    }
  ], function (err, results) {
    if (err)
      return callback(err);

    gm.cm.query('INSERT INTO groupUsers SET ?', {
      userId: inviteeId,
      groupId: groupId,
      role: 'member'
    }, function (err) {
      if (gm.cm.handleError(err) || err)
        return callback('ERR');

      delete results[0].isOnline;

      utils.invokeArray(gm.groupNotifiers, [[groupId], 'group.inviteEvent', {
        inviterId: userId,
        groupId: groupId,
        member: results[0]
      }]);

      utils.invokeArray(gm.userNotifiers, [[inviteeId], 'group.inviteEvent', {
        inviterId: userId,
        group: results[1]
      }]);

      callback('OK');
    });
  });
}

GrpManager.prototype.invite = function (userId, inviteeId, groupId, callback) {
  invite(this, userId, inviteeId, groupId, callback);
};

function leave(gm, userId, groupId, doNotInviteAgain, callback) {
  var cb = function (err) {
    if (gm.cm.handleError(err))
      return callback('ERR');

    collapseEmptyGroup(gm, groupId);

    utils.invokeArray(gm.groupNotifiers, [[groupId], 'group.memberLeftEvent', {
      memberId: userId,
      groupId: groupId
    }]);

    callback('OK');
  };

  if (doNotInviteAgain)
    gm.cm.query('UPDATE groupUsers SET doNotInviteAgain = 1 WHERE userId = ? AND groupId = ?', [userId, groupId], cb);
  else
    gm.cm.query('DELETE FROM groupUsers WHERE userId = ? AND groupId = ?', [userId, groupId], cb);
}

GrpManager.prototype.leave = function (userId, groupId, doNotInviteAgain, callback) {
  leave(this, userId, groupId, doNotInviteAgain, callback);
};

module.exports = GrpManager;
