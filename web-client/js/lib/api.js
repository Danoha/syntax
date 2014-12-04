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

define(['../core/socket', 'jquery', '../vendor/sha256.min'], function (socket, $) {
  var log = false;

  var io = socket();

  function Api() {
  }

  var tryCallback = function () {
    var args = Array.prototype.slice.call(arguments);
    var cb = args.splice(0, 1)[0];

    try {
      cb.apply(this, args);
    }
    catch (err) {
      console.error('Api callback error.', err.stack);
    }
  };

  function createEvent(name) {
    var listeners = [];

    io.on(name, function (data) {
      if (log)
        console.log('api event=' + name + ' data=', data);

      $.each(listeners, function (i, listener) {
        tryCallback(listener, data);
      });
    });

    return listeners;
  }

  function emit(method, data, callback) {
    io.on(method, function (result) {
      io.removeAllListeners(method);

      if (log)
        console.log('api method=' + method + ' data=', data, 'result=', result);

      if (callback)
        tryCallback(callback, result);
    });

    io.emit(method, data);
  }

  Api.prototype.account = {
    create: function (email, nick, password, callback) {
      emit('account.create', {
        email: email,
        nick: nick,
        hash: CryptoJS.SHA256(password).toString()
      }, callback);
    },

    activate: function (code, callback) {
      emit('account.activate', {
        code: code
      }, callback);
    },

    login: function (email, password, callback) {
      emit('account.login', {
        email: email,
        hash: CryptoJS.SHA256(password).toString()
      }, callback);
    },

    restoreLogin: function (loginToken, callback) {
      emit('account.restoreLogin', {
        loginToken: loginToken
      }, callback);
    },

    logout: function (callback) {
      emit('account.logout', undefined, callback);
    }
  };

  Api.prototype.contact = {
    lookup: function (query, callback) {
      emit('contact.lookup', {
        query: query
      }, callback);
    },

    setFriendshipState: function (targetId, state, isFavorite, callback) {
      emit('contact.setFriendshipState', {
        targetId: targetId,
        state: state,
        isFavorite: isFavorite
      }, callback);
    },

    friendshipStateEvent: createEvent('contact.friendshipStateEvent'),
    onlineEvent: createEvent('contact.onlineEvent')
  };

  Api.prototype.group = {
    create: function (callback) {
      emit('group.create', undefined, callback);
    },

    invite: function (userId, groupId, callback) {
      emit('group.invite', {
        userId: userId,
        groupId: groupId
      }, callback);
    },

    leave: function (groupId, doNotInviteAgain, callback) {
      emit('group.leave', {
        groupId: groupId,
        doNotInviteAgain: doNotInviteAgain
      }, callback);
    },

    inviteEvent: createEvent('group.inviteEvent'),
    memberLeftEvent: createEvent('group.memberLeftEvent'),
    destroyEvent: createEvent('group.destroyEvent')
  };

  Api.prototype.message = {
    send: function (msg, callback) {
      emit('message.send', msg, callback);
    },

    receivedEvent: createEvent('message.receivedEvent')
  };

  Api.prototype.reset = function () {
    var suffix = 'Event';

    for (var section in this) {
      if (typeof this[section] !== 'object')
        continue;

      section = this[section];
      for (var property in section) {
        if (property.indexOf(suffix, property.length - suffix.length) < 0)
          continue;

        section[property].length = 0;
      }
    }
  };

  /**
   * @deprecated
   * @todo remove
   */
  var bind = function (name, event, params, listen) {
    Api.prototype[name] = function () {

      if (listen !== false) {
        var callback = Array.prototype.slice.call(arguments, -1)[0];

        io.on(event, function (result) {
          io.removeAllListeners(event);

          tryCallback(callback, result);
        });
      }

      var data;
      if (params) {
        var args;
        if (listen !== false)
          args = Array.prototype.slice.call(arguments, 0, -1);
        else
          args = Array.prototype.slice.call(arguments);
        data = params.apply(undefined, args);
      }

      io.emit(event, data);
    };
  };

  bind('chatMessage', 'message.send', function (data) {
    return data;
  }, false);

  bind('login', 'account.login', function (email, password) {
    return {
      email: email,
      hash: CryptoJS.SHA256(password).toString()
    };
  });

  bind('logout', 'account.logout');

  bind('activateAccount', 'account.activate', function (code) {
    return {
      code: code
    };
  });

  bind('createAccount', 'account.create', function (email, nick, password) {
    return {
      email: email,
      nick: nick,
      hash: CryptoJS.SHA256(password).toString()
    };
  });

  bind('restoreLogin', 'account.restoreLogin', function (loginToken) {
    return {
      loginToken: loginToken
    };
  });

  bind('searchAccounts', 'contact.lookup', function (search) {
    return {
      query: search
    };
  });

  bind('createGroup', 'group.create');

  bind('leaveGroup', 'group.leave', function (groupId, doNotInviteAgain) {
    return {
      groupId: groupId,
      doNotInviteAgain: doNotInviteAgain
    };
  });

  bind('groupInvite', 'group.invite', function (groupId, friendId) {
    return {
      userId: friendId,
      groupId: groupId
    };
  });

  bind('setFriendshipState', 'contact.setFriendshipState', function (targetId, state, isFavorite) {
    return {
      targetId: targetId,
      state: state,
      isFavorite: isFavorite ? true : false
    };
  });

  /**
   * @deprecated
   * @todo remove
   */
  Api.prototype.on = function (event, listener) {
    io.on(event, function () {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(listener);

      tryCallback.apply(this, args);
    });
  };

  return new Api();
});
