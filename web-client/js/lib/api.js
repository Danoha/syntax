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

(function(app) {
  var Api = function() {
    this.io = app.io;
  };
  
  var tryCallback = function() {
    var args = Array.prototype.slice.call(arguments);
    var cb = args.splice(0, 1)[0];
    
    try {
      cb.apply(this, args);
    } catch(err) {
      console.error('api callback error', err.stack);
    }
  };
  
  Api.prototype.on = function(eventName, listener) {
    this.io.on(eventName, function() {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(listener);
      
      tryCallback.apply(this, args);
    });
  };

  Api.prototype.chatMessage = function(data) {
    this.io.emit('chat message', data);
  };

  Api.prototype.logout = function(callback) {
    var self = this;
    self.io.on('logout', function(result) {
      self.io.removeAllListeners('logout');
      
      tryCallback(callback, result);
    });
    
    self.io.emit('logout');
  };
  
  Api.prototype.login = function(email, password, callback) {
    var self = this;
    self.io.on('login', function(result) {
      self.io.removeAllListeners('login');
      
      tryCallback(callback, result);
    });
    
    self.io.emit('login', {
      email: email,
      hash: CryptoJS.SHA256(password).toString()
    });
  };
  
  Api.prototype.activateAccount = function(code, callback) {
    var self = this;
    self.io.on('activate account', function(result) {
      self.io.removeAllListeners('activate account');
      
      tryCallback(callback, result);
    });
    
    self.io.emit('activate account', {
      code: code
    });
  };
  
  Api.prototype.createAccount = function(email, nick, password, callback) {
    var self = this;
    self.io.on('create account', function(result) {
      self.io.removeAllListeners('create account');
      
      tryCallback(callback, result);
    });
    
    self.io.emit('create account', {
      email: email,
      nick: nick,
      hash: CryptoJS.SHA256(password).toString()
    });
  };
  
  Api.prototype.restoreLogin = function(loginToken, callback) {
    var self = this;
    self.io.on('restore login', function(result) {
      self.io.removeAllListeners('restore login');
      
      tryCallback(callback, result);
    });
    
    self.io.emit('restore login', {
      loginToken: loginToken
    });
  };
  
  Api.prototype.searchAccounts = function(search, callback) {
    var self = this;
    self.io.on('search accounts', function(result) {
      self.io.removeAllListeners('search accounts');
      
      tryCallback(callback, result);
    });
    
    self.io.emit('search accounts', {
      search: search
    });
  };
  
  Api.prototype.createGroup = function(callback) {
    var self = this;
    self.io.on('group create', function(result) {
      self.io.removeAllListeners('group create');
      
      tryCallback(callback, result);
    });
    
    self.io.emit('group create');
  };
  
  Api.prototype.leaveGroup = function(groupId, doNotInviteAgain, callback) {
    var self = this;
    self.io.on('group leave', function(result) {
      self.io.removeAllListeners('group leave');
      
      tryCallback(callback, result);
    });
    
    self.io.emit('group leave', {
      groupId: groupId,
      doNotInviteAgain: doNotInviteAgain
    });
  };
  
  Api.prototype.friendRequest = function(targetId, callback) {
    var self = this;
    self.io.on('friend request', function(result) {
      self.io.removeAllListeners('friend request');
      
      tryCallback(callback, result);
    });
    
    self.io.emit('friend request', {
      targetId: targetId
    });
  };
  
  Api.prototype.friendResponse = function(invokerId, decision, callback) {
    var self = this;
    self.io.on('friend response', function(result) {
      self.io.removeAllListeners('friend response');
      
      tryCallback(callback, result);
    });
    
    self.io.emit('friend response', {
      invokerId: invokerId,
      decision: decision
    });
  };
  
  Api.prototype.groupInvite = function(groupId, friendId, callback) {
    var self = this;
    self.io.on('group invite', function(result) {
      self.io.removeAllListeners('group invite');
      
      tryCallback(callback, result);
    });
    
    self.io.emit('group invite', {
      groupId: groupId,
      friendId: friendId
    });
  };
  
  app.utils.Api = Api;
})(document.syntaxApp);