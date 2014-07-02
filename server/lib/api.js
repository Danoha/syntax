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
};

Api.prototype.setIO = function(io) {
  this.io = io;
};

Api.prototype.defaultListeners = { disconnect: 'destroySession', login: 'login', 'create account': 'createAccount', 'activate account': 'activateAccount', 'restore login': 'restoreLogin' };
Api.prototype.loggedInListeners = { logout: 'logout',  'chat message': 'chatMessage'};

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

var loginValid = function(self, session, cmd) {
  var user = session.user;
  self.addSessionListeners(session, self.loggedInListeners);
      
  var userData = { };
  for(var k in user) {
    if(k === 'hash' || k === 'activationCode')
      continue;

    userData[k] = user[k];
  }

  // TODO add contact list to userData

  session.emit(cmd, userData);

  // TODO tell all user contacts that their friend is online

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
      
      user.loginToken = crypto.randomBytes(18).toString('base64').replace(/(\/|\+)/g, '0');
      self.accMan.update(user.id, { loginToken: user.loginToken }, function(result) {
        if(!result)
          throw new Error('Could not update user\'s login token');
      });
      
      loginValid(self, session, 'login');
    }
  });
};

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
  
  // TODO tell all user contacts that their friend went offline
  
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

Api.prototype.chatMessage = function(session, data) {
  this.io.emit('chat message', data);
};

module.exports = Api;
