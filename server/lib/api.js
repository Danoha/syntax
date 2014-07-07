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

var crypto = require('crypto');
var fs = require('fs');
var Dns = require('./dns.js');
var moment = require('moment');

//

/**
 * 
 * @param {AccManager} accMan
 * @param {NodeMailer} mailer
 * @returns {Api}
 */
var Api = function(accMan, mailer) {
  this.accMan = accMan;
  this.mailer = mailer;
  
  var self = this;
  new Dns().getHostname(function(hostname) {
    self.hostname = hostname;
    console.log('api ready (hostname seems to be ' + self.hostname + ')');
  });
  
  this.accMan.on('group invite', function(data) {
    self.io.to('user-' + data.userId).emit('group invite', {
      groupId: data.groupId
    });
  });
  
  this.accMan.on('group remove', function(data) {
    var obj = { groupId: data.groupId };
    for(var k in data.userIds) {
      var id = data.userIds[k];
      self.io.to('user-' + id).emit('group remove', obj);
    }
  });
  
  this.accMan.on('friend request', function(data) {
    self.io.to('user-' + data.userId).emit('friend request', {
      invoker: data.invoker
    });
  });
  
  this.accMan.on('friend response', function(data) {
    self.io.to('user-' + data.userId).emit('friend response', {
      targetId: data.targetId,
      decision: data.decision
    });
  });
  
  this.accMan.on('friend online', function(data) {
    self.io.to('user-' + data.userId).emit('friend online', {
      friendId: data.friendId
    });
  });
  
  this.accMan.on('friend offline', function(data) {
    self.io.to('user-' + data.userId).emit('friend offline', {
      friendId: data.friendId
    });
  });
};

Api.prototype.setIO = function(io) {
  this.io = io;
};

Api.prototype.defaultListeners = { disconnect: 'destroySession', login: 'login', 'create account': 'createAccount', 'activate account': 'activateAccount', 'restore login': 'restoreLogin' };
Api.prototype.loggedInListeners = { logout: 'logout',  'chat message': 'chatMessage', 'friend request': 'friendRequest', 'friend response': 'friendResponse', 'search accounts': 'searchAccounts'};

Api.prototype.mailTemplates = {
  "activation": fs.readFileSync('mail_templates/account_activation.html').toString()
};

/**
 * @param {Socket} session
 * @param {Object} listeners
 */
Api.prototype.addSessionListeners = function(session, listeners) {
  var self = this;
  var createListener = function(listener) {
    return function(data) {
      try { 
        self[listener].call(self, session, data);
      } catch(err) {
        console.error('api error', err);
      }
    };
  };
  
  for(var k in listeners) {
    var listener = listeners[k];
    session.on(k, createListener(listener));
  }
};

/**
 * @param {Socket} session
 * @param {Object} listeners
 */
Api.prototype.removeSessionListeners = function(session, listeners) {
  for(var k in listeners)
    session.removeAllListeners(k);
};

/**
 * @param {Socket} session
 */
Api.prototype.initSession = function(session) {
  this.addSessionListeners(session, this.defaultListeners);
};

/**
 * @param {Socket} session
 */
Api.prototype.destroySession = function(session) {
  if(session.user)
    this.logout(session, undefined, false);
  
  this.removeSessionListeners(session, this.defaultListeners);
};

/**
 * @param {Api} self
 * @param {Socket} session
 * @param {String} cmd
 */
var loginValid = function(self, session, cmd) {
  self.addSessionListeners(session, self.loggedInListeners);
  
  var user = session.user;
  user.loginToken = crypto.randomBytes(34).toString('base64').replace(/(\/|\+)/g, '0');
  self.accMan.update(user.id, { loginToken: user.loginToken }, function(result) {
    if(!result)
      throw new Error('Could not update user\'s login token');
  });
  
  var userData = { };
  for(var k in user) {
    if(k === 'hash' || k === 'activationCode')
      continue;

    userData[k] = user[k];
  }

  session.join('user-' + user.id);
  // TODO join groups

  self.accMan.getFriendlist(user.id, function(friendlist) {
    userData.friendlist = friendlist;
    
    session.emit(cmd, userData);
  });

  self.accMan.setOnline(user.id);

  console.log('user ' + session.user.email + ' logged in');
};

/**
 * @param {Object} data
 * @param {Socket} session
 */
Api.prototype.login = function(session, data) {
  if(!data || typeof data.email !== 'string' || typeof data.hash !== 'string') {
    session.emit('create account', 'ERR_INVALID_VALUES');
    return;
  };
  
  var self = this;
  this.accMan.getByEmail(data.email, function(user) {
    if(user === null || user.hash === null || user.hash !== data.hash)
      session.emit('login', 'ERR_NOT_FOUND');
    else if(user.activationCode !== null)
      session.emit('login', 'ERR_NOT_ACTIVATED');
    else {
      session.user = user;
      
      loginValid(self, session, 'login');
    }
  });
};

/**
 * @param {Socket} session
 * @param {Object} data
 */
Api.prototype.restoreLogin = function(session, data) {
  if(!data || typeof data.loginToken !== 'string') {
    session.emit('restore login', 'ERR_INVALID_VALUES');
    return;
  }
  
  var self = this;
  this.accMan.getByLoginToken(data.loginToken, function(user) {
    if(user === null) {
      session.emit('restore login', 'ERR_INVALID');
      return;
    }
    
    session.user = user;
    loginValid(self, session, 'restore login');
  });
};

/**
 * @param {Socket} session
 */
Api.prototype.logout = function(session, data, sessionStillOpen) {
  if(typeof session.user === 'undefined') {
    if(sessionStillOpen !== false)
      session.emit('logout', 'ERR_NO_USER');
    
    return;
  }
  
  this.removeSessionListeners(session, this.loggedInListeners);
  
  if(sessionStillOpen !== false) {
    this.accMan.update(session.user.id, { loginToken: null }, function(result) {
      if(!result)
        throw new Error('Could not remove user\'s login token');
    });
  }
  
  this.accMan.setOffline(session.user.id);
  
  console.log('user ' + session.user.email + ' logged out');
  session.user = undefined;
  if(sessionStillOpen !== false)
    session.emit('logout', 'OK');
};

/**
 * @param {Object} data
 * @param {Socket} session
 */
Api.prototype.createAccount = function(session, data) {
  if(!data || typeof data.email !== 'string' ||  typeof data.nick !== 'string' || typeof data.hash !== 'string' ||
    data.email.length < 8 || data.nick.length < 4 || data.hash.length !== 64) {
    session.emit('create account', 'ERR_INVALID_VALUES');
    return;
  };
  
  var values = {
    email: data.email,
    nick: data.nick,
    hash: data.hash,
    activationCode: crypto.randomBytes(18).toString('base64').replace(/(\/|\+)/g, '0'),
    isActivated: 0
  };
  
  var self = this;
  this.accMan.create(values, function(result) {
    if(!result) {
      session.emit('create account', 'ERR_ALREADY_USED');
      return;
    }
    
    var link = 'https://' + self.hostname + '/?activate=' + values.activationCode;
    
    var mailOptions = {
      from: 'syntax.im <noreply@syntax.im>',
      to: values.email,
      subject: 'account activation',
      html: self.mailTemplates.activation.replace(/%link%/gi, link)
    };
    
    self.mailer.sendMail(mailOptions, function(err) {
      if(err)
        session.emit('create account', 'ERR_COULDNT_SEND_MAIL');
      else
        session.emit('create account', 'OK');
    });
  });
};

/**
 * @param {Socket} session
 * @param {Object} data
 */
Api.prototype.activateAccount = function(session, data) {
  if(!data || typeof data.code !== 'string') {
    session.emit('activate account', 'ERR_INVALID_VALUES');
    return;
  }
  
  this.accMan.activateAccount(data.code, function(result) {
    if(result)
      session.emit('activate account', 'OK');
    else
      session.emit('activate account', 'ERR_NOT_FOUND');
  });
};

/**
 * @param {Socket} session
 * @param {Object} data
 */
Api.prototype.chatMessage = function(session, data) { // TODO group message
  if(!data || typeof data.recipientId !== 'number')
    return session.emit('chat message', 'ERR_INVALID_VALUES');
  
  data.senderId = session.user.id;
  data.time = moment().unix();
  
  var self = this;
  if(data.recipientId) { // friend message
    this.accMan.getFriendship(data.senderId, data.recipientId, function(result) {
      if(result === null || result.state !== 'accepted')
        return;
      
      self.io.to('user-' + data.recipientId).to('user-' + data.senderId).emit('chat message', data);
    });
  }
};

/**
 * @param {Socket} session
 * @param {Object} data
 */
Api.prototype.friendRequest = function(session, data) {
  if(!data || typeof data.targetId !== 'number')
    return session.emit('friend request', 'ERR_INVALID_VALUES');
  
  this.accMan.requestFriendship(session.user.id, data.targetId, function(result) {
    session.emit('friend request', result ? 'OK' : 'ERR');
  });
};

/**
 * @param {Socket} session
 * @param {Object} data
 */
Api.prototype.friendResponse = function(session, data) {
  if(!data || typeof data.invokerId !== 'number' || ['accepted', 'denied'].indexOf(data.decision) < 0)
    return session.emit('friend response', 'ERR_INVALID_VALUES');
  
  this.accMan.respondFriendship(session.user.id, data.invokerId, data.decision, function(result) {
    session.emit('friend response', result ? 'OK' : 'ERR');
  });
};

/**
 * @param {Socket} session
 * @param {Object} data
 */
Api.prototype.searchAccounts = function(session, data) {
  if(!data || typeof data.search !== 'string')
    return session.emit('search accounts', 'ERR_INVALID_VALUES');
  
  if(data.search.trim() === '') {
    process.nextTick(function() {
      session.emit('search accounts', []);
    });
    return;
  }
  
  this.accMan.searchAccounts(data.search, session.user.id, function(accounts) {
    var ret = [];
    
    for(var k in accounts) {
      var acc = accounts[k];
      ret.push({
        id: acc.id,
        nick: acc.nick
      });
    }
    
    session.emit('search accounts', ret);
  });
};

module.exports = Api;
