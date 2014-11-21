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

function MsgManager(accMan, grpMan) {
  this.am = accMan;
  this.gm = grpMan;

  this.messageNotifiers = [];
}

function invokeArray(arr, args) {
  arr.forEach(function(i) {
    i.apply(undefined, args);
  });
}

function process(mm, msg, senderId, callback) {
  msg.senderId = senderId;
  msg.time = moment().unix();

  var d = function(type, id) {
    callback('OK');
    invokeArray(mm.messageNotifiers, [type, id, msg]);
  };

  if(typeof msg.recipientId === 'number') {
    mm.am.getFriendshipState(senderId, msg.recipientId, function(state) {
      if(state.left === 'accepted' && state.right === 'accepted')
        d('c2c', [msg.recipientId, senderId]);
      else
        callback('ERR_INVALID_TARGET');
    });
  } else
    return callback('ERR_INVALID_VALUES');
}

MsgManager.prototype.process = function(msg, senderId, callback) {
  process(this, msg, senderId, callback);
};

module.exports = MsgManager;