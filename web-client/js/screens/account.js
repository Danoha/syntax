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

define(['./base', '../vendor/knockout', '../lib/api', '../utils/waitdialog', '../lib/storage', '../vendor/bootbox', '../vendor/uri/main', 'require', '../core/socket', '../app', '../core/bus'], function(BaseScreen, ko, api, WaitDialog, storage, bootbox, URI, require, socket, app, bus) {
  var accountScreen = new BaseScreen('.account', 'account');

  // Helper functions

  function activateAccount(activationCode) {
    var wait = new WaitDialog('activating account');

    api.activateAccount(activationCode, function(result) {
      wait.close();

      var message;
      switch (result) {
        case 'OK':
          message = 'your account has been activated';
          break;
        case 'ERR_NOT_FOUND':
          message = 'error, your code is invalid';
          break;
      }

      bootbox.alert(message);
    });
  }

  function createAccount() {
    var nick = accountScreen.createAccount.nick(),
      password = accountScreen.createAccount.password(),
      email = accountScreen.createAccount.email(),
      passwordAgain = accountScreen.createAccount.passwordAgain();

    if (nick < 4) {
      bootbox.alert('nick is too short');
      return;
    }

    if (password.length < 5) {
      bootbox.alert('password is too short');
      return;
    }

    if (password !== passwordAgain) {
      bootbox.alert('passwords do not match');
      return;
    }

    var wait = new WaitDialog('creating account');

    api.createAccount(email, nick, password, function(result) {
      wait.close();

      var message;
      switch (result) {
        case 'OK':
          message = 'your account has been created, please check your inbox and click on activation link';
          break;
        case 'ERR_INVALID_VALUES':
          message = 'invalid values were entered';
          break;
        case 'ERR_ALREADY_USED':
          message = 'given email address is already used';
          break;
        default:
          message = 'an error occured, please contact support';
          break;
      }

      bootbox.alert(message);
    });
  }

  function loginValid(user, saveToken) {
    if (saveToken)
      storage.set('loginToken', user.loginToken);

    accountScreen.hide();

    require(['../app', './app'], function(app, appScreen) {
      app.user = user;

      appScreen.show();
    });
  }

  function login() {
    var email = accountScreen.login.email(),
      password = accountScreen.login.password();

    storage.remove('loginToken');

    var wait = new WaitDialog('logging in');

    api.login(email, password, function(result) {
      wait.close();

      var message = null;
      switch (result) {
        case 'ERR_NOT_ACTIVATED':
          message = 'account is not activated';
          break;
        case 'ERR_NOT_FOUND':
          message = 'email or password incorrect';
          break;
        case 'ERR_INVALID_VALUES':
          message = 'invalid values were entered';
          break;
        default:
          loginValid(result, accountScreen.login.stayOnline());
          break;
      }

      if (message !== null)
        bootbox.alert(message);
    });
  }

  function restoreLogin(token) {
    var wait = new WaitDialog('logging in');

    api.restoreLogin(token, function(result) {
      wait.close();

      storage.remove('loginToken');

      if (result === 'ERR_INVALID')
        bootbox.alert('could not restore your login');
      else
        loginValid(result, true);
    });
  }

  // Model definition

  accountScreen.createAccount = {
    email: ko.observable(''),
    nick: ko.observable(''),
    password: ko.observable(''),
    passwordAgain: ko.observable(''),
    submit: createAccount
  };

  accountScreen.login = {
    email: ko.observable(''),
    password: ko.observable(''),
    stayOnline: ko.observable(true),
    submit: login
  };

  // Event bindings

  accountScreen.onReset = function() {
    var ca = accountScreen.createAccount;
    ca.email('');
    ca.nick('');
    ca.password('');
    ca.passwordAgain('');

    var l = accountScreen.login;
    l.email('');
    l.password('');
    l.stayOnline(true);
    
    app.resetUniqueId();
    bus.userStorage = null;
  };

  var firstShow = true;
  accountScreen.onShown = function() {
    var loginToken = storage.get('loginToken');

    if (loginToken) // try to restore login, if login token is present
      restoreLogin(loginToken);
    else if(firstShow) { // is activation code present?
      var search = URI(location.href).search(true);

      if (search && search.activate)
        activateAccount(search.activate);
    }
    
    firstShow = false;
  };

  // Socket event bindings
  
  var io = socket();
  var reconnectingDialog = null;
  
  io.on('reconnecting', function() {
    if (reconnectingDialog !== null)
      return;

    reconnectingDialog = new WaitDialog('connection lost, reconnecting');
  });

  io.on('reconnect', function() {
    reconnectingDialog.close();
    reconnectingDialog = null;
  });

  return accountScreen;
});