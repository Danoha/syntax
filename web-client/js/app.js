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

require.config({
  baseUrl: 'js',
  paths: {
    'jquery': './vendor/jquery',
    'moment': './vendor/moment'
  },
  shim: {
    'vendor/bootbox': {
      deps: ['vendor/bootstrap.min']
    },
    'vendor/bootstrap.min': {
      deps: ['jquery']
    }
  }/*,
  urlArgs: "bust=" + (new Date()).getTime() // remove from production*/
});

define(['./core/socket', 'jquery', 'require', './core/focus', './vendor/bootbox'], function(socket, $, require, focus, bootbox) {
  bootbox.setDefaults({
    closeButton: false
  });

  var SyntaxApp = function() {
    var self = this;

    // socket.io probably not initialized so provide callback
    socket(function(err, io, clientLibrary) {
      if (err) {
        console.log('socket error', err);
        $('.loading .container').text('could not load socket.io library (' + clientLibrary + ')');
        return;
      }

      socket = io;

      self.init();
    });
  };

  SyntaxApp.prototype.init = function() {
    focus.bind();

    // TODO: use Deferred or Promise, maybe?

    var initCounter = 2;
    var accountScreen = null;

    var showAccountScreen = function() {
      if (--initCounter > 0)
        return;

      $('.loading').fadeOut(function() {
        $('.loading').remove();
      });

      accountScreen.show();
    };

    // load account screen logic
    require(['./screens/account'], function(as) {
      accountScreen = as;

      showAccountScreen();
    });

    // connect to chat server
    if (socket.connected)
      showAccountScreen();
    else {
      socket.on('connect', function() {
        socket.removeAllListeners('connect');

        showAccountScreen();
      });
    }
  };

  var _uniqueId = null;
  SyntaxApp.prototype.getUniqueId = function() {
    if (_uniqueId === null) {
      var charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_/=+-%';
      _uniqueId = '';

      for (var i = 0; i < 32; i++)
        _uniqueId += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return _uniqueId;
  }

  SyntaxApp.prototype.resetUniqueId = function() {
    _uniqueId = null;
  }

  return new SyntaxApp();
});