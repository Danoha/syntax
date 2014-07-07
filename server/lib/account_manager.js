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

var AccManager = function(credentials) {
  this.connection = MySQL.createConnection(credentials);
  
  this.handleServerDisconnect(this.connection);
};

AccManager.prototype.listeners = { };

/**
 * @param {String} event
 * @param {Function} callback
 */
AccManager.prototype.on = function(event, callback) {
  if(!(event in this.listeners))
    this.listeners[event] = [];
  
  this.listeners[event].push(callback);
};

/**
 * @param {String} event
 * @param {Object} data
 */
AccManager.prototype.emit = function(event, data) {
  if(!(event in this.listeners))
    return;
  
  for(var k in this.listeners[event])
    this.listeners[event][k](data);
};

AccManager.prototype.handleServerDisconnect = function(conn) {
  var self = this;
  conn.on('error', function(err) {
    if (!err.fatal)
      return;

    if (err.code !== 'PROTOCOL_CONNECTION_LOST')
      throw err;

    console.log('reconnecting lost connection: ' + err.stack);

    self.connection = MySQL.createConnection(conn.config);
    self.handleServerDisconnect(self.connection);
    self.connection.connect();
  });
};

AccManager.prototype.onError = function(err) {
  console.error('mysql error', err);
};

/**
 * @param {Function} callback
 */
AccManager.prototype.connect = function(callback) {
  process.stdout.write('connecting to database... ');
  
  this.connection.query('SET NAMES UTF8', function(err) {
    if(err) {
      console.error('FAILED', err);
      return;
    }

    console.log('ok');
    callback();
  });
};

/**
 * @param {AccManager} self
 * @param {Function} callback
 * @returns {Function}
 */
var getCallback = function(self, callback) {
  return function(err, rows) {
    if(err)
      self.onError(err);
    
    if(!err && rows && rows.length === 1)
      callback(rows[0]);
    else
      callback(null);
  };
};

/**
 * 
 * @param {Number} id
 * @param {Function} callback
 */
AccManager.prototype.getById = function(id, callback) {
  this.connection.query('SELECT * FROM users WHERE id = ?', id, getCallback(this, callback));
};

/**
 * @param {String} nick
 * @param {Function} callback
 */
AccManager.prototype.getByEmail = function(email, callback) {
  this.connection.query('SELECT * FROM users WHERE email = ?', email, getCallback(this, callback));
};

/**
  * @param {String} loginToken
 * @param {Function} callback
 */
AccManager.prototype.getByLoginToken = function(loginToken, callback) {
  this.connection.query('SELECT * FROM users WHERE loginToken = ?', loginToken, getCallback(this, callback));
};

/**
 * @param {Object} values
 * @param {Function} callback
 */
AccManager.prototype.create = function(values, callback) {
  var self = this;
  this.connection.query('INSERT INTO users SET ?', values, function(err, result) {
    if(err)
      self.onError(err);
    
    callback(!err && result !== undefined && result.insertId > 0);
  });
};

/**
 * 
 * @param {Number} id
 * @param {Function} callback
 *//*
AccManager.prototype.delete = function(id, callback) {
  var self = this;
  this.connection.query('DELETE FROM users WHERE id = ?', id, function(err, result) {
    if(err)
      self.onError(err);
    
    callback(!err && result !== undefined);
  });
};*/

/**
 * @param {Number} id
 * @param {Object} values
 * @param {Function} callback
 */
AccManager.prototype.update = function(id, values, callback) {
  var self = this;
  this.connection.query('UPDATE users SET ? WHERE id = ?', [values, id], function(err, result) {
    if(err)
      self.onError(err);
    
    callback(!err && result !== undefined);
  });
};

/**
 * @param {String} code
 * @param {Function} callback
 */
AccManager.prototype.activateAccount = function(code, callback) {
  var self = this;
  this.connection.query('UPDATE users SET activationCode = NULL WHERE activationCode = ?', code, function(err, result) {
    if(err)
      self.onError(err);
    
    callback(!err && result !== undefined && result.affectedRows > 0);
  });
};

/**
 * @param {Number} userId
 * @param {Function} callback
 */
AccManager.prototype.getGroups = function(userId, callback) {
  var self = this;
  this.connection.query('SELECT * FROM groupUsers JOIN groups ON group.id = groupUsers.groupId WHERE userId = ?', userId, function(err, result) {
    if(err)
      return self.onError(err);
    
    callback(result);
  });
};

/**
 * @param {Number} userId
 * @param {Number} groupId
 * @param {Function} callback
 */
AccManager.prototype.addToGroup = function(userId, groupId, emitInvite, callback) {
  var self = this;
  this.connection.query('SELECT * FROM groupUsers WHERE userId = ? AND groupId = ?', [userId, groupId], function(err, rows) {
    if(err)
      return self.onError(err);
    
    if(rows && rows.length)
      return callback(false); // already member
    
    self.connection.query('SELECT id FROM groups WHERE id = ?', groupId, function(err, rows) {
      if(err)
        return self.onError(err);
      
      if(!rows || !rows.length)
        return callback(false); // group doesn't exist
      
      self.connection.query('INSERT INTO groupUsers SET ?', {
        groupId: groupId,
        userId: userId,
        role: 'member'
      }, function(err, result) {
        if(err)
          self.onError(err);
        
        var result = !err && result !== undefined;
        callback(result);
        
        if(emitInvite) {
          self.emit('group invite', {
            groupId: groupId,
            userId: userId
          });
        }
      });
    });
  });
};

/**
 * @param {Number} userId
 * @param {Number} groupId
 * @param {Boolean} doNotInviteAgain
 * @param {Function} callback
 */
AccManager.prototype.leaveGroup = function(userId, groupId, doNotInviteAgain, callback) {
  var self = this;
  
  var cb = function(err, result) {
    if(err)
      self.onError(err);
    
    self.connection.query('SELECT * FROM groupUsers WHERE groupId = ?', groupId, function(err, rows) {
      if(err)
        self.onError(err);
      
      if(result !== undefined) {
        var invalid = [];
        
        for(var k in rows) {
          var row = rows[k];
          if(row.isBanned || row.doNotInviteAgain)
            invalid.push(row.userId);
          else
            return;
        }
       
        self.connection.query('DELETE FROM groupUsers WHERE groupId = ?', groupId, function(err) {
          if(err)
            return self.onError(err);
          
          self.connection.query('DELETE FROM groups WHERE id = ?', groupId, function(err) {
            if(err)
              return self.onError(err);

            self.emit('group remove', {
              userIds: invalid,
              groupId: groupId
            });
          });
        });
      }
    });
    
    callback(!err && result && result.affectedRows === 1);
  };
  
  if(doNotInviteAgain)
    self.connection.query('UPDATE groupUsers SET doNotInviteAgain = 1 WHERE userId = ? AND groupId = ?', [userId, groupId], cb);
  else
    self.connection.query('DELETE FROM groupUsers WHERE userId = ? AND groupId = ?', [userId, groupId], cb);
};

/**
 * @param {Number} creatorId
 * @param {Array} memberIds
 * @param {Function} callback
 */
AccManager.prototype.createGroup = function(creatorId, memberIds, callback) {
  var self = this;
  
  self.connection.query('INSERT INTO groups VALUES ()', function(err, result) {
    if(err)
      return self.onError(err);
 
    var groupId = result.insertId;
    memberIds.push(creatorId);
    var left = memberIds.length;
    var end = function() {
      if(left !== 0)
        return;
      
      self.connection.query('UPDATE groupUsers SET role = ? WHERE groupId = ? AND userId = ?', ['admin', groupId, creatorId], function(err) {
        if(err)
          return self.onError(err);
        
        callback(groupId);
      });
    };
    
    for(var k in memberIds) {
      var memberId = memberIds[k];
      self.addToGroup(memberId, groupId, memberId !== creatorId, function(done) {
        left--;
        end();
      });
    }
    
    end();
  });
};

/**
 * @param {String} search
 * @param {Number} userId
 * @param {Function} callback
 */
AccManager.prototype.searchAccounts = function(search, userId, callback) {
  var self = this;
  
  self.getFriendlist(userId, function(results) {
    var except = [userId];
    
    for(var k in results) {
      if(results[k].state === 'denied')
        continue;
      
      except.push(results[k].id);
    }
    
    self.connection.query('SELECT id, nick, created FROM users WHERE (nick LIKE ? OR email = ?) AND id NOT IN (?)', ['%' + search + '%', search, except], function(err, rows) {
      if(err)
        return self.onError(err);

      callback(rows);
    });
  });
};

/**
 * @param {Number} invokerId
 * @param {Number} targetId
 * @param {Function} callback
 */
AccManager.prototype.requestFriendship = function(invokerId, targetId, callback) {
  var self = this;
  
  self.getById(invokerId, function(invoker) {
    if(invoker === null)
      return self.onError(new Error('invokerId invalid'));
    
    self.connection.query('INSERT INTO friendlist SET invokerId = ?, targetId = ?', [invokerId, targetId], function(err, result) {
      if(err)
        self.onError(err);

      var res = !err && result !== undefined;

      if(res) {
        self.emit('friend request', {
          userId: targetId,
          invoker: {
            id: invoker.id,
            nick: invoker.nick
          }
        });
      }

      callback(res);
    });
  });
};

/**
 * @param {Number} userId
 * @param {Number} invokerId
 * @param {String} decision
 * @param {Function} callback
 */
AccManager.prototype.respondFriendship = function(userId, invokerId, decision, callback) {
  var self = this;
  
  var done = function() {
    self.emit('friend response', {
      userId: invokerId,
      targetId: userId,
      decision: decision
    });
  };
  
  if(decision === 'denied') {
    self.connection.query('DELETE FROM friendlist WHERE invokerId = ? AND targetId = ?', [invokerId, userId], function(err, result) {
      if(err)
        self.onError(err);
      
      done();
      callback(!err && result && result.affectedRows === 1);
    });
    
    return;
  }
  
  self.connection.query('UPDATE friendlist SET state = ? WHERE invokerId = ? AND targetId = ? AND state IS NULL', [decision, invokerId, userId], function(err, result) {
    if(err)
      return self.onError(err);
    
    var res = !err && result.affectedRows === 1;
    
    if(res) {
      done();

      if(decision === 'accepted')
        self.promoteOnline(userId, invokerId);
    }
    
    callback(res);
  });
};

/**
 * @param {Number} user1
 * @param {Number} user2
 * @param {Function} callback
 */
AccManager.prototype.getFriendship = function(user1, user2, callback) {
  var self = this;
  
  self.connection.query('SELECT * FROM friendlist WHERE (invokerId = ? AND targetId = ?) OR (targetId = ? AND invokerId = ?)', [user1, user2, user1, user2], getCallback(self, callback));
};

/**
 * @param {Number} userId
 * @param {Function} callback
 */
AccManager.prototype.getFriendlist = function(userId, callback) {
  var self = this;
  
  self.connection.query('SELECT * FROM friendlist WHERE invokerId = ? OR targetId = ?', [userId, userId], function(err, rows) {
    if(err)
      return self.onError(err);
    
    var friends = [];
    var done = function() {
      callback(friends);
    };
    
    var left = rows.length;
    var cb = function(friendship) {
      return function(user) {
        if(user !== null) {
          friends.push({
            id: user.id,
            nick: user.nick,
            isOnline: friendship.state === 'accepted' && user.onlineCounter > 0,
            state: friendship.state,
            invokerId: friendship.invokerId
          });
        }
        
        left--;
        if(left === 0)
          done();
      };
    };
    
    for(var k in rows) {
      var row = rows[k];
      var id;
      if(row.invokerId === userId)
        id = row.targetId;
      else
        id = row.invokerId;
      
      self.getById(id, cb(row));
    }
    
    if(rows.length === 0)
      done();
  });
};

/**
 * @param {String} op
 * @param {Number} counter
 * @param {String} action
 * @returns {Function}
 */
var onlineOffline = function(op, counter, action) {
  return function(userId) {
    var self = this;
  
    self.connection.query('UPDATE users SET onlineCounter = onlineCounter ' + op + ' 1 WHERE id = ?', userId, function(err) {
      if(err)
        return self.onError(err);

      self.connection.query('SELECT onlineCounter FROM users WHERE id = ?', userId, function(err, rows) {
        if(err)
          return self.onError(err);

        if(rows.length !== 1 || rows[0].onlineCounter !== counter)
          return;

        self.getFriendlist(userId, function(friendlist) {
          for(var k in friendlist) {
            var friend = friendlist[k];
            
            if(!friend.isOnline)
              continue;
            
            self.emit('friend ' + action, {
              userId: friend.id,
              friendId: userId
            });
          }
        });
      });
    });
  };
};

AccManager.prototype.setOnline = onlineOffline('+', 1, 'online');
AccManager.prototype.setOffline = onlineOffline('-', 0, 'offline');

/**
 * @param {Function} callback
 */
AccManager.prototype.resetOnlineCounters = function(callback) {
  var self = this;
  
  process.stdout.write('setting all accounts offline... ');
  self.connection.query('UPDATE users SET onlineCounter = 0', undefined, function(err) {
    if(err)
      return self.onError(err);
    
    console.log('ok');
    callback();
  });
};

AccManager.prototype.promoteOnline = function(user1, user2, callback) {
  var self = this;
  
  self.connection.query('SELECT id, onlineCounter FROM users WHERE id = ? OR id = ?', [user1, user2], function(err, rows) {
    if(err)
      return self.onError(err);
    
    for(var k in rows) {
      var row = rows[k];
      var state = row.onlineCounter > 0 ? 'online' : 'offline';
      
      self.emit('friend ' + state, {
        userId: row.id,
        friendId: row.id === user1 ? user2 : user1
      });
    }
    
    if(callback)
      callback();
  });
};

module.exports = AccManager;
